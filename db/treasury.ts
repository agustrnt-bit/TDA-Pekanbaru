import { env } from "cloudflare:workers";

export type TreasuryAccount = {
  id: number; code: string; name: string; type: "bank" | "cash"; bankName: string;
  accountNumber: string; accountHolder: string; openingBalance: number; sortOrder: number;
  balance: number; totalIncome: number; totalExpense: number;
};

export type TreasuryMutation = {
  key: string; sourceType: string; sourceId: number; accountId: number; direction: "income" | "expense";
  transactionDate: string; description: string; category: string; amount: number;
  programCode: string | null; programTitle: string | null; createdByName: string; transferGroup: string | null;
};

export type TreasuryCategory = { id: number; name: string; sortOrder: number };
export type PendingAttendancePayment = {
  participantId: number; participantName: string; eventName: string; amount: number; method: string;
  accountId: number; paidAt: string; note: string; proofAvailable: number; receivedByName: string;
};

function db() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

export async function ensureTreasuryAccounts() {
  await db().batch([
    db().prepare(`INSERT OR IGNORE INTO treasury_accounts (code, name, type, sort_order) VALUES ('bank_1', 'Rekening Bank 1', 'bank', 1)`),
    db().prepare(`INSERT OR IGNORE INTO treasury_accounts (code, name, type, sort_order) VALUES ('bank_2', 'Rekening Bank 2', 'bank', 2)`),
    db().prepare(`INSERT OR IGNORE INTO treasury_accounts (code, name, type, sort_order) VALUES ('petty_cash', 'Kas Kecil', 'cash', 3)`),
  ]);
}

export async function ensureTreasuryCategories() {
  const defaults = ["Operasional", "Administrasi", "Donasi", "Iuran", "Sponsor", "Aset", "Konsumsi", "Transportasi", "Registrasi Member / Kelas Reguler", "Lainnya"];
  await db().batch(defaults.map((name, index) => db().prepare(
    `INSERT OR IGNORE INTO treasury_categories (name, sort_order) VALUES (?, ?)`,
  ).bind(name, index + 1)));
}

export async function listTreasuryCategories() {
  await ensureTreasuryCategories();
  return (await db().prepare(`SELECT id, name, sort_order AS sortOrder
    FROM treasury_categories WHERE is_active = 1 ORDER BY sort_order, name`).all<TreasuryCategory>()).results;
}

export async function createTreasuryCategory(name: string) {
  await ensureTreasuryCategories();
  const existing = await db().prepare(`SELECT id FROM treasury_categories WHERE LOWER(name) = LOWER(?)`).bind(name).first<{ id: number }>();
  if (existing) throw new Error("CATEGORY_EXISTS");
  const last = await db().prepare(`SELECT COALESCE(MAX(sort_order), 0) AS sortOrder FROM treasury_categories`).first<{ sortOrder: number }>();
  const result = await db().prepare(`INSERT INTO treasury_categories (name, sort_order) VALUES (?, ?)`)
    .bind(name, Number(last?.sortOrder ?? 0) + 1).run();
  return { id: Number(result.meta.last_row_id), name, sortOrder: Number(last?.sortOrder ?? 0) + 1 };
}

async function accountRows() {
  await ensureTreasuryAccounts();
  return (await db().prepare(`SELECT id, code, name, type, bank_name AS bankName,
    account_number AS accountNumber, account_holder AS accountHolder,
    opening_balance AS openingBalance, sort_order AS sortOrder
    FROM treasury_accounts WHERE is_active = 1 ORDER BY sort_order, id`).all<Omit<TreasuryAccount, "balance" | "totalIncome" | "totalExpense">>()).results;
}

export async function listTreasuryAccounts() {
  return accountRows();
}

