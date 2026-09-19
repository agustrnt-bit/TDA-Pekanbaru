import { env } from "cloudflare:workers";

function db() { if (!env.DB) throw new Error("Database belum tersedia"); return env.DB; }
function bucket() { if (!env.BUCKET) throw new Error("Penyimpanan flyer belum tersedia"); return env.BUCKET; }

export type ProgramPublication = {
  programId: number; programCode: string; programTitle: string; divisionId: number; divisionName: string;
  startDate: string; endDate: string; isPublished: number; publicTitle: string; tagline: string;
  description: string; benefits: string; audience: string; contactName: string; contactPhone: string;
  registrationEventId: number | null; registrationEventName: string | null; registrationOpen: number | null;
  eventDate: string | null; eventLocation: string | null; eventIsPaid: number | null;
  publicPrice: number | null; memberPrice: number | null; isFeatured: number;
  flyerKey: string | null; flyerName: string | null; flyerType: string | null;
};

const select = `SELECT p.id AS programId, p.program_code AS programCode, p.title AS programTitle,
  p.division_id AS divisionId, d.name AS divisionName, p.start_date AS startDate, p.end_date AS endDate,
  COALESCE(pp.is_published, 0) AS isPublished, COALESCE(pp.public_title, '') AS publicTitle,
  COALESCE(pp.tagline, '') AS tagline, COALESCE(pp.description, '') AS description,
  COALESCE(pp.benefits, '') AS benefits, COALESCE(pp.audience, '') AS audience,
  COALESCE(pp.contact_name, '') AS contactName, COALESCE(pp.contact_phone, '') AS contactPhone,
  pp.registration_event_id AS registrationEventId, e.name AS registrationEventName,
  e.registration_open AS registrationOpen, e.event_date AS eventDate, e.location AS eventLocation,
  e.is_paid AS eventIsPaid, e.public_price AS publicPrice, e.member_price AS memberPrice,
  COALESCE(pp.is_featured, 0) AS isFeatured, pp.flyer_key AS flyerKey,
  pp.flyer_name AS flyerName, pp.flyer_type AS flyerType
  FROM programs p JOIN divisions d ON d.id = p.division_id
  LEFT JOIN program_publications pp ON pp.program_id = p.id
  LEFT JOIN attendance_events e ON e.id = COALESCE(
    (SELECT ae.id FROM attendance_events ae
      WHERE ae.program_id = p.id AND ae.is_active = 1 AND ae.registration_open = 1
      ORDER BY ae.event_date DESC, ae.id DESC LIMIT 1),
    pp.registration_event_id,
    (SELECT ae.id FROM attendance_events ae
      WHERE ae.program_id = p.id AND ae.is_active = 1
      ORDER BY ae.event_date DESC, ae.id DESC LIMIT 1)
  )`;

export async function getProgramPublication(programId: number) {
  return db().prepare(`${select} WHERE p.id = ? LIMIT 1`).bind(programId).first<ProgramPublication>();
}

export async function getPublicProgram(code: string) {
  return db().prepare(`${select} WHERE LOWER(p.program_code) = LOWER(?) AND pp.is_published = 1 LIMIT 1`).bind(code).first<ProgramPublication>();
}

export async function listPublicPrograms() {
  return (await db().prepare(`${select} WHERE pp.is_published = 1
    ORDER BY pp.is_featured DESC, CASE WHEN p.start_date = '' THEN 1 ELSE 0 END, p.start_date, p.title COLLATE NOCASE`).all<ProgramPublication>()).results;
}

export async function listProgramRegistrationEvents(programId: number) {
  return (await db().prepare(`SELECT id, name, event_date AS eventDate, registration_open AS registrationOpen,
    is_paid AS isPaid FROM attendance_events WHERE program_id = ? ORDER BY event_date DESC, id DESC`)
    .bind(programId).all<{ id: number; name: string; eventDate: string; registrationOpen: number; isPaid: number }>()).results;
}

export async function saveProgramPublication(programId: number, input: {
  isPublished: boolean; publicTitle: string; tagline: string; description: string; benefits: string;
  audience: string; contactName: string; contactPhone: string; registrationEventId: number | null;
  isFeatured: boolean;
}, userId: number) {
  if (input.registrationEventId) {
    const event = await db().prepare(`SELECT id FROM attendance_events WHERE id = ? AND program_id = ? LIMIT 1`)
      .bind(input.registrationEventId, programId).first<{ id: number }>();
    if (!event) throw new Error("EVENT_NOT_FOUND");
  }
  await db().prepare(`INSERT INTO program_publications
    (program_id, is_published, public_title, tagline, description, benefits, audience, contact_name,
      contact_phone, registration_event_id, is_featured, updated_by_user_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(program_id) DO UPDATE SET is_published = excluded.is_published,
      public_title = excluded.public_title, tagline = excluded.tagline, description = excluded.description,
      benefits = excluded.benefits, audience = excluded.audience, contact_name = excluded.contact_name,
      contact_phone = excluded.contact_phone, registration_event_id = excluded.registration_event_id,
      is_featured = excluded.is_featured, updated_by_user_id = excluded.updated_by_user_id,
      updated_at = CURRENT_TIMESTAMP`)
    .bind(programId, input.isPublished ? 1 : 0, input.publicTitle, input.tagline, input.description,
      input.benefits, input.audience, input.contactName, input.contactPhone, input.registrationEventId,
      input.isFeatured ? 1 : 0, userId).run();
  return getProgramPublication(programId);
}

export async function saveProgramFlyer(programId: number, file: File) {
  const old = await db().prepare(`SELECT flyer_key AS flyerKey FROM program_publications WHERE program_id = ?`).bind(programId).first<{ flyerKey: string | null }>();
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) : "jpg";
  const key = `program-flyers/${programId}/${crypto.randomUUID()}.${extension || "jpg"}`;
  await bucket().put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  await db().prepare(`INSERT INTO program_publications (program_id, flyer_key, flyer_name, flyer_type, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(program_id) DO UPDATE SET flyer_key = excluded.flyer_key,
    flyer_name = excluded.flyer_name, flyer_type = excluded.flyer_type, updated_at = CURRENT_TIMESTAMP`)
    .bind(programId, key, file.name, file.type).run();
  if (old?.flyerKey) await bucket().delete(old.flyerKey).catch(() => undefined);
  return key;
}

export async function getProgramFlyer(code: string) {
  const row = await db().prepare(`SELECT pp.flyer_key AS flyerKey, pp.flyer_name AS flyerName, pp.flyer_type AS flyerType
    FROM program_publications pp JOIN programs p ON p.id = pp.program_id
    WHERE LOWER(p.program_code) = LOWER(?) AND pp.is_published = 1 LIMIT 1`).bind(code)
    .first<{ flyerKey: string | null; flyerName: string | null; flyerType: string | null }>();
  if (!row?.flyerKey) return null;
  const object = await bucket().get(row.flyerKey);
  return object ? { object, name: row.flyerName, type: row.flyerType } : null;
}
