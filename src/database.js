const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function startOfDayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function startOfWeekIso() {
  const now = new Date();
  const day = now.getDay() || 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
  return start.toISOString();
}

function createDatabase(databasePath) {
  ensureDirectory(databasePath);
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      author_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      cnp TEXT NOT NULL,
      functie TEXT NOT NULL,
      role_id TEXT,
      report_date TEXT NOT NULL,
      report_date_iso TEXT,
      report_time TEXT NOT NULL,
      infraction TEXT NOT NULL,
      fine_amount REAL NOT NULL DEFAULT 0,
      id_card_image_url TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      deleted_reason TEXT,
      deleted_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      guild_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(report_id) REFERENCES reports(id)
    );

    CREATE INDEX IF NOT EXISTS idx_reports_guild_author ON reports(guild_id, author_id);
    CREATE INDEX IF NOT EXISTS idx_reports_guild_status ON reports(guild_id, status);
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
  `);

  const insertReport = db.prepare(`
    INSERT INTO reports (
      guild_id, channel_id, message_id, author_id, agent_name, cnp, functie, role_id,
      report_date, report_date_iso, report_time, infraction, fine_amount, id_card_image_url,
      raw_content, status, created_at, updated_at
    )
    VALUES (
      @guildId, @channelId, @messageId, @authorId, @agentName, @cnp, @functie, @roleId,
      @reportDate, @reportDateIso, @reportTime, @infraction, @fineAmount, @idCardImageUrl,
      @rawContent, 'active', @createdAt, @updatedAt
    )
  `);

  const api = {
    createReport(report) {
      const now = new Date().toISOString();
      const result = insertReport.run({
        ...report,
        createdAt: now,
        updatedAt: now
      });
      return result.lastInsertRowid;
    },

    getReportById(guildId, reportId) {
      return db
        .prepare("SELECT * FROM reports WHERE guild_id = ? AND id = ?")
        .get(guildId, Number(reportId));
    },

    findReportByMessageId(messageId) {
      return db.prepare("SELECT * FROM reports WHERE message_id = ?").get(messageId);
    },

    listReports({ guildId, userId = null, page = 1, limit = 10, includeDeleted = false }) {
      const offset = (Math.max(page, 1) - 1) * limit;
      const filters = ["guild_id = @guildId"];
      const params = { guildId, limit, offset };

      if (userId) {
        filters.push("author_id = @userId");
        params.userId = userId;
      }

      if (!includeDeleted) {
        filters.push("status = 'active'");
      }

      return db
        .prepare(
          `
          SELECT *
          FROM reports
          WHERE ${filters.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT @limit OFFSET @offset
        `
        )
        .all(params);
    },

    countReports({ guildId, userId = null, includeDeleted = false }) {
      const filters = ["guild_id = @guildId"];
      const params = { guildId };

      if (userId) {
        filters.push("author_id = @userId");
        params.userId = userId;
      }

      if (!includeDeleted) {
        filters.push("status = 'active'");
      }

      return db
        .prepare(`SELECT COUNT(*) AS count FROM reports WHERE ${filters.join(" AND ")}`)
        .get(params).count;
    },

    getProfileStats(guildId, userId) {
      return db
        .prepare(
          `
          SELECT
            COUNT(*) AS total_reports,
            COALESCE(SUM(fine_amount), 0) AS total_fines,
            MAX(created_at) AS last_report_at
          FROM reports
          WHERE guild_id = ? AND author_id = ? AND status = 'active'
        `
        )
        .get(guildId, userId);
    },

    getGeneralStats(guildId) {
      const active = db
        .prepare(
          `
          SELECT COUNT(*) AS total_reports, COALESCE(SUM(fine_amount), 0) AS total_fines
          FROM reports
          WHERE guild_id = ? AND status = 'active'
        `
        )
        .get(guildId);

      const deleted = db
        .prepare("SELECT COUNT(*) AS count FROM reports WHERE guild_id = ? AND status = 'deleted'")
        .get(guildId);

      const today = db
        .prepare(
          `
          SELECT COUNT(*) AS count, COALESCE(SUM(fine_amount), 0) AS fines
          FROM reports
          WHERE guild_id = ? AND status = 'active' AND created_at >= ?
        `
        )
        .get(guildId, startOfDayIso());

      const month = db
        .prepare(
          `
          SELECT COUNT(*) AS count, COALESCE(SUM(fine_amount), 0) AS fines
          FROM reports
          WHERE guild_id = ? AND status = 'active' AND created_at >= ?
        `
        )
        .get(guildId, startOfMonthIso());

      return {
        totalReports: active.total_reports,
        totalFines: active.total_fines,
        deletedReports: deleted.count,
        todayReports: today.count,
        todayFines: today.fines,
        monthReports: month.count,
        monthFines: month.fines
      };
    },

    getTop(guildId, { metric = "reports", period = "all", limit = 10 } = {}) {
      const orderBy = metric === "fines" ? "fine_total DESC" : "reports_count DESC";
      const filters = ["guild_id = @guildId", "status = 'active'"];
      const params = { guildId, limit };

      if (period === "week") {
        filters.push("created_at >= @since");
        params.since = startOfWeekIso();
      }

      if (period === "month") {
        filters.push("created_at >= @since");
        params.since = startOfMonthIso();
      }

      return db
        .prepare(
          `
          SELECT
            author_id,
            agent_name,
            functie,
            COUNT(*) AS reports_count,
            COALESCE(SUM(fine_amount), 0) AS fine_total
          FROM reports
          WHERE ${filters.join(" AND ")}
          GROUP BY author_id
          ORDER BY ${orderBy}
          LIMIT @limit
        `
        )
        .all(params);
    },

    updateReport(guildId, reportId, updates, moderatorId) {
      const current = api.getReportById(guildId, reportId);
      if (!current || current.status === "deleted") return null;

      const allowedFields = [
        "agent_name",
        "cnp",
        "functie",
        "role_id",
        "report_date",
        "report_date_iso",
        "report_time",
        "infraction",
        "fine_amount",
        "id_card_image_url"
      ];

      const fields = Object.keys(updates).filter((key) => allowedFields.includes(key));
      if (!fields.length) return current;

      const params = {
        id: reportId,
        guildId,
        updatedAt: new Date().toISOString()
      };

      for (const field of fields) {
        params[field] = updates[field];
      }

      db.prepare(
        `
        UPDATE reports
        SET ${fields.map((field) => `${field} = @${field}`).join(", ")}, updated_at = @updatedAt
        WHERE guild_id = @guildId AND id = @id
      `
      ).run(params);

      api.addAuditLog({
        reportId,
        guildId,
        moderatorId,
        action: "modify",
        payload: { before: current, updates }
      });

      return api.getReportById(guildId, reportId);
    },

    markDeleted(guildId, reportId, moderatorId, reason) {
      const current = api.getReportById(guildId, reportId);
      if (!current || current.status === "deleted") return null;

      db.prepare(
        `
        UPDATE reports
        SET status = 'deleted', deleted_by = ?, deleted_reason = ?, updated_at = ?
        WHERE guild_id = ? AND id = ?
      `
      ).run(moderatorId, reason || null, new Date().toISOString(), guildId, reportId);

      api.addAuditLog({
        reportId,
        guildId,
        moderatorId,
        action: "delete",
        payload: { reason: reason || null }
      });

      return api.getReportById(guildId, reportId);
    },

    addAuditLog({ reportId, guildId, moderatorId, action, payload }) {
      db.prepare(
        `
        INSERT INTO report_audit (report_id, guild_id, moderator_id, action, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(reportId, guildId, moderatorId, action, JSON.stringify(payload), new Date().toISOString());
    },

    close() {
      db.close();
    }
  };

  return api;
}

module.exports = createDatabase;
