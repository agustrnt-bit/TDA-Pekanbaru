import { env } from "cloudflare:workers";
import type { AccessUser } from "@/lib/access-types";

function db() { if (!env.DB) throw new Error("Database belum tersedia"); return env.DB; }

export async function logProgramActivity(userId: number, programId: number, action: string, description: string, metadata?: Record<string, unknown>) {
  await db().prepare(`INSERT INTO activity_logs (user_id, entity_type, entity_id, action, description, metadata)
    VALUES (?, 'program', ?, ?, ?, ?)`).bind(userId, String(programId), action, description, metadata ? JSON.stringify(metadata) : null).run();
}

export async function notifyProgramUsers(programId: number, audience: "ketua" | "division" | "all", type: string, title: string, message: string) {
  const program = await db().prepare(`SELECT division_id AS divisionId FROM programs WHERE id = ?`).bind(programId).first<{ divisionId: number }>();
  if (!program) return;
  const users = await db().prepare(`SELECT id FROM users WHERE is_active = 1 AND (
    ? = 'all' OR (? = 'ketua' AND role = 'ketua_ksb') OR
    (? = 'division' AND (role = 'ketua_ksb' OR division_id = ?)))`)
    .bind(audience, audience, audience, program.divisionId).all<{ id: number }>();
  const eventId = crypto.randomUUID();
  if (users.results.length) await db().batch(users.results.map((user) => db().prepare(`INSERT OR IGNORE INTO notifications
    (user_id, program_id, type, title, message, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(user.id, programId, type, title, message, `${eventId}:${user.id}`)));
}

export async function ensureReminderNotifications(user: AccessUser) {
  const today = new Date().toISOString().slice(0, 10); const soonDate = new Date(); soonDate.setUTCDate(soonDate.getUTCDate() + 7); const soon = soonDate.toISOString().slice(0, 10);
  const claimed = await db().prepare(`INSERT OR IGNORE INTO notification_runs (user_id, run_date) VALUES (?, ?)`).bind(user.id, today).run();
  if (!claimed.meta.changes) return;
  const divisionClause = user.role === "kadiv" ? "AND p.division_id = ?" : "";
  const tasks = await db().prepare(`SELECT pt.id, pt.title, pt.due_date AS dueDate, p.id AS programId, p.title AS programTitle
    FROM program_tasks pt JOIN programs p ON p.id = pt.program_id
    WHERE pt.status <> 'selesai' AND pt.due_date <> '' AND pt.due_date <= ? ${divisionClause}
    UNION ALL SELECT pt.id, pt.title, pt.due_date AS dueDate, p.id AS programId, p.title AS programTitle
    FROM program_tasks pt JOIN programs p ON p.id = pt.program_id
    WHERE pt.status <> 'selesai' AND pt.due_date > ? AND pt.due_date <= ? ${divisionClause}`)
    .bind(...(user.role === "kadiv" ? [today, user.divisionId, today, soon, user.divisionId] : [today, today, soon])).all<{ id: number; title: string; dueDate: string; programId: number; programTitle: string }>();
  const lpjs = await db().prepare(`SELECT p.id AS programId, p.title FROM programs p LEFT JOIN program_lpj l ON l.program_id = p.id
    WHERE p.end_date <> '' AND p.end_date < ? AND COALESCE(l.status, 'belum_dibuat') <> 'selesai' ${divisionClause}`)
    .bind(...(user.role === "kadiv" ? [today, user.divisionId] : [today])).all<{ programId: number; title: string }>();
  const statements = [
    ...tasks.results.map((task) => db().prepare(`INSERT OR IGNORE INTO notifications (user_id, program_id, type, title, message, dedupe_key)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(user.id, task.programId, task.dueDate < today ? "overdue" : "deadline", task.dueDate < today ? "Tugas terlambat" : "Tenggat mendekat", `${task.title} · ${task.programTitle} · ${task.dueDate}`, `task:${task.id}:${task.dueDate < today ? "overdue" : "soon"}:${today}:${user.id}`)),
    ...lpjs.results.map((item) => db().prepare(`INSERT OR IGNORE INTO notifications (user_id, program_id, type, title, message, dedupe_key)
      VALUES (?, ?, 'lpj', 'LPJ belum selesai', ?, ?)`).bind(user.id, item.programId, item.title, `lpj:${item.programId}:${today}:${user.id}`)),
  ];
  if (statements.length) await db().batch(statements);
}

export async function getUnreadNotificationCount(userId: number) {
  const unread = await db().prepare(`SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0`)
    .bind(userId).first<{ total: number }>();
  return Number(unread?.total ?? 0);
}

export async function getNotificationCenter(user: AccessUser, notificationLimit = 30, activityLimit = 50) {
  await ensureReminderNotifications(user);
  const safeNotificationLimit = Number.isFinite(notificationLimit) ? Math.min(Math.max(Math.trunc(notificationLimit), 1), 100) : 30;
  const safeActivityLimit = Number.isFinite(activityLimit) ? Math.min(Math.max(Math.trunc(activityLimit), 1), 150) : 50;
  const [notifications, unread, activities] = await Promise.all([
    db().prepare(`SELECT n.id, n.program_id AS programId, n.type, n.title, n.message, n.is_read AS isRead,
      n.created_at AS createdAt, p.program_code AS programCode, p.title AS programTitle
      FROM notifications n LEFT JOIN programs p ON p.id = n.program_id WHERE n.user_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ?`).bind(user.id, safeNotificationLimit + 1).all(),
    db().prepare(`SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0`).bind(user.id).first<{ total: number }>(),
    db().prepare(`SELECT a.id, a.action, a.description, a.created_at AS createdAt,
      COALESCE(u.name, 'Sistem') AS actorName, p.id AS programId, p.program_code AS programCode,
      p.title AS programTitle, d.name AS divisionName
      FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN programs p ON a.entity_type = 'program' AND CAST(a.entity_id AS INTEGER) = p.id
      LEFT JOIN divisions d ON d.id = p.division_id
      WHERE a.entity_type = 'program' AND (? <> 'kadiv' OR p.division_id = ?)
      ORDER BY a.created_at DESC, a.id DESC LIMIT ?`).bind(user.role, user.divisionId, safeActivityLimit + 1).all(),
  ]);
  return {
    notifications: notifications.results.slice(0, safeNotificationLimit),
    unreadCount: Number(unread?.total ?? 0),
    activities: activities.results.slice(0, safeActivityLimit),
    hasMoreNotifications: notifications.results.length > safeNotificationLimit,
    hasMoreActivities: activities.results.length > safeActivityLimit,
  };
}

export async function markNotification(userId: number, id?: number) {
  if (id) return db().prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).bind(id, userId).run();
  return db().prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).bind(userId).run();
}
