import { env } from "cloudflare:workers";

export const USER_ROLES = ["ketua_ksb", "bendahara", "kadiv", "viewer"] as const;
export type UserRole = typeof USER_ROLES[number];

export const PROGRAM_STATUSES = [
  "draft", "pending_approval", "approved", "revision_required", "rejected",
] as const;

export const PROGRAM_TASK_STATUSES = [
  "belum_mulai", "proses", "selesai", "tertunda",
] as const;

export const DIVISION_MASTER = [
  { code: "EDU", name: "Edukasi" },
  { code: "PED", name: "TDA Peduli" },
  { code: "MRC", name: "Marcomm" },
  { code: "GEN", name: "Gen TDA" },
  { code: "KSE", name: "Kerjasama Eksternal" },
  { code: "FUN", name: "TDA Fun" },
  { code: "PAD", name: "Pelayanan Anggota & Data" },
  { code: "PER", name: "TDA Perempuan" },
  { code: "EVT", name: "TDA Event" },
] as const;

export type ProgramSummary = {
  total: number;
  pendingApproval: number;
  approved: number;
  revisionRequired: number;
  rejected: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  averageProgress: number;
  totalBudget: number;
};

export type ProgramReportRecord = ProgramRecord & {
  overdueTaskCount: number;
  nearestDueDate: string;
};

export type DivisionReportRecord = {
  id: number;
  code: string;
  name: string;
  totalPrograms: number;
  approvedPrograms: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  averageProgress: number;
  totalBudget: number;
  kpiCount: number;
  achievedKpiCount: number;
  averageOutcomeProgress: number;
};

export type ProgramRecord = {
  id: number;
  programCode: string;
  periodId: number;
  periodName: string;
  divisionId: number;
  divisionCode: string;
  divisionName: string;
  title: string;
  summary: string;
  pic: string;
  startDate: string;
  endDate: string;
  target: string;
  budget: number;
  incomeBudget: number;
  status: typeof PROGRAM_STATUSES[number];
  taskCount: number;
  completedTaskCount: number;
  progress: number;
  kpiCount: number;
  measuredKpiCount: number;
  achievedKpiCount: number;
  outcomeProgress: number;
  outcomeStatus: "belum_diukur" | "belum_tercapai" | "sebagian" | "tercapai";
  realizedAmount: number;
  remainingBudget: number;
  lpjStatus: "belum_dibuat" | "proses" | "diajukan" | "selesai";
  realizedIncome: number;
  assignedDivisionIds: string;
  assignedDivisionNames: string;
  surplusDeficit: number;
  createdAt: string;
  updatedAt: string;
};

export type ProgramInput = {
  divisionId: number;
  title: string;
  summary: string;
  pic: string;
  startDate: string;
  endDate: string;
  target: string;
  budget: number;
  status: typeof PROGRAM_STATUSES[number];
};

export type ProgramTaskRecord = {
  id: number;
  programId: number;
  title: string;
  pic: string;
  dueDate: string;
  status: typeof PROGRAM_TASK_STATUSES[number];
  notes: string;
  usesBudget: number;
  budgetAmount: number;
  incomeTarget: number;
  realizedExpense: number;
  realizedIncome: number;
  createdAt: string;
  updatedAt: string;
};

export type ProgramTaskInput = Pick<ProgramTaskRecord, "title" | "pic" | "dueDate" | "status" | "notes" | "budgetAmount" | "incomeTarget"> & {
  usesBudget: boolean; assignedDivisionIds: number[];
};

export type ApprovalHistoryRecord = {
  id: number;
  programId: number;
  actorName: string;
  actorRole: UserRole | null;
  status: "submitted" | "approved" | "revision_required" | "rejected";
  note: string;
  sequence: number;
  createdAt: string;
};

export type CalendarEventRecord = {
  id: string;
  type: "program_start" | "program_end" | "task_due";
  date: string;
  title: string;
  programId: number;
  programCode: string;
  programTitle: string;
  divisionId: number;
  divisionCode: string;
  divisionName: string;
  programStatus: typeof PROGRAM_STATUSES[number];
  taskStatus: typeof PROGRAM_TASK_STATUSES[number] | null;
};

