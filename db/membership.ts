import { env } from "cloudflare:workers";
import { listTreasuryAccounts } from "@/db/treasury";

function db() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

function bucket() {
  if (!env.BUCKET) throw new Error("Penyimpanan berkas belum tersedia");
  return env.BUCKET;
}

export const optionTypes = ["business_field", "annual_revenue", "business_issue", "business_system", "shirt_size", "sleeve_type", "class_material"] as const;
export type MembershipOptionType = typeof optionTypes[number];

export type MembershipOption = { id: number; type: MembershipOptionType; label: string; sortOrder: number; isActive: number };
export type MembershipPackage = { id: number; registrationType: "new" | "existing"; code: string; name: string; amount: number; includesShirt: number; includesClass: number; recommended: number; sortOrder: number; isActive: number };
export type MembershipRegistration = {
  id: number; registrationCode: string; registrationType: "new" | "existing"; fullName: string; email: string;
  whatsapp: string; passportNumber: string; businessName: string; businessField: string; businessAge: string; employeeCount: number;
  annualRevenue: string; previousTraining: string; businessIssues: string; existingSystems: string;
  tdaGoal: string; informationSource: string; packageCode: string; packageName: string; amountDue: number;
  includesShirt: number; shirtSize: string; sleeveType: string; treasuryAccountId: number | null; paymentMethod: string;
  paymentStatus: string; paymentProofKey: string | null; paymentProofName: string | null; paymentProofType: string | null;
  paymentConfirmedAt: string | null; paymentVerifiedAt: string | null; paymentReceivedAmount: number;
  paymentPaidAt: string | null; paymentNote: string; memberStatus: string; shirtStatus: string;
  confirmationToken: string; createdAt: string; accountName: string | null;
};

const registrationSelect = `SELECT r.id, r.registration_code AS registrationCode,
  r.registration_type AS registrationType, r.full_name AS fullName, r.email, r.whatsapp,
  r.passport_number AS passportNumber,
  r.business_name AS businessName, r.business_field AS businessField, r.business_age AS businessAge,
  r.employee_count AS employeeCount, r.annual_revenue AS annualRevenue,
  r.previous_training AS previousTraining, r.business_issues AS businessIssues,
  r.existing_systems AS existingSystems, r.tda_goal AS tdaGoal,
  r.information_source AS informationSource, r.package_code AS packageCode,
  r.package_name AS packageName, r.amount_due AS amountDue, r.includes_shirt AS includesShirt,
  r.shirt_size AS shirtSize, r.sleeve_type AS sleeveType, r.treasury_account_id AS treasuryAccountId,
  r.payment_method AS paymentMethod, r.payment_status AS paymentStatus,
  r.payment_proof_key AS paymentProofKey, r.payment_proof_name AS paymentProofName,
  r.payment_proof_type AS paymentProofType, r.payment_confirmed_at AS paymentConfirmedAt,
  r.payment_verified_at AS paymentVerifiedAt, r.payment_received_amount AS paymentReceivedAmount,
  r.payment_paid_at AS paymentPaidAt, r.payment_note AS paymentNote,
  r.member_status AS memberStatus, r.shirt_status AS shirtStatus,
  r.confirmation_token AS confirmationToken, r.created_at AS createdAt, a.name AS accountName
  FROM membership_registrations r LEFT JOIN treasury_accounts a ON a.id = r.treasury_account_id`;

