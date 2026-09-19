import { env } from "cloudflare:workers";

function db() { if (!env.DB) throw new Error("Database belum tersedia"); return env.DB; }

export type FeedbackQuestion = { id: number; programId: number; question: string; questionType: string; optionsJson: string; isRequired: number; sortOrder: number };

export async function getProgramFeedback(programId: number) {
  const [questions, stats, events] = await Promise.all([
    db().prepare(`SELECT id, program_id AS programId, question, question_type AS questionType,
      options_json AS optionsJson, is_required AS isRequired, sort_order AS sortOrder
      FROM program_feedback_questions WHERE program_id = ? AND is_active = 1 ORDER BY sort_order, id`).bind(programId).all<FeedbackQuestion>(),
    db().prepare(`SELECT COUNT(DISTINCT s.id) AS responseCount,
      COALESCE(ROUND(AVG(CASE WHEN q.question_type = 'rating' THEN CAST(a.answer_json AS REAL) END), 1), 0) AS averageRating
      ,(SELECT COUNT(*) FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id WHERE e.program_id = ?) AS registeredCount
      ,(SELECT COUNT(*) FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id WHERE e.program_id = ? AND ap.checked_in_at IS NOT NULL) AS attendedCount
      ,(SELECT COALESCE(SUM(amount), 0) FROM program_incomes WHERE program_id = ?) AS realizedIncome
      ,(SELECT COALESCE(SUM(amount), 0) FROM program_expenses WHERE program_id = ?) AS realizedExpense
      FROM program_feedback_submissions s
      LEFT JOIN program_feedback_answers a ON a.submission_id = s.id
      LEFT JOIN program_feedback_questions q ON q.id = a.question_id WHERE s.program_id = ?`).bind(programId, programId, programId, programId, programId).first<{ responseCount: number; averageRating: number; registeredCount: number; attendedCount: number; realizedIncome: number; realizedExpense: number }>(),
    db().prepare(`SELECT e.id, e.name, e.feedback_open AS feedbackOpen,
      COUNT(ap.id) AS participantCount, COUNT(s.id) AS responseCount
      FROM attendance_events e LEFT JOIN attendance_participants ap ON ap.event_id = e.id
      LEFT JOIN program_feedback_submissions s ON s.participant_id = ap.id
      WHERE e.program_id = ? GROUP BY e.id ORDER BY e.event_date DESC`).bind(programId).all<{ id: number; name: string; feedbackOpen: number; participantCount: number; responseCount: number }>(),
  ]);
  return { questions: questions.results, stats: { responseCount: Number(stats?.responseCount || 0), averageRating: Number(stats?.averageRating || 0), registeredCount: Number(stats?.registeredCount || 0), attendedCount: Number(stats?.attendedCount || 0), realizedIncome: Number(stats?.realizedIncome || 0), realizedExpense: Number(stats?.realizedExpense || 0) }, events: events.results };
}

export type FeedbackResultRow = {
  participantId: number; participantName: string; phone: string; eventId: number; eventName: string;
  submittedAt: string | null; questionId: number | null; answerJson: string | null;
};

export async function getProgramFeedbackResults(programId: number, eventId?: number) {
  const eventFilter = eventId ? " AND e.id = ?" : "";
  const statement = db().prepare(`SELECT ap.id AS participantId, ap.name AS participantName, ap.phone,
    e.id AS eventId, e.name AS eventName, s.updated_at AS submittedAt,
    a.question_id AS questionId, a.answer_json AS answerJson
    FROM attendance_events e
    JOIN attendance_participants ap ON ap.event_id = e.id
    LEFT JOIN program_feedback_submissions s ON s.participant_id = ap.id
    LEFT JOIN program_feedback_answers a ON a.submission_id = s.id
    WHERE e.program_id = ?${eventFilter}
    ORDER BY e.event_date DESC, ap.name COLLATE NOCASE, a.question_id`);
  const rows = eventId
    ? await statement.bind(programId, eventId).all<FeedbackResultRow>()
    : await statement.bind(programId).all<FeedbackResultRow>();
  return { rows: rows.results };
}