function getD1() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

export function buildProgramCode(year: number, sequence: number) {
  return `PRG-${year}-${String(sequence).padStart(4, "0")}`;
}

let foundationPromise: Promise<void> | null = null;

export async function nextProgramCode(year = new Date().getUTCFullYear()) {
  const prefix = `PRG-${year}-`;
  const row = await getD1().prepare(`SELECT COALESCE(MAX(CAST(SUBSTR(program_code, 10) AS INTEGER)), 0) AS lastSequence
    FROM programs WHERE program_code LIKE ?`).bind(`${prefix}%`).first<{ lastSequence: number }>();
  return buildProgramCode(year, Number(row?.lastSequence ?? 0) + 1);
}

export async function ensureProgramFoundation() {
  if (!foundationPromise) {
    foundationPromise = (async () => {
      const db = getD1();
      const [divisionState, periodState] = await Promise.all([
        db.prepare(`SELECT COUNT(*) AS total FROM divisions`).first<{ total: number }>(),
        db.prepare(`SELECT id FROM periods WHERE name = 'TDA Pekanbaru 9.0 · 2026–2029' LIMIT 1`).first<{ id: number }>(),
      ]);
      if (Number(divisionState?.total ?? 0) < DIVISION_MASTER.length) {
        await db.batch(DIVISION_MASTER.map((division, index) => db.prepare(`INSERT OR IGNORE INTO divisions
          (code, name, sort_order, is_active) VALUES (?, ?, ?, 1)`).bind(division.code, division.name, index + 1)));
      }
      if (!periodState) {
        await db.prepare(`INSERT OR IGNORE INTO periods (name, start_date, end_date, is_active)
          VALUES ('TDA Pekanbaru 9.0 · 2026–2029', '2026-07-23', '2029-07-22', 1)`).run();
      }
    })().catch((reason) => {
      foundationPromise = null;
      throw reason;
    });
  }
  return foundationPromise;
}

export async function getProgramDashboard() {
  await ensureProgramFoundation();
  const db = getD1();
  const today = new Date().toISOString().slice(0, 10);
  const [counts, divisions, period] = await Promise.all([
    db.prepare(`WITH task_stats AS (
      SELECT program_id,
        COUNT(*) AS task_count,
        SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS completed_count
      FROM program_tasks GROUP BY program_id
    ) SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END) AS pendingApproval,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'revision_required' THEN 1 ELSE 0 END) AS revisionRequired,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      (SELECT COUNT(*) FROM program_tasks) AS totalTasks,
      (SELECT COUNT(*) FROM program_tasks WHERE status = 'selesai') AS completedTasks,
      (SELECT COUNT(*) FROM program_tasks WHERE due_date <> '' AND due_date < ? AND status <> 'selesai') AS overdueTasks,
      COALESCE(ROUND(AVG(CASE WHEN COALESCE(ts.task_count, 0) = 0 THEN 0 ELSE 100.0 * ts.completed_count / ts.task_count END)), 0) AS averageProgress,
      COALESCE(SUM(budget), 0) AS totalBudget
      FROM programs p LEFT JOIN task_stats ts ON ts.program_id = p.id`).bind(today).first<ProgramSummary>(),
    db.prepare(`WITH task_stats AS (
      SELECT program_id, COUNT(*) AS task_count,
        SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS completed_count
      FROM program_tasks GROUP BY program_id
    ), division_stats AS (
      SELECT p.division_id,
        COUNT(*) AS total_programs,
        SUM(CASE WHEN COALESCE(ts.task_count, 0) > 0
          AND ts.completed_count = ts.task_count THEN 1 ELSE 0 END) AS completed_programs
      FROM programs p LEFT JOIN task_stats ts ON ts.program_id = p.id
      GROUP BY p.division_id
    ) SELECT d.id, d.code, d.name, d.sort_order AS sortOrder,
      COALESCE(ds.total_programs, 0) AS totalPrograms,
      COALESCE(ds.completed_programs, 0) AS completedPrograms
      FROM divisions d LEFT JOIN division_stats ds ON ds.division_id = d.id
      WHERE d.is_active = 1 ORDER BY d.sort_order, d.id`).all<{
        id: number; code: string; name: string; sortOrder: number;
        totalPrograms: number; completedPrograms: number;
      }>(),
    db.prepare(`SELECT id, name, start_date AS startDate, end_date AS endDate
      FROM periods WHERE is_active = 1 ORDER BY id DESC LIMIT 1`).first<{ id: number; name: string; startDate: string; endDate: string }>(),
  ]);
  return {
    summary: {
      total: Number(counts?.total ?? 0),
      pendingApproval: Number(counts?.pendingApproval ?? 0),
      approved: Number(counts?.approved ?? 0),
      revisionRequired: Number(counts?.revisionRequired ?? 0),
      rejected: Number(counts?.rejected ?? 0),
      totalTasks: Number(counts?.totalTasks ?? 0),
      completedTasks: Number(counts?.completedTasks ?? 0),
      overdueTasks: Number(counts?.overdueTasks ?? 0),
      averageProgress: Number(counts?.averageProgress ?? 0),
      totalBudget: Number(counts?.totalBudget ?? 0),
    },
    divisions: divisions.results,
    period,
    nextProgramCode: await nextProgramCode(2026),
  };
}

