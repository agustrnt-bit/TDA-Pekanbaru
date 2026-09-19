import { env } from "cloudflare:workers";

export const LPJ_STATUSES = ["belum_dibuat", "proses", "diajukan", "selesai"] as const;
export type LpjStatus = typeof LPJ_STATUSES[number];

export type ProgramExpense = {
  id: number; programId: number; description: string; category: string; expenseDate: string;
  amount: number; receiptKey: string | null; receiptName: string | null; receiptType: string | null;
  createdByName: string; createdAt: string; updatedAt: string;
  treasuryAccountId: number | null; treasuryAccountName: string;
  taskId: number | null; taskTitle: string;
};

export type ProgramIncome = {
  id: number; programId: number; description: string; source: string; incomeDate: string;
  amount: number; receiptKey: string | null; receiptName: string | null; receiptType: string | null;
  createdByName: string; createdAt: string; updatedAt: string;
  treasuryAccountId: number | null; treasuryAccountName: string;
  taskId: number | null; taskTitle: string;
};

export type ProgramLpj = {
  id: number; programId: number; status: LpjStatus; summary: string; result: string;
  evaluation: string; submittedAt: string | null; completedAt: string | null;
  updatedByName: string; updatedAt: string;
};

function db() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

function bucket() {
  if (!env.BUCKET) throw new Error("Penyimpanan bukti belum tersedia");
  return env.BUCKET;
}

const expenseSelect = `SELECT e.id, e.program_id AS programId, e.description, e.category,
  e.task_id AS taskId, COALESCE(pt.title, 'Transaksi Umum Program') AS taskTitle,
  e.expense_date AS expenseDate, e.amount, e.receipt_key AS receiptKey,
  e.receipt_name AS receiptName, e.receipt_type AS receiptType,
  e.treasury_account_id AS treasuryAccountId, COALESCE(ta.name, 'Rekening Bank 1') AS treasuryAccountName,
  COALESCE(u.name, 'Pengurus') AS createdByName,
  e.created_at AS createdAt, e.updated_at AS updatedAt
  FROM program_expenses e LEFT JOIN users u ON u.id = e.created_by_user_id
  LEFT JOIN program_tasks pt ON pt.id = e.task_id
  LEFT JOIN treasury_accounts ta ON ta.id = e.treasury_account_id`;

const incomeSelect = `SELECT i.id, i.program_id AS programId, i.description, i.source,
  i.task_id AS taskId, COALESCE(pt.title, 'Transaksi Umum Program') AS taskTitle,
  i.income_date AS incomeDate, i.amount, i.receipt_key AS receiptKey,
  i.receipt_name AS receiptName, i.receipt_type AS receiptType,
  i.treasury_account_id AS treasuryAccountId, COALESCE(ta.name, 'Rekening Bank 1') AS treasuryAccountName,
  COALESCE(u.name, 'Pengurus') AS createdByName,
  i.created_at AS createdAt, i.updated_at AS updatedAt
  FROM program_incomes i LEFT JOIN users u ON u.id = i.created_by_user_id
  LEFT JOIN program_tasks pt ON pt.id = i.task_id
  LEFT JOIN treasury_accounts ta ON ta.id = i.treasury_account_id`;

export async function getExpense(id: number, programId: number) {
  return db().prepare(`${expenseSelect} WHERE e.id = ? AND e.program_id = ? LIMIT 1`)
    .bind(id, programId).first<ProgramExpense>();
}

export async function getProgramFinance(programId: number) {
  const [expenses, incomes, lpj] = await Promise.all([
    db().prepare(`${expenseSelect} WHERE e.program_id = ? ORDER BY e.expense_date DESC, e.id DESC`)
      .bind(programId).all<ProgramExpense>(),
    db().prepare(`${incomeSelect} WHERE i.program_id = ? ORDER BY i.income_date DESC, i.id DESC`)
      .bind(programId).all<ProgramIncome>(),
    db().prepare(`SELECT l.id, l.program_id AS programId, l.status, l.summary, l.result,
      l.evaluation, l.submitted_at AS submittedAt, l.completed_at AS completedAt,
      COALESCE(u.name, 'Pengurus') AS updatedByName, l.updated_at AS updatedAt
      FROM program_lpj l LEFT JOIN users u ON u.id = l.updated_by_user_id
      WHERE l.program_id = ? LIMIT 1`).bind(programId).first<ProgramLpj>(),
  ]);
  const normalized = expenses.results.map((row) => ({ ...row, amount: Number(row.amount) }));
  const normalizedIncomes = incomes.results.map((row) => ({ ...row, amount: Number(row.amount) }));
  return {
    expenses: normalized,
    incomes: normalizedIncomes,
    lpj: lpj ?? { id: 0, programId, status: "belum_dibuat", summary: "", result: "", evaluation: "", submittedAt: null, completedAt: null, updatedByName: "", updatedAt: "" },
    realization: normalized.reduce((total, row) => total + row.amount, 0),
    realizedIncome: normalizedIncomes.reduce((total, row) => total + row.amount, 0),
  };
}