const defaultOptions: Record<MembershipOptionType, string[]> = {
  business_field: ["Kuliner", "Fashion", "Retail", "Jasa", "Manufaktur", "Pertanian dan Perkebunan", "Teknologi", "Pendidikan", "Kesehatan", "Properti", "Industri Kreatif", "Lainnya"],
  annual_revenue: ["Rp0–300 juta", "Rp300 juta–Rp1 miliar", "Rp1–2,5 miliar", "Rp2,5–5 miliar", "Rp5–10 miliar", "Rp10–25 miliar", "Rp25–50 miliar", "Di atas Rp50 miliar"],
  business_issue: ["Penjualan belum stabil", "Kesulitan pemasaran", "Arus kas bermasalah", "Belum memahami laporan keuangan", "Kesulitan mengelola tim", "Belum memiliki SOP", "Persediaan belum terkontrol", "Legalitas usaha", "Sulit mengembangkan usaha", "Permasalahan lainnya"],
  business_system: ["Pencatatan dan laporan keuangan", "SOP operasional", "Sistem penjualan", "Sistem persediaan", "Struktur organisasi dan job description", "Sistem penggajian", "KPI dan penilaian karyawan", "Sistem pemasaran", "Legalitas usaha", "Belum ada sistem yang berjalan"],
  shirt_size: ["S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"],
  sleeve_type: ["Lengan Pendek", "Lengan Panjang"],
  class_material: [
    "Diagnosis Business & Legal",
    "Business Mapping",
    "Business Model Canvas",
    "SBM: Playing Field & Market Landscape",
    "Marketing dan Digital Marketing",
    "Selling",
    "Finance: HPP, harga jual, BEP, laporan keuangan, dan budgeting sederhana",
    "HR: visi–misi, manpower planning, job description, labor cost, recruitment, KPI, struktur organisasi, dan training",
    "Coaching & Leadership",
  ],
};

const defaultPackages = {
  new: [
    { code: "member", name: "Registrasi Member", amount: 200000, includesShirt: true, includesClass: false, recommended: false },
    { code: "member_class", name: "Registrasi Member + Kelas Reguler", amount: 700000, includesShirt: true, includesClass: true, recommended: true },
  ],
  existing: [
    { code: "class", name: "Kelas Reguler", amount: 550000, includesShirt: false, includesClass: true, recommended: false },
    { code: "class_kit", name: "Kelas Reguler + Starter Kit TDA", amount: 650000, includesShirt: true, includesClass: true, recommended: true },
  ],
} as const;

