const path = require("node:path");
require("dotenv").config();

const STAFF_ROLES = [
  { id: "1518556796808200373", name: "Primar" },
  { id: "1518557114732118026", name: "Asistent Primar" },
  { id: "1518557504529764463", name: "Manager Politie" },
  { id: "1518557642065317950", name: "Director General" },
  { id: "1518557713582264450", name: "Sef Politie" },
  { id: "1518557984593023058", name: "Chestor General" },
  { id: "1518557845316960297", name: "Adjunct Sef Politie" },
  { id: "1518558123198124074", name: "Chestor Principal" },
  { id: "1518558209239945326", name: "Chestor" },
  { id: "1518558329431916708", name: "Comisar Sef" },
  { id: "1518558411745263657", name: "Comisar" },
  { id: "1518558445283053668", name: "Subcomisar" },
  { id: "1518558470146621453", name: "Inspector Principal" },
  { id: "1518558490593984512", name: "Inspector" },
  { id: "1518558511875756042", name: "Subinspector" }
];

const NORMAL_ROLES = [
  { id: "1518558545635971082", name: "Agent Sef Principal" },
  { id: "1518558571422285854", name: "Agent Sef Adjunct" },
  { id: "1518558596336582767", name: "Agent Principal" },
  { id: "1518558614976204810", name: "Agent" },
  { id: "1518558638644531241", name: "Cadet Politie" }
];

const LEADERSHIP_ROLE_NAMES = [
  "Primar",
  "Asistent Primar",
  "Manager Politie",
  "Director General",
  "Sef Politie"
];

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "y", "da"].includes(String(value).toLowerCase());
}

const databasePath = path.resolve(process.env.DATABASE_PATH || "./data/politie_reports.sqlite");
const leadershipRoles = STAFF_ROLES.filter((role) => LEADERSHIP_ROLE_NAMES.includes(role.name));

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.GUILD_ID || "1518541823788843100",
  reportChannelId: process.env.REPORT_CHANNEL_ID || "1518553389095588062",
  notificationChannelId:
    process.env.NOTIFICATION_CHANNEL_ID || process.env.REPORT_CHANNEL_ID || "1518553389095588062",
  databasePath,
  backupPath: process.env.BACKUP_PATH
    ? path.resolve(process.env.BACKUP_PATH)
    : path.join(path.dirname(databasePath), "backups"),
  mentionStaffOnReport: parseBoolean(process.env.MENTION_STAFF_ON_REPORT, false),
  deleteInvalidReports: parseBoolean(process.env.DELETE_INVALID_REPORTS, false),
  staffRoles: STAFF_ROLES,
  normalRoles: NORMAL_ROLES,
  leadershipRoles,
  leadershipRoleIds: leadershipRoles.map((role) => role.id),
  staffRoleIds: STAFF_ROLES.map((role) => role.id),
  policeRoleIds: [...STAFF_ROLES, ...NORMAL_ROLES].map((role) => role.id),
  allRoles: [...STAFF_ROLES, ...NORMAL_ROLES]
};

module.exports = config;