export async function getTreasuryDashboard() {
  const accounts = await accountRows();
  const categories = await listTreasuryCategories();
  const defaultId = accounts[0]?.id ?? 0;
  const [balances, totals, mutations, pendingPayments] = await Promise.all([
    db().prepare(`WITH ledger AS (
      SELECT COALESCE(treasury_account_id, ?) AS accountId, 'income' AS direction, amount FROM program_incomes
      UNION ALL SELECT COALESCE(treasury_account_id, ?), 'expense', amount FROM program_expenses
      UNION ALL SELECT COALESCE(ap.payment_treasury_account_id, e.treasury_account_id, ?), 'income',
        CASE WHEN ap.payment_received_amount > 0 THEN ap.payment_received_amount ELSE ap.amount_due END
        FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id
        WHERE ap.payment_status = 'paid' AND e.program_id IS NULL
      UNION ALL SELECT COALESCE(treasury_account_id, ?), 'income',
        CASE WHEN payment_received_amount > 0 THEN payment_received_amount ELSE amount_due END
        FROM membership_registrations WHERE payment_status = 'paid'
      UNION ALL SELECT account_id, direction, amount FROM treasury_transactions
    ) SELECT accountId,
      COALESCE(SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END), 0) AS totalIncome,
      COALESCE(SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END), 0) AS totalExpense
      FROM ledger GROUP BY accountId`).bind(defaultId, defaultId, defaultId, defaultId).all<{ accountId: number; totalIncome: number; totalExpense: number }>(),
    db().prepare(`SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM program_incomes) +
      (SELECT COALESCE(SUM(CASE WHEN ap.payment_received_amount > 0 THEN ap.payment_received_amount ELSE ap.amount_due END), 0)
        FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id
        WHERE ap.payment_status = 'paid' AND e.program_id IS NULL) +
      (SELECT COALESCE(SUM(CASE WHEN payment_received_amount > 0 THEN payment_received_amount ELSE amount_due END), 0)
        FROM membership_registrations WHERE payment_status = 'paid') +
      (SELECT COALESCE(SUM(amount), 0) FROM treasury_transactions WHERE direction = 'income' AND transfer_group IS NULL) AS totalIncome,
      (SELECT COALESCE(SUM(amount), 0) FROM program_expenses) +
      (SELECT COALESCE(SUM(amount), 0) FROM treasury_transactions WHERE direction = 'expense' AND transfer_group IS NULL) AS totalExpense`).first<{ totalIncome: number; totalExpense: number }>(),
    db().prepare(`SELECT * FROM (
      SELECT 'income-' || i.id AS key, 'program_income' AS sourceType, i.id AS sourceId,
        COALESCE(i.treasury_account_id, ?) AS accountId, 'income' AS direction,
        i.income_date AS transactionDate, i.description, i.source AS category, i.amount,
        p.program_code AS programCode, p.title AS programTitle,
        COALESCE(u.name, 'Pengurus') AS createdByName, NULL AS transferGroup
      FROM program_incomes i JOIN programs p ON p.id = i.program_id LEFT JOIN users u ON u.id = i.created_by_user_id
      UNION ALL
      SELECT 'expense-' || e.id, 'program_expense', e.id,
        COALESCE(e.treasury_account_id, ?), 'expense', e.expense_date, e.description, e.category, e.amount,
        p.program_code, p.title, COALESCE(u.name, 'Pengurus'), NULL
      FROM program_expenses e JOIN programs p ON p.id = e.program_id LEFT JOIN users u ON u.id = e.created_by_user_id
      UNION ALL
      SELECT 'attendance-' || ap.id, 'attendance_payment', ap.id,
        COALESCE(ap.payment_treasury_account_id, e.treasury_account_id, ?), 'income', COALESCE(ap.payment_paid_at, DATE(ap.payment_verified_at)),
        'Registrasi ' || ap.name || ' · ' || e.name, 'HTM / Tiket Event',
        CASE WHEN ap.payment_received_amount > 0 THEN ap.payment_received_amount ELSE ap.amount_due END,
        NULL, NULL, COALESCE(u.name, 'Pengurus'), NULL
      FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id
      LEFT JOIN users u ON u.id = ap.payment_verified_by_user_id
      WHERE ap.payment_status = 'paid' AND e.program_id IS NULL
      UNION ALL
      SELECT 'membership-' || r.id, 'membership_payment', r.id,
        COALESCE(r.treasury_account_id, ?), 'income', COALESCE(r.payment_paid_at, DATE(r.payment_verified_at)),
        r.registration_code || ' · ' || r.full_name || ' · ' || r.package_name,
        'Registrasi Member / Kelas Reguler',
        CASE WHEN r.payment_received_amount > 0 THEN r.payment_received_amount ELSE r.amount_due END,
        NULL, NULL, COALESCE(u.name, 'Pengurus'), NULL
      FROM membership_registrations r LEFT JOIN users u ON u.id = r.payment_verified_by_user_id
      WHERE r.payment_status = 'paid'
      UNION ALL
      SELECT 'manual-' || t.id, CASE WHEN t.transfer_group IS NULL THEN 'manual' ELSE 'internal_transfer' END,
        t.id, t.account_id, t.direction, t.transaction_date, t.description, t.category, t.amount,
        NULL, NULL, COALESCE(u.name, 'Bendahara'), t.transfer_group
      FROM treasury_transactions t LEFT JOIN users u ON u.id = t.created_by_user_id
    ) ORDER BY transactionDate DESC, sourceId DESC LIMIT 250`).bind(defaultId, defaultId, defaultId, defaultId).all<TreasuryMutation>(),
    db().prepare(`SELECT ap.id AS participantId, ap.name AS participantName, e.name AS eventName,
      CASE WHEN ap.payment_received_amount > 0 THEN ap.payment_received_amount ELSE ap.amount_due END AS amount,
      ap.payment_method AS method, COALESCE(ap.payment_treasury_account_id, e.treasury_account_id, ?) AS accountId,
      COALESCE(ap.payment_paid_at, ap.payment_received_at) AS paidAt, ap.payment_note AS note,
      CASE WHEN ap.payment_proof_key IS NULL THEN 0 ELSE 1 END AS proofAvailable,
      COALESCE(u.name, 'Petugas Event') AS receivedByName
      FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id
      LEFT JOIN users u ON u.id = ap.payment_received_by_user_id
      WHERE ap.payment_status = 'onsite_pending'
      ORDER BY ap.payment_received_at DESC, ap.id DESC`).bind(defaultId).all<PendingAttendancePayment>(),
  ]);
  const balanceMap = new Map(balances.results.map((row) => [Number(row.accountId), row]));
  const normalizedAccounts = accounts.map((account) => {
    const movement = balanceMap.get(account.id);
    const totalIncome = Number(movement?.totalIncome ?? 0);
    const totalExpense = Number(movement?.totalExpense ?? 0);
    return { ...account, openingBalance: Number(account.openingBalance), totalIncome, totalExpense,
      balance: Number(account.openingBalance) + totalIncome - totalExpense } as TreasuryAccount;
  });
  const openingBalance = normalizedAccounts.reduce((sum, account) => sum + account.openingBalance, 0);
  const totalIncome = Number(totals?.totalIncome ?? 0);
  const totalExpense = Number(totals?.totalExpense ?? 0);
  return { accounts: normalizedAccounts, categories, mutations: mutations.results.map((row) => ({ ...row, amount: Number(row.amount) })),
    pendingPayments: pendingPayments.results.map((row) => ({ ...row, amount: Number(row.amount), accountId: Number(row.accountId) })),
    summary: { openingBalance, totalIncome, totalExpense, balance: openingBalance + totalIncome - totalExpense } };
}

