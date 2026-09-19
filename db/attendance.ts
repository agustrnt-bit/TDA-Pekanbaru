import { env } from "cloudflare:workers";
import { listTreasuryAccounts } from "@/db/treasury";

function d1() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

function bucket() {
  if (!env.BUCKET) throw new Error("Penyimpanan berkas belum tersedia");
  return env.BUCKET;
}

export type AttendanceEvent = {
  id: number;
  programId: number | null;
  incomeTaskId: number | null;
  programCode: string | null;
  programTitle: string | null;
  name: string;
  publicTitle: string;
  collaborationPartner: string;
  isCollaboration: number;
  flyerKey: string | null;
  flyerName: string | null;
  flyerType: string | null;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  isActive: number;
  registrationOpen: number;
  feedbackOpen: number;
  isPaid: number;
  treasuryAccountId: number | null;
  publicPrice: number;
  memberPrice: number;
  committeePrice: number;
  allowPublicCategory: number;
  allowMemberCategory: number;
  allowCommitteeCategory: number;
  earlyBirdPublicPrice: number;
  earlyBirdMemberPrice: number;
  earlyBirdCommitteePrice: number;
  earlyBirdEndsAt: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
  qrisKey: string | null;
  qrisName: string | null;
  qrisType: string | null;
};

export type AttendanceParticipant = {
  id: number;
  eventId: number;
  name: string;
  phone: string;
  category: string;
  organization: string;
  passportNumber: string;
  amountDue: number;
  priceLabel: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentProofKey: string | null;
  paymentProofName: string | null;
  paymentProofType: string | null;
  paymentConfirmedAt: string | null;
  paymentVerifiedAt: string | null;
  paymentNote: string;
  paymentVerificationSource: string;
  paymentReceivedAmount: number;
  paymentPaidAt: string | null;
  paymentTreasuryAccountId: number | null;
  paymentReceivedByUserId: number | null;
  paymentReceivedAt: string | null;
  qrToken: string;
  checkedInAt: string | null;
  checkInMethod: string | null;
};

export type AttendanceProgram = {
  id: number;
  programCode: string;
  title: string;
  divisionName: string;
};
export type AttendanceTask = { id: number; programId: number; title: string };

const eventSelect = `SELECT e.id, e.program_id AS programId, e.income_task_id AS incomeTaskId, p.program_code AS programCode,
  p.title AS programTitle, e.name, e.public_title AS publicTitle,
  e.collaboration_partner AS collaborationPartner, e.is_collaboration AS isCollaboration,
  e.flyer_key AS flyerKey, e.flyer_name AS flyerName, e.flyer_type AS flyerType,
  e.event_date AS eventDate, e.start_time AS startTime,
  e.end_time AS endTime, e.location, e.is_active AS isActive,
  e.registration_open AS registrationOpen, e.feedback_open AS feedbackOpen, e.is_paid AS isPaid,
  e.treasury_account_id AS treasuryAccountId,
  e.public_price AS publicPrice, e.member_price AS memberPrice, e.committee_price AS committeePrice,
  e.allow_public_category AS allowPublicCategory,
  e.allow_member_category AS allowMemberCategory,
  e.allow_committee_category AS allowCommitteeCategory,
  e.early_bird_public_price AS earlyBirdPublicPrice,
  e.early_bird_member_price AS earlyBirdMemberPrice,
  e.early_bird_committee_price AS earlyBirdCommitteePrice,
  e.early_bird_ends_at AS earlyBirdEndsAt, e.bank_name AS bankName,
  e.bank_account_number AS bankAccountNumber, e.bank_account_name AS bankAccountName,
  e.payment_instructions AS paymentInstructions, e.qris_key AS qrisKey,
  e.qris_name AS qrisName, e.qris_type AS qrisType
  FROM attendance_events e LEFT JOIN programs p ON p.id = e.program_id`;

const participantSelect = `SELECT id, event_id AS eventId, name, phone, category, organization,
  passport_number AS passportNumber, amount_due AS amountDue, price_label AS priceLabel,
  payment_status AS paymentStatus, payment_method AS paymentMethod,
  payment_proof_key AS paymentProofKey, payment_proof_name AS paymentProofName,
  payment_proof_type AS paymentProofType, payment_confirmed_at AS paymentConfirmedAt,
  payment_verified_at AS paymentVerifiedAt, payment_verification_source AS paymentVerificationSource,
  payment_received_amount AS paymentReceivedAmount, payment_paid_at AS paymentPaidAt,
  payment_treasury_account_id AS paymentTreasuryAccountId,
  payment_received_by_user_id AS paymentReceivedByUserId, payment_received_at AS paymentReceivedAt,
  payment_note AS paymentNote,
  qr_token AS qrToken, checked_in_at AS checkedInAt, check_in_method AS checkInMethod
  FROM attendance_participants`;

