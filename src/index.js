const {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits
} = require("discord.js");

require("./railway-health");

const config = require("./config");
const createDatabase = require("./database");
const { formatDateTime, formatMoney, mentionUser, roleMentions, truncate } = require("./format");
const { hasAnyRole, validateReport, validateSingleField } = require("./validation");

if (!config.token) {
  console.error("Lipseste DISCORD_TOKEN in .env");
  process.exit(1);
}

const database = createDatabase(config.databasePath);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

function createBaseEmbed(title) {
  return new EmbedBuilder().setColor(0x1f8b4c).setTitle(title).setTimestamp(new Date());
}

function createErrorEmbed(title) {
  return new EmbedBuilder().setColor(0xc0392b).setTitle(title).setTimestamp(new Date());
}

function isStaff(member) {
  return hasAnyRole(member, config.staffRoleIds);
}

function buildReportEmbed(report, title = "Raport politie") {
  return createBaseEmbed(title)
    .addFields(
      { name: "ID", value: `#${report.id}`, inline: true },
      { name: "Agent", value: `${report.agent_name} (${mentionUser(report.author_id)})`, inline: true },
      { name: "Functie", value: report.functie, inline: true },
      { name: "Data", value: report.report_date, inline: true },
      { name: "Ora", value: report.report_time, inline: true },
      { name: "Amenda", value: `${formatMoney(report.fine_amount)} lei`, inline: true },
      { name: "Infractiune", value: truncate(report.infraction, 1000), inline: false },
      { name: "Poza buletin", value: report.id_card_image_url, inline: false }
    )
    .setFooter({ text: `Status: ${report.status}` });
}

function buildTopDescription(rows, metric) {
  if (!rows.length) return "Nu exista rapoarte in perioada aleasa.";

  return rows
    .map((row, index) => {
      const score =
        metric === "fines"
          ? `${formatMoney(row.fine_total)} lei`
          : `${row.reports_count} rapoarte`;
      return `${index + 1}. ${mentionUser(row.author_id)} - ${score} (${row.functie})`;
    })
    .join("\n");
}

async function sendNotification(guild, embed, content = null) {
  if (!config.notificationChannelId) return;

  try {
    const channel = await guild.channels.fetch(config.notificationChannelId);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({
      content,
      embeds: [embed],
      allowedMentions: { roles: config.staffRoleIds, users: [] }
    });
  } catch (error) {
    console.error("Nu am putut trimite notificarea:", error);
  }
}

function validationErrorMessage(errors) {
  const model = [
    "Nume:",
    "CNP Agent:",
    "Functie detinuta:",
    "Data:",
    "Ora:",
    "Infractiune + Amenda:",
    "Poza cu buletin:"
  ].join("\n");

  const details = errors.map((error) => `- ${error}`).join("\n");
  return truncate(`Raport respins. Corecteaza urmatoarele:\n${details}\n\nModel corect:\n${model}`, 1900);
}

async function handleReportMessage(message) {
  if (!message.guild || message.author.bot) return;
  if (message.guild.id !== config.guildId) return;
  if (message.channel.id !== config.reportChannelId) return;

  const existing = database.findReportByMessageId(message.id);
  if (existing) return;

  const result = validateReport(message.content, message.attachments, message.member);

  if (!result.valid) {
    await message.reply({
      content: validationErrorMessage(result.errors),
      allowedMentions: { repliedUser: true }
    });

    if (config.deleteInvalidReports && message.deletable) {
      await message.delete().catch(() => null);
    }
    return;
  }

  const reportId = database.createReport({
    guildId: message.guild.id,
    channelId: message.channel.id,
    messageId: message.id,
    authorId: message.author.id,
    ...result.data
  });

  await message.reply({
    content: `Raport inregistrat cu succes. ID raport: #${reportId}`,
    allowedMentions: { repliedUser: true }
  });

  const report = database.getReportById(message.guild.id, reportId);
  const mentionContent = config.mentionStaffOnReport ? roleMentions(config.staffRoleIds) : null;
  await sendNotification(message.guild, buildReportEmbed(report, "Raport nou inregistrat"), mentionContent);
}