export async function ensureMembershipDefaults() {
  const statements = [db().prepare(`INSERT OR IGNORE INTO membership_settings (id, admin_whatsapp) VALUES (1, '6285121804468')`)];
  for (const type of optionTypes) defaultOptions[type].forEach((label, index) => statements.push(
    db().prepare(`INSERT OR IGNORE INTO membership_options (type, label, sort_order) VALUES (?, ?, ?)`).bind(type, label, index + 1),
  ));
  for (const registrationType of ["new", "existing"] as const) defaultPackages[registrationType].forEach((item, index) => statements.push(
    db().prepare(`INSERT OR IGNORE INTO membership_packages
      (registration_type, code, name, amount, includes_shirt, includes_class, is_recommended, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(registrationType, item.code, item.name, item.amount, item.includesShirt ? 1 : 0,
        item.includesClass ? 1 : 0, item.recommended ? 1 : 0, index + 1),
  ));
  await db().batch(statements);
}

export async function listMembershipPackages(activeOnly = true) {
  return (await db().prepare(`SELECT id, registration_type AS registrationType, code, name, amount,
    includes_shirt AS includesShirt, includes_class AS includesClass,
    is_recommended AS recommended, sort_order AS sortOrder, is_active AS isActive
    FROM membership_packages ${activeOnly ? "WHERE is_active = 1" : ""}
    ORDER BY registration_type, sort_order, id`).all<MembershipPackage>()).results;
}

export async function getMembershipPublicConfig() {
  await ensureMembershipDefaults();
  const [options, settings, accounts, packageRows] = await Promise.all([
    db().prepare(`SELECT id, type, label, sort_order AS sortOrder, is_active AS isActive
      FROM membership_options WHERE is_active = 1 ORDER BY type, sort_order, id`).all<MembershipOption>(),
    db().prepare(`SELECT admin_whatsapp AS adminWhatsapp, treasury_account_id AS treasuryAccountId,
      qris_key AS qrisKey, payment_instructions AS paymentInstructions FROM membership_settings WHERE id = 1`)
      .first<{ adminWhatsapp: string; treasuryAccountId: number | null; qrisKey: string | null; paymentInstructions: string }>(),
    listTreasuryAccounts(),
    listMembershipPackages(),
  ]);
  const selectedAccounts = settings?.treasuryAccountId
    ? accounts.filter((account) => account.id === settings.treasuryAccountId)
    : accounts.filter((account) => account.type === "bank");
  return {
    options: options.results,
    settings: { adminWhatsapp: settings?.adminWhatsapp || "6285121804468", qrisAvailable: Boolean(settings?.qrisKey), paymentInstructions: settings?.paymentInstructions || "" },
    accounts: selectedAccounts.filter((account) => account.type === "bank").map(({ id, name, bankName, accountNumber, accountHolder }) => ({ id, name, bankName, accountNumber, accountHolder })),
    packages: {
      new: packageRows.filter((item) => item.registrationType === "new"),
      existing: packageRows.filter((item) => item.registrationType === "existing"),
    },
    classMaterials: options.results.filter((item) => item.type === "class_material").map((item) => item.label),
  };
}

function cleanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return `62${digits}`;
}

async function packageFor(type: string, code: string, activeOnly = true) {
  return db().prepare(`SELECT id, registration_type AS registrationType, code, name, amount,
    includes_shirt AS includesShirt, includes_class AS includesClass,
    is_recommended AS recommended, sort_order AS sortOrder, is_active AS isActive
    FROM membership_packages WHERE registration_type = ? AND code = ? ${activeOnly ? "AND is_active = 1" : ""} LIMIT 1`)
    .bind(type, code).first<MembershipPackage>();
}

export async function createMembershipRegistration(input: Record<string, unknown>) {
  await ensureMembershipDefaults();
  const registrationType = String(input.registrationType ?? "");
  const selectedPackage = await packageFor(registrationType, String(input.packageCode ?? ""));
  if (!selectedPackage) throw new Error("PACKAGE_INVALID");
  const fullName = String(input.fullName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const whatsapp = cleanPhone(String(input.whatsapp ?? ""));
  const passportNumber = String(input.passportNumber ?? "").trim();
  const businessField = String(input.businessField ?? "").trim();
  const businessAge = String(input.businessAge ?? "").trim();
  const annualRevenue = String(input.annualRevenue ?? "").trim();
  const businessIssues = Array.isArray(input.businessIssues) ? input.businessIssues.map(String).filter(Boolean) : [];
  const existingSystems = Array.isArray(input.existingSystems) ? input.existingSystems.map(String).filter(Boolean) : [];
  const shirtSize = String(input.shirtSize ?? "").trim();
  const sleeveType = String(input.sleeveType ?? "").trim();
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || whatsapp.length < 10 || !businessField || !businessAge || !annualRevenue) throw new Error("REQUIRED_FIELDS");
  if (registrationType === "existing" && !passportNumber) throw new Error("PASSPORT_REQUIRED");
  if (!businessIssues.length || !existingSystems.length) throw new Error("CHECKLIST_REQUIRED");
  if (selectedPackage.includesShirt && (!shirtSize || !sleeveType)) throw new Error("SHIRT_SIZE_REQUIRED");
  const settings = await db().prepare(`SELECT treasury_account_id AS treasuryAccountId FROM membership_settings WHERE id = 1`)
    .first<{ treasuryAccountId: number | null }>();
  const code = `TDA-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const token = crypto.randomUUID();
  const result = await db().prepare(`INSERT INTO membership_registrations
    (registration_code, registration_type, full_name, email, whatsapp, passport_number, business_name, business_field,
      business_age, employee_count, annual_revenue, previous_training, business_issues, existing_systems,
      tda_goal, information_source, package_code, package_name, amount_due, includes_shirt, shirt_size, sleeve_type,
      treasury_account_id, payment_method, confirmation_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(code, registrationType, fullName, email, whatsapp, passportNumber, String(input.businessName ?? "").trim(), businessField,
      businessAge, Math.max(0, Math.round(Number(input.employeeCount) || 0)), annualRevenue,
      String(input.previousTraining ?? "").trim(), JSON.stringify(businessIssues), JSON.stringify(existingSystems),
      String(input.tdaGoal ?? "").trim(), String(input.informationSource ?? "").trim(), selectedPackage.code,
      selectedPackage.name, Number(selectedPackage.amount), selectedPackage.includesShirt ? 1 : 0,
      selectedPackage.includesShirt ? shirtSize : "", selectedPackage.includesShirt ? sleeveType : "", settings?.treasuryAccountId ?? null,
      String(input.paymentMethod ?? "Transfer Bank"), token).run();
  return getPublicMembershipRegistration(token, Number(result.meta.last_row_id));
}

function publicRegistration(row: MembershipRegistration) {
  return { id: row.id, registrationCode: row.registrationCode, registrationType: row.registrationType,
    fullName: row.fullName, whatsapp: row.whatsapp, passportNumber: row.passportNumber,
    packageName: row.packageName, amountDue: Number(row.amountDue), includesShirt: Boolean(row.includesShirt),
    shirtSize: row.shirtSize, sleeveType: row.sleeveType, paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus, paymentNote: row.paymentNote, memberStatus: row.memberStatus,
    confirmationToken: row.confirmationToken };
}

export async function getPublicMembershipRegistration(token: string, id?: number) {
  const row = id
    ? await db().prepare(`${registrationSelect} WHERE r.id = ? LIMIT 1`).bind(id).first<MembershipRegistration>()
    : await db().prepare(`${registrationSelect} WHERE r.confirmation_token = ? LIMIT 1`).bind(token).first<MembershipRegistration>();
  return row ? publicRegistration(row) : null;
}

export async function saveMembershipFile(prefix: string, file: File) {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) : "bin";
  const key = `${prefix}/${crypto.randomUUID()}.${extension || "bin"}`;
  await bucket().put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return key;
}

export async function confirmMembershipPayment(token: string, method: string, file: File) {
  const row = await db().prepare(`${registrationSelect} WHERE r.confirmation_token = ? LIMIT 1`).bind(token).first<MembershipRegistration>();
  if (!row) throw new Error("REGISTRATION_NOT_FOUND");
  const key = await saveMembershipFile(`membership-payments/${row.id}`, file);
  await db().prepare(`UPDATE membership_registrations SET payment_method = ?, payment_proof_key = ?,
    payment_proof_name = ?, payment_proof_type = ?, payment_status = 'verification',
    payment_confirmed_at = CURRENT_TIMESTAMP, payment_note = '', member_status = 'menunggu_verifikasi',
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(method, key, file.name.slice(0, 180), file.type, row.id).run();
  if (row.paymentProofKey) await bucket().delete(row.paymentProofKey);
  return getPublicMembershipRegistration(token);
}

export async function getMembershipFile(key: string) { return bucket().get(key); }

export async function getMembershipAdminData() {
  await ensureMembershipDefaults();
  const [registrations, options, settings, accounts, packageRows] = await Promise.all([
    db().prepare(`${registrationSelect} ORDER BY r.created_at DESC, r.id DESC LIMIT 500`).all<MembershipRegistration>(),
    db().prepare(`SELECT id, type, label, sort_order AS sortOrder, is_active AS isActive
      FROM membership_options ORDER BY type, sort_order, id`).all<MembershipOption>(),
    db().prepare(`SELECT admin_whatsapp AS adminWhatsapp, treasury_account_id AS treasuryAccountId,
      qris_key AS qrisKey, qris_name AS qrisName, payment_instructions AS paymentInstructions
      FROM membership_settings WHERE id = 1`).first(),
    listTreasuryAccounts(),
    listMembershipPackages(false),
  ]);
  return { registrations: registrations.results, options: options.results, settings, accounts,
    packages: packageRows, classMaterials: options.results.filter((item) => item.type === "class_material" && item.isActive).map((item) => item.label) };
}

export async function getMembershipRegistrations() {
  const registrations = await db().prepare(`${registrationSelect} ORDER BY r.created_at DESC, r.id DESC LIMIT 500`)
    .all<MembershipRegistration>();
  return registrations.results;
}

export async function upsertMembershipOption(input: { id?: number; type: string; label: string; isActive?: boolean }) {
  if (!optionTypes.includes(input.type as MembershipOptionType)) throw new Error("OPTION_TYPE_INVALID");
  if (input.id) {
    await db().prepare(`UPDATE membership_options SET label = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(input.label, input.isActive === false ? 0 : 1, input.id).run();
    return;
  }
  const last = await db().prepare(`SELECT COALESCE(MAX(sort_order), 0) AS sortOrder FROM membership_options WHERE type = ?`)
    .bind(input.type).first<{ sortOrder: number }>();
  await db().prepare(`INSERT INTO membership_options (type, label, sort_order) VALUES (?, ?, ?)`)
    .bind(input.type, input.label, Number(last?.sortOrder ?? 0) + 1).run();
}

export async function updateMembershipPackage(input: { id: number; name: string; amount: number; isActive: boolean }) {
  const result = await db().prepare(`UPDATE membership_packages SET name = ?, amount = ?, is_active = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(input.name, input.amount, input.isActive ? 1 : 0, input.id).run();
  return Boolean(result.meta.changes);
}

export async function updateMembershipSettings(input: { adminWhatsapp: string; treasuryAccountId: number | null; paymentInstructions: string }) {
  await ensureMembershipDefaults();
  await db().prepare(`UPDATE membership_settings SET admin_whatsapp = ?, treasury_account_id = ?,
    payment_instructions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`)
    .bind(cleanPhone(input.adminWhatsapp), input.treasuryAccountId, input.paymentInstructions).run();
}

export async function setMembershipQris(key: string, name: string, type: string) {
  await db().prepare(`UPDATE membership_settings SET qris_key = ?, qris_name = ?, qris_type = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = 1`).bind(key, name, type).run();
}

export async function setMembershipPaymentStatus(id: number, status: "paid" | "rejected", note: string, userId: number, amount: number, paidAt: string) {
  const memberStatus = status === "paid" ? "aktif" : "perlu_perbaikan";
  const result = await db().prepare(`UPDATE membership_registrations SET payment_status = ?, payment_note = ?,
    payment_received_amount = ?, payment_paid_at = ?, payment_verified_at = CURRENT_TIMESTAMP,
    payment_verified_by_user_id = ?, member_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(status, note, status === "paid" ? amount : 0, status === "paid" ? paidAt : null, userId, memberStatus, id).run();
  return Boolean(result.meta.changes);
}

export async function updateMembershipShirtStatus(id: number, shirtStatus: string) {
  const allowed = new Set(["belum_diproses", "sudah_dipesan", "sudah_tersedia", "sudah_diserahkan"]);
  if (!allowed.has(shirtStatus)) throw new Error("SHIRT_STATUS_INVALID");
  await db().prepare(`UPDATE membership_registrations SET shirt_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(shirtStatus, id).run();
}

export async function updateMembershipRegistration(id: number, input: Record<string, unknown>, userId: number) {
  const registrationType = String(input.registrationType ?? "");
  const selectedPackage = await packageFor(registrationType, String(input.packageCode ?? ""), false);
  if (!selectedPackage) throw new Error("PACKAGE_INVALID");
  const current = await db().prepare(`SELECT package_code AS packageCode, amount_due AS amountDue
    FROM membership_registrations WHERE id = ?`).bind(id).first<{ packageCode: string; amountDue: number }>();
  if (!current) return false;
  const amountDue = current.packageCode === selectedPackage.code ? Number(current.amountDue) : Number(selectedPackage.amount);
  const fullName = String(input.fullName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const whatsapp = cleanPhone(String(input.whatsapp ?? ""));
  const passportNumber = String(input.passportNumber ?? "").trim();
  const businessIssues = Array.isArray(input.businessIssues) ? input.businessIssues.map(String).filter(Boolean) : [];
  const existingSystems = Array.isArray(input.existingSystems) ? input.existingSystems.map(String).filter(Boolean) : [];
  const paymentStatus = String(input.paymentStatus ?? "pending");
  const allowedPayments = new Set(["pending", "verification", "paid", "rejected"]);
  if (!allowedPayments.has(paymentStatus)) throw new Error("PAYMENT_STATUS_INVALID");
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || whatsapp.length < 10) throw new Error("REQUIRED_FIELDS");
  if (registrationType === "existing" && !passportNumber) throw new Error("PASSPORT_REQUIRED");
  const shirtSize = selectedPackage.includesShirt ? String(input.shirtSize ?? "").trim() : "";
  const sleeveType = selectedPackage.includesShirt ? String(input.sleeveType ?? "").trim() : "";
  if (selectedPackage.includesShirt && (!shirtSize || !sleeveType)) throw new Error("SHIRT_SIZE_REQUIRED");
  const paymentReceivedAmount = paymentStatus === "paid" ? Math.max(0, Math.round(Number(input.paymentReceivedAmount) || amountDue)) : 0;
  const paymentPaidAt = paymentStatus === "paid" ? String(input.paymentPaidAt ?? "").trim() || new Date().toISOString().slice(0, 10) : null;
  const memberStatus = paymentStatus === "paid" ? "aktif" : paymentStatus === "rejected" ? "perlu_perbaikan" : paymentStatus === "verification" ? "menunggu_verifikasi" : "menunggu_pembayaran";
  const shirtStatus = selectedPackage.includesShirt ? String(input.shirtStatus ?? "belum_diproses") : "tidak_termasuk";
  const result = await db().prepare(`UPDATE membership_registrations SET registration_type = ?, full_name = ?,
    email = ?, whatsapp = ?, passport_number = ?, business_name = ?, business_field = ?, business_age = ?,
    employee_count = ?, annual_revenue = ?, previous_training = ?, business_issues = ?, existing_systems = ?,
    tda_goal = ?, information_source = ?, package_code = ?, package_name = ?, amount_due = ?,
    includes_shirt = ?, shirt_size = ?, sleeve_type = ?, payment_method = ?, payment_status = ?,
    payment_received_amount = ?, payment_paid_at = ?, payment_note = ?, member_status = ?, shirt_status = ?,
    payment_verified_at = CASE WHEN ? = 'paid' THEN COALESCE(payment_verified_at, CURRENT_TIMESTAMP) ELSE payment_verified_at END,
    payment_verified_by_user_id = CASE WHEN ? = 'paid' THEN ? ELSE payment_verified_by_user_id END,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(registrationType, fullName, email, whatsapp, passportNumber, String(input.businessName ?? "").trim(),
      String(input.businessField ?? "").trim(), String(input.businessAge ?? "").trim(), Math.max(0, Math.round(Number(input.employeeCount) || 0)),
      String(input.annualRevenue ?? "").trim(), String(input.previousTraining ?? "").trim(), JSON.stringify(businessIssues),
      JSON.stringify(existingSystems), String(input.tdaGoal ?? "").trim(), String(input.informationSource ?? "").trim(),
      selectedPackage.code, selectedPackage.name, amountDue, selectedPackage.includesShirt ? 1 : 0,
      shirtSize, sleeveType, String(input.paymentMethod ?? "Transfer Bank"), paymentStatus, paymentReceivedAmount,
      paymentPaidAt, String(input.paymentNote ?? "").trim(), memberStatus, shirtStatus,
      paymentStatus, paymentStatus, userId, id).run();
  return Boolean(result.meta.changes);
}

export async function deleteMembershipRegistration(id: number) {
  const row = await db().prepare(`SELECT payment_proof_key AS paymentProofKey FROM membership_registrations WHERE id = ?`)
    .bind(id).first<{ paymentProofKey: string | null }>();
  if (!row) return false;
  await db().prepare(`DELETE FROM membership_registrations WHERE id = ?`).bind(id).run();
  if (row.paymentProofKey) await bucket().delete(row.paymentProofKey).catch(() => undefined);
  return true;
}