export async function listAttendance(eventId?: number) {
  const events = (
    await d1()
      .prepare(`${eventSelect} ORDER BY e.event_date DESC, e.id DESC`)
      .all<AttendanceEvent>()
  ).results;
  const selectedEventId = events.some((event) => event.id === eventId)
    ? eventId!
    : events[0]?.id;
  const [participants, programs, attendanceTasks, treasuryAccounts] =
    await Promise.all([
      selectedEventId
        ? d1()
            .prepare(
              `${participantSelect} WHERE event_id = ? ORDER BY checked_in_at DESC, name COLLATE NOCASE`,
            )
            .bind(selectedEventId)
            .all<AttendanceParticipant>()
        : Promise.resolve({ results: [] as AttendanceParticipant[] }),
      d1()
        .prepare(
          `SELECT p.id, p.program_code AS programCode, p.title, d.name AS divisionName
      FROM programs p JOIN divisions d ON d.id = p.division_id
      ORDER BY p.start_date DESC, p.title COLLATE NOCASE`,
        )
        .all<AttendanceProgram>(),
      d1()
        .prepare(
          `SELECT id, program_id AS programId, title FROM program_tasks ORDER BY title COLLATE NOCASE`,
        )
        .all<AttendanceTask>(),
      listTreasuryAccounts(),
    ]);
  return {
    events,
    participants: participants.results,
    programs: programs.results,
    attendanceTasks: attendanceTasks.results,
    treasuryAccounts,
  };
}

export async function listFastCheckIn(eventId?: number) {
  const events = (
    await d1()
      .prepare(`${eventSelect} ORDER BY e.event_date DESC, e.id DESC`)
      .all<AttendanceEvent>()
  ).results;
  const selectedEventId = events.some((event) => event.id === eventId)
    ? eventId!
    : events[0]?.id;
  const [participants, treasuryAccounts] = await Promise.all([
    selectedEventId
      ? d1()
          .prepare(
            `${participantSelect} WHERE event_id = ? ORDER BY checked_in_at DESC, name COLLATE NOCASE`,
          )
          .bind(selectedEventId)
          .all<AttendanceParticipant>()
      : Promise.resolve({ results: [] as AttendanceParticipant[] }),
    listTreasuryAccounts(),
  ]);
  return {
    events,
    participants: participants.results,
    programs: [] as AttendanceProgram[],
    attendanceTasks: [] as AttendanceTask[],
    treasuryAccounts,
  };
}

export async function listAttendanceParticipants(eventId: number) {
  const participants = await d1()
    .prepare(
      `${participantSelect} WHERE event_id = ?
    ORDER BY checked_in_at DESC, name COLLATE NOCASE`,
    )
    .bind(eventId)
    .all<AttendanceParticipant>();
  return participants.results;
}