async function handleProfil(interaction) {
  const user = interaction.options.getUser("user", true);
  const page = interaction.options.getInteger("pagina") || 1;
  const limit = 8;
  const total = database.countReports({ guildId: interaction.guildId, userId: user.id });
  const stats = database.getProfileStats(interaction.guildId, user.id);
  const reports = database.listReports({
    guildId: interaction.guildId,
    userId: user.id,
    page,
    limit
  });

  const maxPage = Math.max(Math.ceil(total / limit), 1);
  const embed = createBaseEmbed(`Profil politie - ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "Total rapoarte", value: String(stats.total_reports || 0), inline: true },
      { name: "Total amenzi", value: `${formatMoney(stats.total_fines)} lei`, inline: true },
      { name: "Ultimul raport", value: formatDateTime(stats.last_report_at), inline: true }
    )
    .setFooter({ text: `Pagina ${page}/${maxPage}` });

  if (!reports.length) {
    embed.setDescription("Acest politist nu are rapoarte in baza de date.");
  } else {
    embed.setDescription(
      reports
        .map(
          (report) =>
            `#${report.id} - ${report.report_date} ${report.report_time} - ${formatMoney(
              report.fine_amount
            )} lei - ${truncate(report.infraction, 90)}`
        )
        .join("\n")
    );
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleStatistici(interaction) {
  const stats = database.getGeneralStats(interaction.guildId);
  const top = database.getTop(interaction.guildId, { metric: "reports", period: "all", limit: 5 });

  const embed = createBaseEmbed("Statistici politie")
    .addFields(
      { name: "Total rapoarte", value: String(stats.totalReports), inline: true },
      { name: "Total amenzi", value: `${formatMoney(stats.totalFines)} lei`, inline: true },
      { name: "Rapoarte sterse", value: String(stats.deletedReports), inline: true },
      { name: "Astazi", value: `${stats.todayReports} rapoarte\n${formatMoney(stats.todayFines)} lei`, inline: true },
      { name: "Luna aceasta", value: `${stats.monthReports} rapoarte\n${formatMoney(stats.monthFines)} lei`, inline: true },
      { name: "Top rapoarte", value: buildTopDescription(top, "reports"), inline: false }
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleTop(interaction) {
  const metric = interaction.options.getString("tip") || "reports";
  const period = interaction.options.getString("perioada") || "all";
  const rows = database.getTop(interaction.guildId, { metric, period, limit: 10 });

  const periodLabel = {
    all: "total",
    month: "luna aceasta",
    week: "saptamana aceasta"
  }[period];

  const title = metric === "fines" ? "Top amenzi" : "Top rapoarte";
  const embed = createBaseEmbed(`${title} - ${periodLabel}`).setDescription(
    buildTopDescription(rows, metric)
  );

  await interaction.editReply({ embeds: [embed] });
}

async function handleBaza(interaction) {
  if (!isStaff(interaction.member)) {
    await interaction.editReply({ content: "Nu ai acces la aceasta comanda. Doar staff." });
    return;
  }

  const user = interaction.options.getUser("user");
  const page = interaction.options.getInteger("pagina") || 1;
  const includeDeleted = interaction.options.getBoolean("include_sterse") || false;
  const limit = 6;
  const total = database.countReports({
    guildId: interaction.guildId,
    userId: user?.id || null,
    includeDeleted
  });
  const reports = database.listReports({
    guildId: interaction.guildId,
    userId: user?.id || null,
    page,
    limit,
    includeDeleted
  });
  const maxPage = Math.max(Math.ceil(total / limit), 1);

  const embed = createBaseEmbed("Baza de date rapoarte").setFooter({
    text: `Pagina ${page}/${maxPage} - ${total} rapoarte`
  });

  if (!reports.length) {
    embed.setDescription("Nu exista rapoarte pentru filtrul ales.");
  } else {
    embed.setDescription(
      reports
        .map((report) => {
          const status = report.status === "deleted" ? "sters" : "activ";
          return [
            `#${report.id} [${status}] ${report.agent_name} - ${mentionUser(report.author_id)}`,
            `${report.report_date} ${report.report_time} - ${report.functie}`,
            `${truncate(report.infraction, 120)} - ${formatMoney(report.fine_amount)} lei`
          ].join("\n");
        })
        .join("\n\n")
    );
  }

  await interaction.editReply({ embeds: [embed] });
}