const programSelect = `WITH task_stats AS (
    SELECT program_id, COUNT(*) AS task_count,
      SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS completed_count
    FROM program_tasks GROUP BY program_id
  ), expense_stats AS (
    SELECT program_id, SUM(amount) AS realized_amount FROM program_expenses GROUP BY program_id
  ), income_stats AS (
    SELECT program_id, SUM(amount) AS realized_income FROM program_incomes GROUP BY program_id
  ), evaluation_stats AS (
    SELECT program_id, COUNT(*) AS kpi_count,
      SUM(CASE WHEN is_measured = 1 THEN 1 ELSE 0 END) AS measured_kpi_count,
      SUM(CASE WHEN is_measured = 1 AND actual_value >= target_value THEN 1 ELSE 0 END) AS achieved_kpi_count,
      COALESCE(ROUND(AVG(CASE WHEN is_measured = 1
        THEN MIN(100, 100.0 * actual_value / target_value) END)), 0) AS outcome_progress
    FROM program_evaluations GROUP BY program_id
  ) SELECT p.id, p.program_code AS programCode,
  p.period_id AS periodId, pe.name AS periodName,
  p.division_id AS divisionId, d.code AS divisionCode, d.name AS divisionName,
  p.title, p.summary, p.pic, p.start_date AS startDate, p.end_date AS endDate,
  p.target, p.budget, p.income_budget AS incomeBudget, p.status,
  COALESCE(ts.task_count, 0) AS taskCount,
  COALESCE(ts.completed_count, 0) AS completedTaskCount,
  CASE WHEN COALESCE(ts.task_count, 0) = 0 THEN 0
    ELSE ROUND(100.0 * ts.completed_count / ts.task_count) END AS progress,
  COALESCE(evs.kpi_count, 0) AS kpiCount,
  COALESCE(evs.measured_kpi_count, 0) AS measuredKpiCount,
  COALESCE(evs.achieved_kpi_count, 0) AS achievedKpiCount,
  COALESCE(evs.outcome_progress, 0) AS outcomeProgress,
  CASE WHEN COALESCE(evs.measured_kpi_count, 0) = 0 THEN 'belum_diukur'
    WHEN evs.achieved_kpi_count = evs.kpi_count THEN 'tercapai'
    WHEN COALESCE(evs.outcome_progress, 0) > 0 THEN 'sebagian'
    ELSE 'belum_tercapai' END AS outcomeStatus,
  COALESCE(es.realized_amount, 0) AS realizedAmount,
  p.budget - COALESCE(es.realized_amount, 0) AS remainingBudget,
  COALESCE(pl.status, 'belum_dibuat') AS lpjStatus,
  COALESCE(ins.realized_income, 0) AS realizedIncome,
  COALESCE(ins.realized_income, 0) - COALESCE(es.realized_amount, 0) AS surplusDeficit,
  p.created_at AS createdAt, p.updated_at AS updatedAt
  FROM programs p
  JOIN periods pe ON pe.id = p.period_id
  JOIN divisions d ON d.id = p.division_id
  LEFT JOIN task_stats ts ON ts.program_id = p.id
  LEFT JOIN expense_stats es ON es.program_id = p.id
  LEFT JOIN income_stats ins ON ins.program_id = p.id
  LEFT JOIN evaluation_stats evs ON evs.program_id = p.id
  LEFT JOIN program_lpj pl ON pl.program_id = p.id`;