export async function createAttendanceEvent(
  input: {
    programId: number | null;
    incomeTaskId: number | null;
    name: string;
    publicTitle: string;
    collaborationPartner: string;
    isCollaboration: boolean;
    eventDate: string;
    startTime: string;
    endTime: string;
    location: string;
    isPaid: boolean;
    publicPrice: number;
    memberPrice: number;
    committeePrice: number;
    allowPublicCategory: boolean;
    allowMemberCategory: boolean;
    allowCommitteeCategory: boolean;
    earlyBirdPublicPrice: number;
    earlyBirdMemberPrice: number;
    earlyBirdCommitteePrice: number;
    earlyBirdEndsAt: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    paymentInstructions: string;
    treasuryAccountId: number | null;
  },
  userId: number,
) {
  const result = await d1()
    .prepare(
      `INSERT INTO attendance_events
    (program_id, income_task_id, name, public_title, collaboration_partner, is_collaboration,
      event_date, start_time, end_time, location, is_paid, treasury_account_id,
      public_price, member_price, committee_price, allow_public_category,
      allow_member_category, allow_committee_category, early_bird_public_price,
      early_bird_member_price, early_bird_committee_price, early_bird_ends_at,
      bank_name, bank_account_number, bank_account_name, payment_instructions, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.programId,
      input.incomeTaskId,
      input.name,
      input.publicTitle,
      input.collaborationPartner,
      input.isCollaboration ? 1 : 0,
      input.eventDate,
      input.startTime,
      input.endTime,
      input.location,
      input.isPaid ? 1 : 0,
      input.treasuryAccountId,
      input.publicPrice,
      input.memberPrice,
      input.committeePrice,
      input.allowPublicCategory ? 1 : 0,
      input.allowMemberCategory ? 1 : 0,
      input.allowCommitteeCategory ? 1 : 0,
      input.earlyBirdPublicPrice,
      input.earlyBirdMemberPrice,
      input.earlyBirdCommitteePrice,
      input.earlyBirdEndsAt,
      input.bankName,
      input.bankAccountNumber,
      input.bankAccountName,
      input.paymentInstructions,
      userId,
    )
    .run();
  return Number(result.meta.last_row_id);
}

export async function updateAttendanceEvent(
  eventId: number,
  input: {
    programId: number | null;
    incomeTaskId: number | null;
    name: string;
    publicTitle: string;
    collaborationPartner: string;
    isCollaboration: boolean;
    eventDate: string;
    startTime: string;
    endTime: string;
    location: string;
    isPaid: boolean;
    publicPrice: number;
    memberPrice: number;
    committeePrice: number;
    allowPublicCategory: boolean;
    allowMemberCategory: boolean;
    allowCommitteeCategory: boolean;
    earlyBirdPublicPrice: number;
    earlyBirdMemberPrice: number;
    earlyBirdCommitteePrice: number;
    earlyBirdEndsAt: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    paymentInstructions: string;
    treasuryAccountId: number | null;
  },
) {
  const result = await d1()
    .prepare(
      `UPDATE attendance_events SET
    program_id = ?, income_task_id = ?, name = ?, public_title = ?, collaboration_partner = ?,
    is_collaboration = ?, event_date = ?, start_time = ?, end_time = ?, location = ?,
    is_paid = ?, treasury_account_id = ?, public_price = ?, member_price = ?, committee_price = ?,
    allow_public_category = ?, allow_member_category = ?, allow_committee_category = ?,
    early_bird_public_price = ?, early_bird_member_price = ?, early_bird_committee_price = ?,
    early_bird_ends_at = ?, bank_name = ?, bank_account_number = ?, bank_account_name = ?,
    payment_instructions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(
      input.programId,
      input.incomeTaskId,
      input.name,
      input.publicTitle,
      input.collaborationPartner,
      input.isCollaboration ? 1 : 0,
      input.eventDate,
      input.startTime,
      input.endTime,
      input.location,
      input.isPaid ? 1 : 0,
      input.isPaid ? input.treasuryAccountId : null,
      input.isPaid ? input.publicPrice : 0,
      input.isPaid ? input.memberPrice : 0,
      input.isPaid ? input.committeePrice : 0,
      input.allowPublicCategory ? 1 : 0,
      input.allowMemberCategory ? 1 : 0,
      input.allowCommitteeCategory ? 1 : 0,
      input.isPaid ? input.earlyBirdPublicPrice : 0,
      input.isPaid ? input.earlyBirdMemberPrice : 0,
      input.isPaid ? input.earlyBirdCommitteePrice : 0,
      input.isPaid ? input.earlyBirdEndsAt : "",
      input.isPaid ? input.bankName : "",
      input.isPaid ? input.bankAccountNumber : "",
      input.isPaid ? input.bankAccountName : "",
      input.isPaid ? input.paymentInstructions : "",
      eventId,
    )
    .run();
  return Number(result.meta.changes) > 0;
}

export async function deleteAttendanceEvent(eventId: number) {
  const event = await d1()
    .prepare(
      `SELECT qris_key AS qrisKey, flyer_key AS flyerKey FROM attendance_events WHERE id = ? LIMIT 1`,
    )
    .bind(eventId)
    .first<{ qrisKey: string | null; flyerKey: string | null }>();
  if (!event) return false;
  const participantFiles = (
    await d1()
      .prepare(
        `SELECT payment_proof_key AS fileKey
    FROM attendance_participants WHERE event_id = ? AND payment_proof_key IS NOT NULL`,
      )
      .bind(eventId)
      .all<{ fileKey: string }>()
  ).results;
  await d1().batch([
    d1()
      .prepare(
        `DELETE FROM program_feedback_answers WHERE submission_id IN (SELECT id FROM program_feedback_submissions WHERE event_id = ?)`,
      )
      .bind(eventId),
    d1()
      .prepare(`DELETE FROM program_feedback_submissions WHERE event_id = ?`)
      .bind(eventId),
    d1()
      .prepare(
        `DELETE FROM program_incomes WHERE attendance_participant_id IN
      (SELECT id FROM attendance_participants WHERE event_id = ?)`,
      )
      .bind(eventId),
    d1()
      .prepare(`DELETE FROM attendance_participants WHERE event_id = ?`)
      .bind(eventId),
    d1().prepare(`DELETE FROM attendance_events WHERE id = ?`).bind(eventId),
  ]);
  const keys = [
    event.qrisKey,
    event.flyerKey,
    ...participantFiles.map((item) => item.fileKey),
  ].filter((key): key is string => Boolean(key));
  await Promise.all(
    keys.map((key) =>
      bucket()
        .delete(key)
        .catch(() => undefined),
    ),
  );
  return true;
}

export async function saveAttendanceFile(prefix: string, file: File) {
  const extension = file.name.includes(".")
    ? file.name
        .split(".")
        .pop()
        ?.replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 8)
    : "bin";
  const key = `${prefix}/${crypto.randomUUID()}.${extension || "bin"}`;
  await bucket().put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  return key;
}

