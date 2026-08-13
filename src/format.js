function formatMoney(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("ro-RO", {
    maximumFractionDigits: 0
  }).format(number);
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function truncate(value, maxLength = 950) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function mentionUser(userId) {
  return `<@${userId}>`;
}

function roleMentions(roleIds) {
  return roleIds.map((roleId) => `<@&${roleId}>`).join(" ");
}

module.exports = {
  formatDateTime,
  formatMoney,
  mentionUser,
  roleMentions,
  truncate
};