export async function listPrograms() {
  await ensureProgramFoundation();
  const result = await getD1().prepare(`${programSelect}
    ORDER BY p.updated_at DESC, p.id DESC`).all<ProgramRecord>();
  return result.results;
}

export async function getProgram(id: number) {
  return getD1().prepare(`${programSelect} WHERE p.id = ? LIMIT 1`).bind(id).first<ProgramRecord>();
}

async function activePeriodId() {
  await ensureProgramFoundation();
  const row = await getD1().prepare(`SELECT id FROM periods WHERE is_active = 1
    ORDER BY id DESC LIMIT 1`).first<{ id: number }>();
  if (!row) throw new Error("Periode aktif belum tersedia");
  return row.id;
}

export async function divisionExists(id: number) {
  const row = await getD1().prepare(`SELECT id FROM divisions WHERE id = ? AND is_active = 1 LIMIT 1`)
    .bind(id).first<{ id: number }>();
  return Boolean(row);
}

export async function createProgram(input: ProgramInput) {
  const db = getD1();
  const periodId = await activePeriodId();
  const programCode = await nextProgramCode(2026);
  const result = await db.prepare(`INSERT INTO programs
    (program_code, period_id, division_id, title, summary, pic, start_date, end_date, target, budget, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(programCode, periodId, input.divisionId, input.title, input.summary, input.pic,
      input.startDate, input.endDate, input.target, input.budget, input.status).run();
  return getProgram(Number(result.meta.last_row_id));
}

export async function updateProgram(id: number, input: ProgramInput) {
  const result = await getD1().prepare(`UPDATE programs SET division_id = ?, title = ?, summary = ?, pic = ?,
    start_date = ?, end_date = ?, target = ?, budget = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(input.divisionId, input.title, input.summary, input.pic, input.startDate, input.endDate,
      input.target, input.budget, input.status, id).run();
  if (!result.meta.changes) return null;
  return getProgram(id);
}

export async function deleteProgram(id: number) {
  const db = getD1();
  const existing = await getProgram(id);
  if (!existing) return false;
  await db.batch([
    db.prepare(`DELETE FROM program_feedback_answers WHERE submission_id IN (SELECT id FROM program_feedback_submissions WHERE program_id = ?)` ).bind(id),
    db.prepare(`DELETE FROM program_feedback_submissions WHERE program_id = ?`).bind(id),
    db.prepare(`DELETE FROM program_feedback_questions WHERE program_id = ?`).bind(id),
    db.prepare(`DELETE FROM program_task_divisions WHERE task_id IN (SELECT id FROM program_tasks WHERE program_id = ?)` ).bind(id),
    db.prepare(`DELETE FROM program_tasks WHERE program_id = ?`).bind(id),
    db.prepare(`DELETE FROM program_approvals WHERE program_id = ?`).bind(id),
    db.prepare(`DELETE FROM program_expenses WHERE program_id = ?`).bind(id),
    db.prepare(`DELETE FROM program_incomes WHERE program_id = ?`).bind(id),
    db.prepare(`DELETE FROM program_evaluations WHERE program_id = ?`).bind(id),
    db.prepare(`DELETE FROM program_lpj WHERE program_id = ?`).bind(id),
    db.prepare(`DELETE FROM programs WHERE id = ?`).bind(id),
  ]);
  return true;
}

const taskSelect = `SELECT pt.id, pt.program_id AS programId, pt.title, pt.pic, pt.due_date AS dueDate,
  pt.status, pt.notes, pt.uses_budget AS usesBudget, pt.budget_amount AS budgetAmount,
  pt.income_target AS incomeTarget,
  COALESCE((SELECT SUM(amount) FROM program_expenses WHERE task_id = pt.id), 0) AS realizedExpense,
  COALESCE((SELECT SUM(amount) FROM program_incomes WHERE task_id = pt.id), 0) AS realizedIncome,
  COALESCE((SELECT GROUP_CONCAT(division_id) FROM program_task_divisions WHERE task_id = pt.id), '') AS assignedDivisionIds,
  COALESCE((SELECT GROUP_CONCAT(d.name, ', ') FROM program_task_divisions ptd JOIN divisions d ON d.id = ptd.division_id WHERE ptd.task_id = pt.id), '') AS assignedDivisionNames,
  pt.created_at AS createdAt, pt.updated_at AS updatedAt FROM program_tasks pt`;

export async function listProgramTasks(programId: number) {
  const result = await getD1().prepare(`${taskSelect} WHERE pt.program_id = ?
    ORDER BY CASE status WHEN 'proses' THEN 1 WHEN 'belum_mulai' THEN 2 WHEN 'tertunda' THEN 3 ELSE 4 END,
    CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date, pt.id`).bind(programId).all<ProgramTaskRecord>();
  return result.results;
}

export async function getProgramTask(id: number, programId: number) {
  return getD1().prepare(`${taskSelect} WHERE pt.id = ? AND pt.program_id = ? LIMIT 1`)
    .bind(id, programId).first<ProgramTaskRecord>();
}

export async function createProgramTask(programId: number, input: ProgramTaskInput) {
  const db = getD1();
  const result = await db.prepare(`INSERT INTO program_tasks
    (program_id, title, pic, due_date, status, notes, uses_budget, budget_amount, income_target, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(programId, input.title, input.pic, input.dueDate, input.status, input.notes,
      input.usesBudget ? 1 : 0, input.usesBudget ? input.budgetAmount : 0, input.incomeTarget).run();
  const taskId = Number(result.meta.last_row_id);
  if (input.assignedDivisionIds.length) await db.batch(input.assignedDivisionIds.map((divisionId) => db.prepare(`INSERT OR IGNORE INTO program_task_divisions (task_id, division_id) VALUES (?, ?)`).bind(taskId, divisionId)));
  await notifyAssignedDivisions(taskId, programId, input.title, input.assignedDivisionIds);
  await db.prepare(`UPDATE programs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(programId).run();
  return getProgramTask(taskId, programId);
}

export async function updateProgramTask(id: number, programId: number, input: ProgramTaskInput) {
  const db = getD1();
  const result = await db.prepare(`UPDATE program_tasks SET title = ?, pic = ?, due_date = ?,
    status = ?, notes = ?, uses_budget = ?, budget_amount = ?, income_target = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ? AND program_id = ?`)
    .bind(input.title, input.pic, input.dueDate, input.status, input.notes,
      input.usesBudget ? 1 : 0, input.usesBudget ? input.budgetAmount : 0, input.incomeTarget, id, programId).run();
  if (!result.meta.changes) return null;
  await db.prepare(`DELETE FROM program_task_divisions WHERE task_id = ?`).bind(id).run();
  if (input.assignedDivisionIds.length) await db.batch(input.assignedDivisionIds.map((divisionId) => db.prepare(`INSERT OR IGNORE INTO program_task_divisions (task_id, division_id) VALUES (?, ?)`).bind(id, divisionId)));
  await notifyAssignedDivisions(id, programId, input.title, input.assignedDivisionIds);
  await db.prepare(`UPDATE programs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(programId).run();
  return getProgramTask(id, programId);
}

export async function deleteProgramTask(id: number, programId: number) {
  const db = getD1();
  await db.prepare(`UPDATE program_expenses SET task_id = NULL WHERE task_id = ?`).bind(id).run();
  await db.prepare(`UPDATE program_incomes SET task_id = NULL WHERE task_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM program_task_divisions WHERE task_id = ?`).bind(id).run();
  const result = await db.prepare(`DELETE FROM program_tasks WHERE id = ? AND program_id = ?`).bind(id, programId).run();
  if (!result.meta.changes) return false;
  await db.prepare(`UPDATE programs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(programId).run();
  return true;
}

async function notifyAssignedDivisions(taskId: number, programId: number, title: string, divisionIds: number[]) {
  if (!divisionIds.length) return;
  const db = getD1();
  const placeholders = divisionIds.map(() => "?").join(",");
  const users = await db.prepare(`SELECT id FROM users WHERE is_active = 1 AND division_id IN (${placeholders})`).bind(...divisionIds).all<{ id: number }>();
  const program = await db.prepare(`SELECT program_code AS programCode, title FROM programs WHERE id = ?`).bind(programId).first<{ programCode: string; title: string }>();
  if (!program || !users.results.length) return;
  await db.batch(users.results.map((user) => db.prepare(`INSERT OR IGNORE INTO notifications
    (user_id, program_id, type, title, message, dedupe_key) VALUES (?, ?, 'task_assignment', ?, ?, ?)`)
    .bind(user.id, programId, "Divisi Anda mendapat pekerjaan baru", `${program.programCode} · ${program.title}: ${title}`, `task-assignment:${taskId}:${user.id}`)));
}

export async function listProgramApprovals(programId: number) {
  const result = await getD1().prepare(`SELECT pa.id, pa.program_id AS programId,
    COALESCE(u.name, 'Sistem') AS actorName, u.role AS actorRole, pa.status,
    pa.note, pa.sequence, pa.created_at AS createdAt
    FROM program_approvals pa LEFT JOIN users u ON u.id = pa.approver_user_id
    WHERE pa.program_id = ? ORDER BY pa.sequence DESC, pa.id DESC`)
    .bind(programId).all<ApprovalHistoryRecord>();
  return result.results;
}

export async function recordProgramApproval(
  programId: number,
  actorUserId: number,
  action: ApprovalHistoryRecord["status"],
  note: string,
  nextStatus: typeof PROGRAM_STATUSES[number],
) {
  const db = getD1();
  const row = await db.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
    FROM program_approvals WHERE program_id = ?`).bind(programId).first<{ sequence: number }>();
  await db.batch([
    db.prepare(`UPDATE programs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(nextStatus, programId),
    db.prepare(`INSERT INTO program_approvals
      (program_id, approver_user_id, status, note, sequence, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(programId, actorUserId, action, note, Number(row?.sequence ?? 1)),
  ]);
  return getProgram(programId);
}

export async function listCalendarEvents(startDate: string, endDate: string) {
  await ensureProgramFoundation();
  const result = await getD1().prepare(`SELECT 'program_start:' || p.id AS id,
    'program_start' AS type, p.start_date AS date, p.title AS title,
    p.id AS programId, p.program_code AS programCode, p.title AS programTitle,
    p.division_id AS divisionId, d.code AS divisionCode, d.name AS divisionName,
    p.status AS programStatus, NULL AS taskStatus
    FROM programs p JOIN divisions d ON d.id = p.division_id WHERE p.start_date >= ? AND p.start_date < ?
    UNION ALL
    SELECT 'program_end:' || p.id AS id, 'program_end' AS type,
    p.end_date AS date, p.title AS title, p.id AS programId,
    p.program_code AS programCode, p.title AS programTitle,
    p.division_id AS divisionId, d.code AS divisionCode, d.name AS divisionName,
    p.status AS programStatus, NULL AS taskStatus
    FROM programs p JOIN divisions d ON d.id = p.division_id WHERE p.end_date >= ? AND p.end_date < ?
    UNION ALL
    SELECT 'task_due:' || pt.id AS id, 'task_due' AS type, pt.due_date AS date,
    pt.title AS title, p.id AS programId, p.program_code AS programCode,
    p.title AS programTitle, p.division_id AS divisionId, d.code AS divisionCode,
    d.name AS divisionName, p.status AS programStatus, pt.status AS taskStatus
    FROM program_tasks pt JOIN programs p ON p.id = pt.program_id
    JOIN divisions d ON d.id = p.division_id WHERE pt.due_date >= ? AND pt.due_date < ?
    ORDER BY date, programCode, id`).bind(startDate, endDate, startDate, endDate, startDate, endDate).all<CalendarEventRecord>();
  return result.results;
}

export async function getProgramReport() {
  await ensureProgramFoundation();
  const db = getD1();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 7);
  const dueSoon = soon.toISOString().slice(0, 10);

  const [summary, kpiSummary, statuses, divisions, divisionKpis, programs, period] = await Promise.all([
    db.prepare(`SELECT
      COUNT(*) AS totalPrograms,
      COALESCE(SUM(budget), 0) AS totalBudget,
      COALESCE(ROUND(AVG(CASE WHEN task_count = 0 THEN 0 ELSE 100.0 * completed_count / task_count END)), 0) AS averageProgress,
      COALESCE(SUM(task_count), 0) AS totalTasks,
      COALESCE(SUM(completed_count), 0) AS completedTasks,
      COALESCE(SUM(overdue_count), 0) AS overdueTasks,
      COALESCE(SUM(due_soon_count), 0) AS dueSoonTasks
      FROM (SELECT p.*,
        (SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id AND pt.status = 'selesai') AS completed_count,
        (SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id AND pt.due_date <> '' AND pt.due_date < ? AND pt.status <> 'selesai') AS overdue_count,
        (SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id AND pt.due_date BETWEEN ? AND ? AND pt.status <> 'selesai') AS due_soon_count
        FROM programs p)`).bind(today, today, dueSoon).first<Record<string, number>>(),
    db.prepare(`SELECT COUNT(*) AS kpiCount,
      COALESCE(SUM(CASE WHEN is_measured = 1 AND actual_value >= target_value THEN 1 ELSE 0 END), 0) AS achievedKpiCount,
      COALESCE(ROUND(AVG(CASE WHEN is_measured = 1
        THEN MIN(100, 100.0 * actual_value / target_value) END), 0), 0) AS averageOutcomeProgress
      FROM program_evaluations`).first<Record<string, number>>(),
    db.prepare(`SELECT status, COUNT(*) AS total FROM programs GROUP BY status`).all<{ status: string; total: number }>(),
    db.prepare(`SELECT d.id, d.code, d.name,
      COUNT(p.id) AS totalPrograms,
      SUM(CASE WHEN p.status = 'approved' THEN 1 ELSE 0 END) AS approvedPrograms,
      COALESCE(SUM((SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id)), 0) AS totalTasks,
      COALESCE(SUM((SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id AND pt.status = 'selesai')), 0) AS completedTasks,
      COALESCE(SUM((SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id AND pt.due_date <> '' AND pt.due_date < ? AND pt.status <> 'selesai')), 0) AS overdueTasks,
      COALESCE(ROUND(AVG(CASE
        WHEN (SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id) = 0 THEN 0
        ELSE 100.0 * (SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id AND pt.status = 'selesai') /
          (SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id) END)), 0) AS averageProgress,
      COALESCE(SUM(p.budget), 0) AS totalBudget
      FROM divisions d LEFT JOIN programs p ON p.division_id = d.id
      WHERE d.is_active = 1 GROUP BY d.id, d.code, d.name, d.sort_order
      ORDER BY d.sort_order, d.id`).bind(today).all<DivisionReportRecord>(),
    db.prepare(`SELECT p.division_id AS divisionId, COUNT(ev.id) AS kpiCount,
      COALESCE(SUM(CASE WHEN ev.is_measured = 1 AND ev.actual_value >= ev.target_value THEN 1 ELSE 0 END), 0) AS achievedKpiCount,
      COALESCE(ROUND(AVG(CASE WHEN ev.is_measured = 1
        THEN MIN(100, 100.0 * ev.actual_value / ev.target_value) END), 0), 0) AS averageOutcomeProgress
      FROM programs p LEFT JOIN program_evaluations ev ON ev.program_id = p.id
      GROUP BY p.division_id`).all<{ divisionId: number; kpiCount: number; achievedKpiCount: number; averageOutcomeProgress: number }>(),
    db.prepare(`${programSelect.replace("p.created_at AS createdAt, p.updated_at AS updatedAt", `
      (SELECT COUNT(*) FROM program_tasks pt WHERE pt.program_id = p.id AND pt.due_date <> '' AND pt.due_date < ? AND pt.status <> 'selesai') AS overdueTaskCount,
      COALESCE((SELECT MIN(pt.due_date) FROM program_tasks pt WHERE pt.program_id = p.id AND pt.due_date <> '' AND pt.status <> 'selesai'), '') AS nearestDueDate,
      p.created_at AS createdAt, p.updated_at AS updatedAt`)}
      ORDER BY p.updated_at DESC, p.id DESC`).bind(today).all<ProgramReportRecord>(),
    db.prepare(`SELECT id, name, start_date AS startDate, end_date AS endDate
      FROM periods WHERE is_active = 1 ORDER BY id DESC LIMIT 1`).first<{ id: number; name: string; startDate: string; endDate: string }>(),
  ]);

  return {
    summary: {
      totalPrograms: Number(summary?.totalPrograms ?? 0),
      totalBudget: Number(summary?.totalBudget ?? 0),
      averageProgress: Number(summary?.averageProgress ?? 0),
      totalTasks: Number(summary?.totalTasks ?? 0),
      completedTasks: Number(summary?.completedTasks ?? 0),
      overdueTasks: Number(summary?.overdueTasks ?? 0),
      dueSoonTasks: Number(summary?.dueSoonTasks ?? 0),
      kpiCount: Number(kpiSummary?.kpiCount ?? 0),
      achievedKpiCount: Number(kpiSummary?.achievedKpiCount ?? 0),
      averageOutcomeProgress: Number(kpiSummary?.averageOutcomeProgress ?? 0),
    },
    statuses: statuses.results.map((row) => ({ status: row.status, total: Number(row.total) })),
    divisions: divisions.results.map((row) => {
      const kpi = divisionKpis.results.find((item) => Number(item.divisionId) === Number(row.id));
      return {
      ...row,
      totalPrograms: Number(row.totalPrograms),
      approvedPrograms: Number(row.approvedPrograms),
      totalTasks: Number(row.totalTasks),
      completedTasks: Number(row.completedTasks),
      overdueTasks: Number(row.overdueTasks),
      averageProgress: Number(row.averageProgress),
      totalBudget: Number(row.totalBudget),
      kpiCount: Number(kpi?.kpiCount ?? 0),
      achievedKpiCount: Number(kpi?.achievedKpiCount ?? 0),
      averageOutcomeProgress: Number(kpi?.averageOutcomeProgress ?? 0),
    }; }),
    programs: programs.results.map((row) => ({
      ...row,
      taskCount: Number(row.taskCount),
      completedTaskCount: Number(row.completedTaskCount),
      progress: Number(row.progress),
      kpiCount: Number(row.kpiCount),
      measuredKpiCount: Number(row.measuredKpiCount),
      achievedKpiCount: Number(row.achievedKpiCount),
      outcomeProgress: Number(row.outcomeProgress),
      overdueTaskCount: Number(row.overdueTaskCount),
      budget: Number(row.budget),
    })),
    period,
    generatedAt: new Date().toISOString(),
  };
}