async function tryDeleteDiscordMessage(guild, report) {
  try {
    const channel = await guild.channels.fetch(report.channel_id);
    if (!channel || !channel.isTextBased()) return false;
    const message = await channel.messages.fetch(report.message_id);
    if (!message || !message.deletable) return false;
    await message.delete();
    return true;
  } catch {
    return false;
  }
}

async function handleEditare(interaction) {
  if (!isStaff(interaction.member)) {
    await interaction.editReply({ content: "Nu ai acces la aceasta comanda. Doar staff." });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const reportId = interaction.options.getInteger("raport_id", true);
  const report = database.getReportById(interaction.guildId, reportId);

  if (!report) {
    await interaction.editReply({ content: `Raportul #${reportId} nu exista.` });
    return;
  }

  if (subcommand === "sterge") {
    const reason = interaction.options.getString("motiv") || "Fara motiv specificat";
    const deleted = database.markDeleted(interaction.guildId, reportId, interaction.user.id, reason);
    const discordDeleted = await tryDeleteDiscordMessage(interaction.guild, report);

    const embed = createErrorEmbed("Raport sters")
      .setDescription(`Raportul #${reportId} a fost marcat ca sters.`)
      .addFields(
        { name: "Motiv", value: truncate(reason, 500), inline: false },
        { name: "Mesaj Discord", value: discordDeleted ? "Sters" : "Nu a putut fi sters", inline: true }
      );

    await interaction.editReply({ embeds: [embed] });
    await sendNotification(interaction.guild, buildReportEmbed(deleted, "Raport sters"));
    return;
  }

  const field = interaction.options.getString("camp", true);
  const value = interaction.options.getString("valoare", true);
  const checked = validateSingleField(field, value);

  if (checked.error) {
    await interaction.editReply({ content: checked.error });
    return;
  }

  const updates = {};
  if (field === "functie") {
    updates.functie = checked.value;
    updates.role_id = checked.roleId;
  } else if (field === "report_date") {
    updates.report_date = checked.value;
    updates.report_date_iso = checked.reportDateIso;
  } else if (field === "infraction") {
    updates.infraction = checked.value;
    updates.fine_amount = checked.fineAmount;
  } else {
    updates[field] = checked.value;
  }

  const updated = database.updateReport(interaction.guildId, reportId, updates, interaction.user.id);

  const embed = buildReportEmbed(updated, "Raport modificat").setDescription(
    `Camp modificat de ${mentionUser(interaction.user.id)}: ${field}`
  );

  await interaction.editReply({ embeds: [embed] });
  await sendNotification(interaction.guild, embed);
}

client.once("ready", () => {
  console.log(`Bot conectat ca ${client.user.tag}`);
  console.log(`Server: ${config.guildId}`);
  console.log(`Canal rapoarte: ${config.reportChannelId}`);
  console.log(`Baza de date: ${config.databasePath}`);
});

client.on("messageCreate", (message) => {
  handleReportMessage(message).catch((error) => {
    console.error("Eroare la procesarea raportului:", error);
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild || interaction.guildId !== config.guildId) {
    await interaction.reply({ content: "Comanda este disponibila doar pe serverul configurat.", ephemeral: true });
    return;
  }

  const privateCommands = new Set(["baza", "editare"]);
  await interaction.deferReply({ ephemeral: privateCommands.has(interaction.commandName) });

  try {
    if (interaction.commandName === "profil") await handleProfil(interaction);
    if (interaction.commandName === "statistici") await handleStatistici(interaction);
    if (interaction.commandName === "top") await handleTop(interaction);
    if (interaction.commandName === "baza") await handleBaza(interaction);
    if (interaction.commandName === "editare") await handleEditare(interaction);
  } catch (error) {
    console.error("Eroare la comanda slash:", error);
    const content = "A aparut o eroare la executarea comenzii.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content, embeds: [] }).catch(() => null);
    } else {
      await interaction.reply({ content, ephemeral: true }).catch(() => null);
    }
  }
});

process.on("SIGINT", () => {
  database.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  database.close();
  process.exit(0);
});

client.login(config.token);
