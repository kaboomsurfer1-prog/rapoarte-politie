const config = require("./config");

const EXPECTED_FIELDS = [
  { key: "agent_name", label: "Nume" },
  { key: "cnp", label: "CNP Agent" },
  { key: "functie", label: "Functie detinuta" },
  { key: "report_date", label: "Data" },
  { key: "report_time", label: "Ora" },
  { key: "infraction", label: "Infractiune + Amenda" },
  { key: "id_card_image", label: "Poza cu buletin" }
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseDate(value) {
  const text = String(value || "").trim();
  let year;
  let month;
  let day;

  let match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else {
    match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    iso: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`,
    display: `${day.toString().padStart(2, "0")}.${month.toString().padStart(2, "0")}.${year}`
  };
}

function parseTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function extractFineAmount(value) {
  const text = String(value || "");
  const matches = text.match(/\d[\d.,]*/g);
  if (!matches) return null;

  const amounts = matches
    .map((match) => {
      const normalized = match.replace(/\./g, "").replace(",", ".");
      const number = Number(normalized);
      return Number.isFinite(number) ? number : null;
    })
    .filter((number) => number !== null);

  if (!amounts.length) return null;
  return Math.max(...amounts);
}

function isImageAttachment(attachment) {
  if (!attachment) return false;
  if (attachment.contentType && attachment.contentType.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(attachment.name || attachment.url || "");
}

function getAttachmentImageUrl(attachments) {
  const image = attachments.find((attachment) => isImageAttachment(attachment));
  return image ? image.url : null;
}

function getRoleByFunctionName(functionName) {
  const normalized = normalizeText(functionName);
  return config.allRoles.find((role) => normalizeText(role.name) === normalized) || null;
}

function hasAnyRole(member, roleIds) {
  if (!member || !member.roles || !member.roles.cache) return false;
  return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

function validateFieldOrder(lines, errors) {
  const parsed = [];

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      errors.push(`Linia "${line}" nu are formatul "Camp: valoare".`);
      continue;
    }

    parsed.push({
      label: line.slice(0, separatorIndex).trim(),
      value: line.slice(separatorIndex + 1).trim()
    });
  }

  for (let index = 0; index < EXPECTED_FIELDS.length; index += 1) {
    const expected = EXPECTED_FIELDS[index];
    const current = parsed[index];

    if (!current) {
      errors.push(`Lipseste linia ${index + 1}: "${expected.label}:".`);
      continue;
    }

    if (normalizeText(current.label) !== normalizeText(expected.label)) {
      errors.push(`Linia ${index + 1} trebuie sa fie "${expected.label}:", nu "${current.label}:".`);
      continue;
    }
  }

  if (parsed.length > EXPECTED_FIELDS.length) {
    errors.push("Raportul are linii in plus. Foloseste doar campurile din model.");
  }

  const values = {};
  for (let index = 0; index < Math.min(parsed.length, EXPECTED_FIELDS.length); index += 1) {
    const expected = EXPECTED_FIELDS[index];
    const current = parsed[index];
    if (normalizeText(current.label) === normalizeText(expected.label)) {
      values[expected.key] = current.value;
    }
  }

  return values;
}

function validateReport(content, attachmentsCollection, member) {
  const errors = [];
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    errors.push("Raportul este gol.");
  }

  const values = validateFieldOrder(lines, errors);
  const attachmentList = Array.from(attachmentsCollection?.values?.() || []);
  const attachmentImageUrl = getAttachmentImageUrl(attachmentList);

  if (!hasAnyRole(member, config.policeRoleIds)) {
    errors.push("Nu ai un grad de politie configurat pentru a trimite rapoarte.");
  }

  if (!values.agent_name || values.agent_name.length < 2) {
    errors.push('Campul "Nume" trebuie completat.');
  }

  if (!/^\d{13}$/.test(values.cnp || "")) {
    errors.push('Campul "CNP Agent" trebuie sa contina exact 13 cifre.');
  }

  const role = getRoleByFunctionName(values.functie);
  if (!values.functie) {
    errors.push('Campul "Functie detinuta" trebuie completat.');
  } else if (!role) {
    errors.push('Campul "Functie detinuta" trebuie sa fie unul dintre gradele configurate.');
  } else if (member && member.roles?.cache && !member.roles.cache.has(role.id)) {
    errors.push(`Functia declarata "${role.name}" nu corespunde rolurilor tale de pe server.`);
  }

  const parsedDate = parseDate(values.report_date);
  if (!parsedDate) {
    errors.push('Campul "Data" trebuie sa fie o data valida, de exemplu 13.08.2026.');
  }

  const parsedTime = parseTime(values.report_time);
  if (!parsedTime) {
    errors.push('Campul "Ora" trebuie sa fie in format 24h, de exemplu 20:30.');
  }

  const fineAmount = extractFineAmount(values.infraction);
  if (!values.infraction) {
    errors.push('Campul "Infractiune + Amenda" trebuie completat.');
  } else if (fineAmount === null) {
    errors.push('Campul "Infractiune + Amenda" trebuie sa includa valoarea amenzii.');
  }

  const imageValue = values.id_card_image || "";
  const imageUrl = attachmentImageUrl || (/(https?:\/\/\S+)/i.exec(imageValue)?.[1] ?? null);
  if (!imageUrl) {
    errors.push('Campul "Poza cu buletin" trebuie sa contina un link sau o poza atasata.');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      agentName: values.agent_name,
      cnp: values.cnp,
      functie: role?.name || values.functie,
      roleId: role?.id || null,
      reportDate: parsedDate?.display || values.report_date,
      reportDateIso: parsedDate?.iso || null,
      reportTime: parsedTime || values.report_time,
      infraction: values.infraction,
      fineAmount: fineAmount || 0,
      idCardImageUrl: imageUrl,
      rawContent: content
    }
  };
}

function validateSingleField(field, value) {
  const text = String(value || "").trim();

  switch (field) {
    case "agent_name":
      return text.length >= 2 ? { value: text } : { error: 'Campul "Nume" trebuie completat.' };
    case "cnp":
      return /^\d{13}$/.test(text)
        ? { value: text }
        : { error: 'Campul "CNP Agent" trebuie sa contina exact 13 cifre.' };
    case "functie": {
      const role = getRoleByFunctionName(text);
      return role
        ? { value: role.name, roleId: role.id }
        : { error: 'Campul "Functie detinuta" trebuie sa fie unul dintre gradele configurate.' };
    }
    case "report_date": {
      const parsed = parseDate(text);
      return parsed
        ? { value: parsed.display, reportDateIso: parsed.iso }
        : { error: 'Campul "Data" trebuie sa fie o data valida, de exemplu 13.08.2026.' };
    }
    case "report_time": {
      const parsed = parseTime(text);
      return parsed
        ? { value: parsed }
        : { error: 'Campul "Ora" trebuie sa fie in format 24h, de exemplu 20:30.' };
    }
    case "infraction": {
      const fineAmount = extractFineAmount(text);
      if (!text) return { error: 'Campul "Infractiune + Amenda" trebuie completat.' };
      if (fineAmount === null) {
        return { error: 'Campul "Infractiune + Amenda" trebuie sa includa valoarea amenzii.' };
      }
      return { value: text, fineAmount };
    }
    case "fine_amount": {
      const fineAmount = extractFineAmount(text);
      return fineAmount === null
        ? { error: "Valoarea amenzii trebuie sa contina un numar." }
        : { value: fineAmount };
    }
    case "id_card_image_url":
      return /^https?:\/\/\S+$/i.test(text)
        ? { value: text }
        : { error: 'Campul "Poza cu buletin" trebuie sa contina un link valid.' };
    default:
      return { error: "Camp necunoscut." };
  }
}

module.exports = {
  EXPECTED_FIELDS,
  getRoleByFunctionName,
  hasAnyRole,
  normalizeText,
  validateReport,
  validateSingleField
};