export async function addFeedbackQuestion(programId: number, input: { question: string; questionType: string; options: string[]; isRequired: boolean }) {
  const row = await db().prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM program_feedback_questions WHERE program_id = ?`).bind(programId).first<{ nextOrder: number }>();
  await db().prepare(`INSERT INTO program_feedback_questions (program_id, question, question_type, options_json, is_required, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(programId, input.question, input.questionType, JSON.stringify(input.options), input.isRequired ? 1 : 0, Number(row?.nextOrder || 1)).run();
  return getProgramFeedback(programId);
}

export async function deleteFeedbackQuestion(programId: number, questionId: number) {
  await db().prepare(`DELETE FROM program_feedback_answers WHERE question_id = ?`).bind(questionId).run();
  const result = await db().prepare(`DELETE FROM program_feedback_questions WHERE id = ? AND program_id = ?`).bind(questionId, programId).run();
  return Boolean(result.meta.changes);
}

export async function setFeedbackOpen(programId: number, eventId: number, open: boolean) {
  const result = await db().prepare(`UPDATE attendance_events SET feedback_open = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND program_id = ?`).bind(open ? 1 : 0, eventId, programId).run();
  return Boolean(result.meta.changes);
}

export async function getPublicFeedback(token: string) {
  const participant = await db().prepare(`SELECT ap.id, ap.name, ap.event_id AS eventId, e.name AS eventName,
    e.program_id AS programId, e.feedback_open AS feedbackOpen, p.title AS programTitle
    FROM attendance_participants ap JOIN attendance_events e ON e.id = ap.event_id
    JOIN programs p ON p.id = e.program_id WHERE ap.qr_token = ? LIMIT 1`).bind(token).first<{ id: number; name: string; eventId: number; eventName: string; programId: number; feedbackOpen: number; programTitle: string }>();
  if (!participant) return null;
  const questions = await db().prepare(`SELECT id, question, question_type AS questionType, options_json AS optionsJson,
    is_required AS isRequired FROM program_feedback_questions WHERE program_id = ? AND is_active = 1 ORDER BY sort_order, id`).bind(participant.programId).all<FeedbackQuestion>();
  const existing = await db().prepare(`SELECT s.id, a.question_id AS questionId, a.answer_json AS answerJson
    FROM program_feedback_submissions s LEFT JOIN program_feedback_answers a ON a.submission_id = s.id
    WHERE s.participant_id = ?`).bind(participant.id).all<{ id: number; questionId: number | null; answerJson: string | null }>();
  return { participant, questions: questions.results, answers: existing.results };
}

export async function getPublicEventFeedback(eventId: number) {
  return db().prepare(`SELECT e.id, e.name AS eventName, e.feedback_open AS feedbackOpen,
    p.title AS programTitle
    FROM attendance_events e JOIN programs p ON p.id = e.program_id
    WHERE e.id = ? LIMIT 1`).bind(eventId).first<{ id: number; eventName: string; feedbackOpen: number; programTitle: string }>();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export async function identifyFeedbackParticipant(eventId: number, identity: string) {
  const event = await getPublicEventFeedback(eventId);
  if (!event) throw new Error("Event tidak ditemukan.");
  if (!event.feedbackOpen) throw new Error("Form feedback belum dibuka oleh panitia.");
  const entered = identity.trim();
  if (!entered) throw new Error("Nomor WhatsApp atau kode peserta wajib diisi.");
  const participants = await db().prepare(`SELECT id, phone, qr_token AS qrToken
    FROM attendance_participants WHERE event_id = ?`).bind(eventId).all<{ id: number; phone: string; qrToken: string }>();
  const normalized = normalizePhone(entered);
  const participant = participants.results.find((row: { id: number; phone: string; qrToken: string }) => row.qrToken === entered || (normalized.length >= 9 && normalizePhone(row.phone) === normalized));
  if (!participant) throw new Error("Data peserta tidak ditemukan. Pastikan nomor WhatsApp sama dengan saat registrasi.");
  return { token: participant.qrToken };
}

export async function savePublicFeedback(token: string, answers: Record<string, unknown>) {
  const data = await getPublicFeedback(token);
  if (!data || !data.participant.feedbackOpen) throw new Error("Form feedback belum dibuka.");
  for (const q of data.questions as FeedbackQuestion[]) if (q.isRequired && (answers[String(q.id)] === undefined || answers[String(q.id)] === "" || (Array.isArray(answers[String(q.id)]) && !(answers[String(q.id)] as unknown[]).length))) throw new Error(`Pertanyaan wajib belum dijawab: ${q.question}`);
  const d = db();
  await d.prepare(`INSERT INTO program_feedback_submissions (program_id, event_id, participant_id, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(participant_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`).bind(data.participant.programId, data.participant.eventId, data.participant.id).run();
  const submission = await d.prepare(`SELECT id FROM program_feedback_submissions WHERE participant_id = ?`).bind(data.participant.id).first<{ id: number }>();
  if (!submission) throw new Error("Feedback belum dapat disimpan.");
  await d.prepare(`DELETE FROM program_feedback_answers WHERE submission_id = ?`).bind(submission.id).run();
  const rows = (data.questions as FeedbackQuestion[]).filter((q) => answers[String(q.id)] !== undefined).map((q) => d.prepare(`INSERT INTO program_feedback_answers (submission_id, question_id, answer_json) VALUES (?, ?, ?)`)
    .bind(submission.id, q.id, typeof answers[String(q.id)] === "string" ? answers[String(q.id)] : JSON.stringify(answers[String(q.id)])));
  if (rows.length) await d.batch(rows);
  return true;
}