export async function setEventQris(
  eventId: number,
  key: string,
  name: string,
  type: string,
) {
  await d1()
    .prepare(
      `UPDATE attendance_events SET qris_key = ?, qris_name = ?, qris_type = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(key, name, type, eventId)
    .run();
}

export async function setEventFlyer(
  eventId: number,
  key: string,
  name: string,
  type: string,
) {
  await d1()
    .prepare(
      `UPDATE attendance_events SET flyer_key = ?, flyer_name = ?, flyer_type = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(key, name, type, eventId)
    .run();
}

export async function getAttendanceFile(key: string) {
  return bucket().get(key);
}
export async function deleteAttendanceFile(key: string) {
  return bucket().delete(key);
}

export async function createParticipant(
  input: {
    eventId: number;
    name: string;
    phone: string;
    category: string;
    organization: string;
  },
  userId: number,
  checkIn: boolean,
) {
  const token = crypto.randomUUID();
  const event = await getPublicEvent(input.eventId);
  const paymentStatus = event?.isPaid ? "pending" : "not_required";
  const price = event
    ? priceFor(event, input.category)
    : { amount: 0, label: "Gratis" };
  const result = await d1()
    .prepare(
      `INSERT INTO attendance_participants
    (event_id, name, phone, category, organization, amount_due, price_label, payment_status,
      qr_token, checked_in_at, check_in_method, checked_in_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${checkIn ? "CURRENT_TIMESTAMP, 'manual', ?" : "NULL, NULL, NULL"})`,
    )
    .bind(
      ...(checkIn
        ? [
            input.eventId,
            input.name,
            input.phone,
            input.category,
            input.organization,
            price.amount,
            price.label,
            paymentStatus,
            token,
            userId,
          ]
        : [
            input.eventId,
            input.name,
            input.phone,
            input.category,
            input.organization,
            price.amount,
            price.label,
            paymentStatus,
            token,
          ]),
    )
    .run();
  return Number(result.meta.last_row_id);
}

async function paymentAllowsCheckIn(id: number) {
  return d1()
    .prepare(
      `SELECT e.is_paid AS isPaid, ap.payment_status AS paymentStatus
    FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id
    WHERE ap.id = ? LIMIT 1`,
    )
    .bind(id)
    .first<{ isPaid: number; paymentStatus: string }>();
}

export async function checkInParticipant(
  id: number,
  userId: number,
  method: string,
) {
  const payment = await paymentAllowsCheckIn(id);
  if (!payment) return { status: "not_found" as const };
  if (payment.isPaid && payment.paymentStatus !== "paid")
    return { status: "payment_required" as const };
  const result = await d1()
    .prepare(
      `UPDATE attendance_participants SET checked_in_at = CURRENT_TIMESTAMP,
    check_in_method = ?, checked_in_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND checked_in_at IS NULL`,
    )
    .bind(method, userId, id)
    .run();
  return {
    status:
      Number(result.meta.changes) > 0
        ? ("checked_in" as const)
        : ("already_checked_in" as const),
  };
}

export async function receiveOnsitePayment(
  input: {
    participantId: number;
    accountId: number;
    method: string;
    amount: number;
    paidAt: string;
    note: string;
    proofKey: string | null;
    proofName: string | null;
    proofType: string | null;
  },
  userId: number,
) {
  const account = await d1()
    .prepare(
      `SELECT id FROM treasury_accounts WHERE id = ? AND is_active = 1 LIMIT 1`,
    )
    .bind(input.accountId)
    .first<{ id: number }>();
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  const participant = await d1()
    .prepare(
      `SELECT id, event_id AS eventId, payment_proof_key AS oldProofKey
    FROM attendance_participants WHERE id = ? AND payment_status != 'paid' LIMIT 1`,
    )
    .bind(input.participantId)
    .first<{ id: number; eventId: number; oldProofKey: string | null }>();
  if (!participant) throw new Error("PARTICIPANT_NOT_FOUND");
  await d1()
    .prepare(
      `UPDATE attendance_participants SET payment_status = 'onsite_pending',
    payment_method = ?, payment_verification_source = 'onsite', payment_received_amount = ?,
    payment_paid_at = ?, payment_treasury_account_id = ?, payment_received_by_user_id = ?,
    payment_received_at = CURRENT_TIMESTAMP, payment_note = ?,
    payment_proof_key = COALESCE(?, payment_proof_key), payment_proof_name = COALESCE(?, payment_proof_name),
    payment_proof_type = COALESCE(?, payment_proof_type), checked_in_at = COALESCE(checked_in_at, CURRENT_TIMESTAMP),
    check_in_method = COALESCE(check_in_method, 'onsite-payment'), checked_in_by_user_id = COALESCE(checked_in_by_user_id, ?),
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(
      input.method,
      input.amount,
      input.paidAt,
      input.accountId,
      userId,
      input.note,
      input.proofKey,
      input.proofName,
      input.proofType,
      userId,
      input.participantId,
    )
    .run();
  if (input.proofKey && participant.oldProofKey)
    await bucket()
      .delete(participant.oldProofKey)
      .catch(() => undefined);
  return d1()
    .prepare(`${participantSelect} WHERE id = ? LIMIT 1`)
    .bind(input.participantId)
    .first<AttendanceParticipant>();
}

export async function checkInParticipantByToken(
  eventId: number,
  token: string,
  userId: number,
) {
  const checked = await d1()
    .prepare(
      `UPDATE attendance_participants SET checked_in_at = CURRENT_TIMESTAMP,
    check_in_method = 'qr', checked_in_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE event_id = ? AND qr_token = ? AND checked_in_at IS NULL
      AND payment_status IN ('paid', 'not_required')
    RETURNING id, name, checked_in_at AS checkedInAt, payment_status AS paymentStatus`,
    )
    .bind(userId, eventId, token)
    .first<{
      id: number;
      name: string;
      checkedInAt: string | null;
      paymentStatus: string;
    }>();
  if (checked) return { status: "checked_in" as const, participant: checked };
  const participant = await d1()
    .prepare(
      `SELECT ap.id, ap.name, ap.checked_in_at AS checkedInAt,
    ap.payment_status AS paymentStatus, e.is_paid AS isPaid FROM attendance_participants ap
    JOIN attendance_events e ON e.id = ap.event_id
    WHERE ap.event_id = ? AND ap.qr_token = ? LIMIT 1`,
    )
    .bind(eventId, token)
    .first<{
      id: number;
      name: string;
      checkedInAt: string | null;
      paymentStatus: string;
      isPaid: number;
    }>();
  if (!participant) return { status: "not_found" as const };
  if (participant.checkedInAt)
    return { status: "already_checked_in" as const, participant };
  return { status: "payment_required" as const, participant };
}

export async function getAttendanceParticipant(id: number) {
  return d1()
    .prepare(`${participantSelect} WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<AttendanceParticipant>();
}

export async function deleteParticipant(id: number) {
  const row = await d1()
    .prepare(
      `SELECT payment_proof_key AS key FROM attendance_participants WHERE id = ?`,
    )
    .bind(id)
    .first<{ key: string | null }>();
  const submission = await d1()
    .prepare(
      `SELECT id FROM program_feedback_submissions WHERE participant_id = ?`,
    )
    .bind(id)
    .first<{ id: number }>();
  if (submission)
    await d1().batch([
      d1()
        .prepare(`DELETE FROM program_feedback_answers WHERE submission_id = ?`)
        .bind(submission.id),
      d1()
        .prepare(`DELETE FROM program_feedback_submissions WHERE id = ?`)
        .bind(submission.id),
    ]);
  await d1()
    .prepare(`DELETE FROM attendance_participants WHERE id = ?`)
    .bind(id)
    .run();
  if (row?.key) await bucket().delete(row.key);
}

export async function setRegistrationOpen(eventId: number, open: boolean) {
  await d1()
    .prepare(
      `UPDATE attendance_events SET registration_open = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(open ? 1 : 0, eventId)
    .run();
}

export async function getPublicEvent(eventId: number) {
  return d1()
    .prepare(`${eventSelect} WHERE e.id = ? LIMIT 1`)
    .bind(eventId)
    .first<AttendanceEvent>();
}

function earlyBirdActive(value: string) {
  if (!value) return false;
  const stamp =
    value.length === 10 ? `${value}T23:59:59+07:00` : `${value}:00+07:00`;
  return Date.now() <= new Date(stamp).getTime();
}

export function priceFor(event: AttendanceEvent, category: string) {
  if (!event.isPaid) return { amount: 0, label: "Gratis" };
  const committee = category === "Pengurus TDA";
  const member = category === "Member TDA";
  const normal = committee
    ? event.committeePrice
    : member
      ? event.memberPrice
      : event.publicPrice;
  const early = committee
    ? event.earlyBirdCommitteePrice
    : member
      ? event.earlyBirdMemberPrice
      : event.earlyBirdPublicPrice;
  const useEarly = earlyBirdActive(event.earlyBirdEndsAt) && early >= 0;
  return {
    amount: useEarly ? early : normal,
    label: useEarly ? "Harga Early Bird" : "Harga Normal",
  };
}

function publicParticipant(
  row: AttendanceParticipant,
  alreadyRegistered: boolean,
) {
  return {
    id: row.id,
    name: row.name,
    qrToken: row.qrToken,
    amountDue: Number(row.amountDue),
    priceLabel: row.priceLabel,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
    paymentNote: row.paymentNote,
    alreadyRegistered,
  };
}

export async function getPublicParticipant(eventId: number, token: string) {
  const row = await d1()
    .prepare(`${participantSelect} WHERE event_id = ? AND qr_token = ? LIMIT 1`)
    .bind(eventId, token)
    .first<AttendanceParticipant>();
  return row ? publicParticipant(row, true) : null;
}

export async function registerPublicParticipant(input: {
  eventId: number;
  name: string;
  phone: string;
  category: string;
  organization: string;
  passportNumber: string;
}) {
  const event = await getPublicEvent(input.eventId);
  if (!event) throw new Error("EVENT_NOT_FOUND");
  if (!event.registrationOpen) throw new Error("REGISTRATION_CLOSED");
  const categoryAllowed =
    (input.category === "Umum" && Boolean(event.allowPublicCategory)) ||
    (input.category === "Member TDA" && Boolean(event.allowMemberCategory)) ||
    (input.category === "Pengurus TDA" &&
      Boolean(event.allowCommitteeCategory));
  if (!categoryAllowed) throw new Error("CATEGORY_NOT_ALLOWED");
  const existing = await d1()
    .prepare(`${participantSelect} WHERE event_id = ? AND phone = ? LIMIT 1`)
    .bind(input.eventId, input.phone)
    .first<AttendanceParticipant>();
  if (existing) return publicParticipant(existing, true);
  const token = crypto.randomUUID();
  const price = priceFor(event, input.category);
  const paymentStatus =
    event.isPaid && price.amount > 0 ? "pending" : "not_required";
  const result = await d1()
    .prepare(
      `INSERT INTO attendance_participants
    (event_id, name, phone, category, organization, passport_number, amount_due,
      price_label, payment_status, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.eventId,
      input.name,
      input.phone,
      input.category,
      input.organization,
      input.passportNumber,
      price.amount,
      price.label,
      paymentStatus,
      token,
    )
    .run();
  const row = await d1()
    .prepare(`${participantSelect} WHERE id = ?`)
    .bind(Number(result.meta.last_row_id))
    .first<AttendanceParticipant>();
  if (!row) throw new Error("REGISTRATION_FAILED");
  return publicParticipant(row, false);
}

export async function confirmParticipantPayment(
  eventId: number,
  token: string,
  method: string,
  file: File,
) {
  const participant = await d1()
    .prepare(`${participantSelect} WHERE event_id = ? AND qr_token = ? LIMIT 1`)
    .bind(eventId, token)
    .first<AttendanceParticipant>();
  if (!participant) throw new Error("PARTICIPANT_NOT_FOUND");
  if (participant.paymentStatus === "not_required")
    throw new Error("PAYMENT_NOT_REQUIRED");
  const oldKey = participant.paymentProofKey;
  const key = await saveAttendanceFile(
    `attendance-payments/${eventId}/${participant.id}`,
    file,
  );
  await d1()
    .prepare(
      `UPDATE attendance_participants SET payment_method = ?, payment_proof_key = ?,
    payment_proof_name = ?, payment_proof_type = ?, payment_status = 'verification',
    payment_confirmed_at = CURRENT_TIMESTAMP, payment_note = '', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    )
    .bind(method, key, file.name.slice(0, 180), file.type, participant.id)
    .run();
  if (oldKey) await bucket().delete(oldKey);
  return getPublicParticipant(eventId, token);
}

export async function setPaymentStatus(
  participantId: number,
  status: "paid" | "rejected",
  note: string,
  userId: number,
  details: {
    source: string;
    method: string;
    receivedAmount: number;
    paidAt: string;
    treasuryAccountId?: number | null;
  },
) {
  const participant = await d1()
    .prepare(
      `SELECT ap.id, ap.name, ap.amount_due AS amountDue,
    ap.payment_status AS paymentStatus, e.program_id AS programId, e.income_task_id AS incomeTaskId, e.name AS eventName,
    COALESCE(ap.payment_treasury_account_id, e.treasury_account_id) AS treasuryAccountId
    FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id
    WHERE ap.id = ? LIMIT 1`,
    )
    .bind(participantId)
    .first<{
      id: number;
      name: string;
      amountDue: number;
      paymentStatus: string;
      programId: number | null;
      incomeTaskId: number | null;
      eventName: string;
      treasuryAccountId: number | null;
    }>();
  if (!participant) return false;
  const receivedAmount =
    status === "paid"
      ? Math.max(
          0,
          Math.round(details.receivedAmount || Number(participant.amountDue)),
        )
      : 0;
  const paidAt = status === "paid" ? details.paidAt || null : null;
  const treasuryAccountId =
    details.treasuryAccountId || participant.treasuryAccountId;
  const statements = [
    d1()
      .prepare(
        `UPDATE attendance_participants SET payment_status = ?, payment_note = ?,
    payment_method = ?, payment_verification_source = ?, payment_received_amount = ?, payment_paid_at = ?,
    payment_treasury_account_id = ?, payment_verified_at = CURRENT_TIMESTAMP,
    payment_verified_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
      )
      .bind(
        status,
        note,
        details.method,
        details.source,
        receivedAmount,
        paidAt,
        treasuryAccountId,
        userId,
        participantId,
      ),
  ];
  if (
    status === "paid" &&
    participant.programId &&
    Number(participant.amountDue) > 0
  ) {
    const description = `HTM ${participant.name} · ${participant.eventName}`;
    const linkedIncome = await d1()
      .prepare(
        `SELECT id FROM program_incomes WHERE attendance_participant_id = ? LIMIT 1`,
      )
      .bind(participantId)
      .first<{ id: number }>();
    if (linkedIncome) {
      statements.push(
        d1()
          .prepare(
            `UPDATE program_incomes SET task_id = ?, description = ?, income_date = DATE(?), amount = ?,
        treasury_account_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          )
          .bind(
            participant.incomeTaskId,
            description,
            paidAt,
            receivedAmount,
            treasuryAccountId,
            linkedIncome.id,
          ),
      );
    } else if (participant.paymentStatus === "paid") {
      const legacyIncome = await d1()
        .prepare(
          `SELECT id FROM program_incomes WHERE program_id = ?
        AND description = ? AND source = 'HTM / Tiket Event' AND attendance_participant_id IS NULL
        ORDER BY id DESC LIMIT 1`,
        )
        .bind(participant.programId, description)
        .first<{ id: number }>();
      if (legacyIncome) {
        statements.push(
          d1()
            .prepare(
              `UPDATE program_incomes SET task_id = ?, income_date = DATE(?), amount = ?,
          treasury_account_id = ?, attendance_participant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            )
            .bind(
              participant.incomeTaskId,
              paidAt,
              receivedAmount,
              treasuryAccountId,
              participantId,
              legacyIncome.id,
            ),
        );
      } else {
        statements.push(
          d1()
            .prepare(
              `INSERT INTO program_incomes
          (program_id, task_id, description, source, income_date, amount, treasury_account_id, attendance_participant_id, created_by_user_id, updated_at)
          VALUES (?, ?, ?, 'HTM / Tiket Event', DATE(?), ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            )
            .bind(
              participant.programId,
              participant.incomeTaskId,
              description,
              paidAt,
              receivedAmount,
              treasuryAccountId,
              participantId,
              userId,
            ),
        );
      }
    } else {
      statements.push(
        d1()
          .prepare(
            `INSERT INTO program_incomes
        (program_id, task_id, description, source, income_date, amount, treasury_account_id, attendance_participant_id, created_by_user_id, updated_at)
        VALUES (?, ?, ?, 'HTM / Tiket Event', DATE(?), ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          )
          .bind(
            participant.programId,
            participant.incomeTaskId,
            description,
            paidAt,
            receivedAmount,
            treasuryAccountId,
            participantId,
            userId,
          ),
      );
    }
  }
  await d1().batch(statements);
  return true;
}

export async function deletePaymentVerification(participantId: number) {
  const participant = await d1()
    .prepare(
      `SELECT ap.id, ap.name, ap.payment_status AS paymentStatus,
    ap.payment_proof_key AS paymentProofKey, e.program_id AS programId, e.name AS eventName
    FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id
    WHERE ap.id = ? LIMIT 1`,
    )
    .bind(participantId)
    .first<{
      id: number;
      name: string;
      paymentStatus: string;
      paymentProofKey: string | null;
      programId: number | null;
      eventName: string;
    }>();
  if (!participant) return false;
  const nextStatus = participant.paymentProofKey ? "verification" : "pending";
  const statements = [
    d1()
      .prepare(
        `UPDATE attendance_participants SET payment_status = ?, payment_note = '',
    payment_verification_source = '', payment_received_amount = 0, payment_paid_at = NULL,
    payment_verified_at = NULL, payment_verified_by_user_id = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
      )
      .bind(nextStatus, participantId),
  ];
  if (participant.programId && participant.paymentStatus === "paid") {
    const linkedIncome = await d1()
      .prepare(
        `SELECT id FROM program_incomes WHERE attendance_participant_id = ? LIMIT 1`,
      )
      .bind(participantId)
      .first<{ id: number }>();
    if (linkedIncome) {
      statements.push(
        d1()
          .prepare(`DELETE FROM program_incomes WHERE id = ?`)
          .bind(linkedIncome.id),
      );
    } else {
      statements.push(
        d1()
          .prepare(
            `DELETE FROM program_incomes WHERE id = (
        SELECT id FROM program_incomes WHERE program_id = ? AND description = ?
        AND source = 'HTM / Tiket Event' AND attendance_participant_id IS NULL ORDER BY id DESC LIMIT 1
      )`,
          )
          .bind(
            participant.programId,
            `HTM ${participant.name} · ${participant.eventName}`,
          ),
      );
    }
  }
  await d1().batch(statements);
  return { status: nextStatus };
}

export async function reviewOnsitePayment(
  participantId: number,
  approved: boolean,
  userId: number,
  input: {
    accountId: number;
    amount: number;
    note: string;
  },
) {
  const participant = await getAttendanceParticipant(participantId);
  if (!participant || participant.paymentStatus !== "onsite_pending")
    throw new Error("PENDING_PAYMENT_NOT_FOUND");
  if (!approved) {
    await d1()
      .prepare(
        `UPDATE attendance_participants SET payment_status = 'rejected', payment_note = ?,
      payment_verified_at = CURRENT_TIMESTAMP, payment_verified_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      )
      .bind(
        input.note || "Pembayaran di lokasi ditolak Bendahara.",
        userId,
        participantId,
      )
      .run();
    return;
  }
  await setPaymentStatus(
    participantId,
    "paid",
    input.note || participant.paymentNote,
    userId,
    {
      source: "onsite_verified",
      method: participant.paymentMethod,
      receivedAmount: input.amount,
      paidAt: participant.paymentPaidAt || new Date().toISOString(),
      treasuryAccountId: input.accountId,
    },
  );
}