export async function updateIncomeBudget(programId: number, amount: number) {
  const result = await db().prepare(`UPDATE programs SET income_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(amount, programId).run();
  return Boolean(result.meta.changes);
}

export async function getIncome(id: number, programId: number) {
  return db().prepare(`${incomeSelect} WHERE i.id = ? AND i.program_id = ? LIMIT 1`).bind(id, programId).first<ProgramIncome>();
}

export async function createIncome(programId: number, userId: number, input: {
  description: string; source: string; incomeDate: string; amount: number;
  receiptKey: string | null; receiptName: string | null; receiptType: string | null;
  treasuryAccountId: number;
  taskId: number | null;
}) {
  const result = await db().prepare(`INSERT INTO program_incomes
    (program_id, task_id, description, source, income_date, amount, treasury_account_id, receipt_key, receipt_name, receipt_type, created_by_user_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(programId, input.taskId, input.description, input.source, input.incomeDate, input.amount,
      input.treasuryAccountId, input.receiptKey, input.receiptName, input.receiptType, userId).run();
  return getIncome(Number(result.meta.last_row_id), programId);
}

export async function deleteIncome(id: number, programId: number) {
  const income = await getIncome(id, programId); if (!income) return false;
  const result = await db().prepare(`DELETE FROM program_incomes WHERE id = ? AND program_id = ?`).bind(id, programId).run();
  if (result.meta.changes && income.receiptKey) await bucket().delete(income.receiptKey);
  return Boolean(result.meta.changes);
}

export async function createExpense(programId: number, userId: number, input: {
  description: string; category: string; expenseDate: string; amount: number;
  receiptKey: string | null; receiptName: string | null; receiptType: string | null;
  treasuryAccountId: number;
  taskId: number | null;
}) {
  const result = await db().prepare(`INSERT INTO program_expenses
    (program_id, task_id, description, category, expense_date, amount, treasury_account_id, receipt_key, receipt_name, receipt_type, created_by_user_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(programId, input.taskId, input.description, input.category, input.expenseDate, input.amount,
      input.treasuryAccountId, input.receiptKey, input.receiptName, input.receiptType, userId).run();
  return getExpense(Number(result.meta.last_row_id), programId);
}

export async function updateExpense(id: number, programId: number, input: {
  description: string; category: string; expenseDate: string; amount: number;
}) {
  const result = await db().prepare(`UPDATE program_expenses SET description = ?, category = ?,
    expense_date = ?, amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND program_id = ?`)
    .bind(input.description, input.category, input.expenseDate, input.amount, id, programId).run();
  return result.meta.changes ? getExpense(id, programId) : null;
}

export async function deleteExpense(id: number, programId: number) {
  const expense = await getExpense(id, programId);
  if (!expense) return false;
  const result = await db().prepare(`DELETE FROM program_expenses WHERE id = ? AND program_id = ?`).bind(id, programId).run();
  if (result.meta.changes && expense.receiptKey) await bucket().delete(expense.receiptKey);
  return Boolean(result.meta.changes);
}

export async function saveReceipt(programId: number, file: File) {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) : "bin";
  const key = `program-finance/${programId}/${crypto.randomUUID()}.${extension || "bin"}`;
  await bucket().put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return key;
}

export async function deleteReceipt(key: string) {
  await bucket().delete(key);
}

export async function getReceipt(key: string) {
  return bucket().get(key);
}

export async function upsertLpj(programId: number, userId: number, input: {
  status: LpjStatus; summary: string; result: string; evaluation: string;
}) {
  await db().prepare(`INSERT INTO program_lpj
    (program_id, status, summary, result, evaluation, submitted_at, completed_at, updated_by_user_id, updated_at)
    VALUES (?, ?, ?, ?, ?, CASE WHEN ? IN ('diajukan', 'selesai') THEN datetime('now') ELSE NULL END,
      CASE WHEN ? = 'selesai' THEN datetime('now') ELSE NULL END, ?, datetime('now'))
    ON CONFLICT(program_id) DO UPDATE SET status = excluded.status, summary = excluded.summary,
      result = excluded.result, evaluation = excluded.evaluation,
      submitted_at = CASE WHEN excluded.status IN ('diajukan', 'selesai') THEN COALESCE(program_lpj.submitted_at, datetime('now')) ELSE program_lpj.submitted_at END,
      completed_at = CASE WHEN excluded.status = 'selesai' THEN COALESCE(program_lpj.completed_at, datetime('now')) ELSE NULL END,
      updated_by_user_id = excluded.updated_by_user_id, updated_at = datetime('now')`)
    .bind(programId, input.status, input.summary, input.result, input.evaluation,
      input.status, input.status, userId).run();
  return (await getProgramFinance(programId)).lpj;
}

export async function listProgramReceiptKeys(programId: number) {
  const result = await db().prepare(`SELECT receipt_key AS receiptKey FROM program_expenses
    WHERE program_id = ? AND receipt_key IS NOT NULL
    UNION ALL SELECT receipt_key AS receiptKey FROM program_incomes
    WHERE program_id = ? AND receipt_key IS NOT NULL`).bind(programId, programId).all<{ receiptKey: string }>();
  return result.results.map((row) => row.receiptKey);
}

export async function deleteReceiptKeys(keys: string[]) {
  if (keys.length) await bucket().delete(keys);
}