export async function updateTreasuryAccount(id: number, input: {
  name: string; bankName: string; accountNumber: string; accountHolder: string; openingBalance: number;
}) {
  const result = await db().prepare(`UPDATE treasury_accounts SET name = ?, bank_name = ?, account_number = ?,
    account_holder = ?, opening_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1`)
    .bind(input.name, input.bankName, input.accountNumber, input.accountHolder, input.openingBalance, id).run();
  return Boolean(result.meta.changes);
}

export async function createManualTreasuryTransaction(userId: number, input: {
  accountId: number; direction: "income" | "expense"; description: string; category: string;
  transactionDate: string; amount: number;
}) {
  const account = await db().prepare(`SELECT id FROM treasury_accounts WHERE id = ? AND is_active = 1`).bind(input.accountId).first();
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  await db().prepare(`INSERT INTO treasury_transactions
    (account_id, direction, description, category, transaction_date, amount, created_by_user_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(input.accountId, input.direction, input.description, input.category, input.transactionDate, input.amount, userId).run();
}

export async function updateManualTreasuryTransaction(id: number, input: {
  accountId: number; direction: "income" | "expense"; description: string; category: string;
  transactionDate: string; amount: number;
}) {
  const account = await db().prepare(`SELECT id FROM treasury_accounts WHERE id = ? AND is_active = 1`).bind(input.accountId).first();
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  const result = await db().prepare(`UPDATE treasury_transactions SET account_id = ?, direction = ?,
    description = ?, category = ?, transaction_date = ?, amount = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND transfer_group IS NULL`)
    .bind(input.accountId, input.direction, input.description, input.category, input.transactionDate, input.amount, id).run();
  return Boolean(result.meta.changes);
}

export async function deleteManualTreasuryTransaction(id: number) {
  const result = await db().prepare(`DELETE FROM treasury_transactions WHERE id = ? AND transfer_group IS NULL`).bind(id).run();
  return Boolean(result.meta.changes);
}

export async function createTreasuryTransfer(userId: number, input: {
  fromAccountId: number; toAccountId: number; transactionDate: string; amount: number; description: string;
}) {
  if (input.fromAccountId === input.toAccountId) throw new Error("SAME_ACCOUNT");
  const accounts = await accountRows();
  const from = accounts.find((account) => account.id === input.fromAccountId);
  const to = accounts.find((account) => account.id === input.toAccountId);
  if (!from || !to) throw new Error("ACCOUNT_NOT_FOUND");
  const dashboard = await getTreasuryDashboard();
  const available = dashboard.accounts.find((account) => account.id === input.fromAccountId)?.balance ?? 0;
  if (available < input.amount) throw new Error("INSUFFICIENT_BALANCE");
  const group = crypto.randomUUID();
  const detail = input.description || `Transfer ${from.name} ke ${to.name}`;
  await db().batch([
    db().prepare(`INSERT INTO treasury_transactions
      (account_id, direction, description, category, transaction_date, amount, transfer_group, created_by_user_id, updated_at)
      VALUES (?, 'expense', ?, 'Transfer Internal', ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(from.id, `${detail} · ke ${to.name}`, input.transactionDate, input.amount, group, userId),
    db().prepare(`INSERT INTO treasury_transactions
      (account_id, direction, description, category, transaction_date, amount, transfer_group, created_by_user_id, updated_at)
      VALUES (?, 'income', ?, 'Transfer Internal', ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(to.id, `${detail} · dari ${from.name}`, input.transactionDate, input.amount, group, userId),
  ]);
}
