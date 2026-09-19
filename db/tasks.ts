import { env } from "cloudflare:workers";

export type Category = { id: number; name: string; sortOrder: number };
export type Pic = { id: number; name: string };
export type Task = {
  id: number;
  categoryId: number;
  category: string;
  title: string;
  pic: string;
  dueDate: string;
  priority: string;
  status: string;
  notes: string;
  sortOrder: number;
};
export type Activity = {
  id: number;
  taskId: number | null;
  taskTitle: string;
  action: string;
  description: string;
  actor: string;
  createdAt: string;
  undoneAt: string | null;
  canUndo: number;
};

const seedCategories = ["PERSIAPAN", "TALKSHOW", "SERTINAH", "HARI-H", "PASCA ACARA"];
const categoryIds: Record<string, number> = { PERSIAPAN: 1, TALKSHOW: 2, SERTINAH: 3, "HARI-H": 4, "PASCA ACARA": 5 };

const seedTasks = [
  ["PERSIAPAN", "Finalisasi venue dan kepastian lokasi acara", "2026-09-02", "Tinggi"],
  ["PERSIAPAN", "Finalisasi layout ruangan dan posisi panggung", "2026-09-05", "Tinggi"],
  ["PERSIAPAN", "Finalisasi daftar undangan dan tamu VIP", "2026-09-03", "Tinggi"],
  ["PERSIAPAN", "Sebar undangan resmi / konfirmasi kehadiran", "2026-09-05", "Tinggi"],
  ["PERSIAPAN", "Publikasi flyer utama acara", "2026-09-03", "Tinggi"],
  ["PERSIAPAN", "Reminder dan countdown peserta", "2026-09-08", "Sedang"],
  ["PERSIAPAN", "Siapkan sistem registrasi / daftar hadir", "2026-09-07", "Tinggi"],
  ["PERSIAPAN", "Finalisasi jumlah konsumsi peserta, VIP, narasumber dan panitia", "2026-09-07", "Tinggi"],
  ["PERSIAPAN", "Finalisasi perlengkapan: meja, kursi, name tag, ATK, signage", "2026-09-07", "Sedang"],
  ["PERSIAPAN", "Finalisasi dekorasi, backdrop dan branding", "2026-09-06", "Tinggi"],
  ["PERSIAPAN", "Konfirmasi sponsor / partner dan benefit yang diberikan", "2026-09-04", "Tinggi"],
  ["PERSIAPAN", "Finalisasi rundown keseluruhan acara", "2026-09-06", "Tinggi"],
  ["PERSIAPAN", "Pembagian PIC dan briefing awal panitia", "2026-09-07", "Tinggi"],
  ["PERSIAPAN", "Gladi / pengecekan alur teknis acara", "2026-09-08", "Tinggi"],
  ["TALKSHOW", "Konfirmasi final narasumber", "2026-09-04", "Tinggi"],
  ["TALKSHOW", "Konfirmasi host / moderator", "2026-09-04", "Tinggi"],
  ["TALKSHOW", "Finalisasi tema dan judul talkshow", "2026-09-04", "Tinggi"],
  ["TALKSHOW", "Susun TOR / brief talkshow", "2026-09-05", "Sedang"],
  ["TALKSHOW", "Susun daftar pertanyaan host / moderator", "2026-09-07", "Tinggi"],
  ["TALKSHOW", "Minta dan cek materi / profil narasumber", "2026-09-07", "Sedang"],
  ["TALKSHOW", "Cek teknis presentasi: laptop, slide, mic, display", "2026-09-08", "Tinggi"],
  ["TALKSHOW", "Tentukan LO narasumber dan alur penyambutan", "2026-09-07", "Sedang"],
  ["SERTINAH", "Finalisasi konsep prosesi serah terima amanah 8.0 → 9.0", "2026-09-05", "Tinggi"],
  ["SERTINAH", "Finalisasi urutan sambutan 8.0 dan 9.0", "2026-09-06", "Tinggi"],
  ["SERTINAH", "Siapkan SK / dokumen serah terima", "2026-09-07", "Tinggi"],
  ["SERTINAH", "Siapkan simbol serah terima / plakat / atribut", "2026-09-07", "Tinggi"],
  ["SERTINAH", "Finalisasi pengenalan pengurus TDA Pekanbaru 9.0", "2026-09-07", "Tinggi"],
  ["SERTINAH", "Finalisasi video perjalanan TDA Pekanbaru", "2026-09-07", "Tinggi"],
  ["SERTINAH", "Cek file video, musik, bumper dan urutan tayang", "2026-09-08", "Tinggi"],
  ["SERTINAH", "Tentukan susunan dan posisi foto bersama", "2026-09-08", "Sedang"],
  ["HARI-H", "Setup venue, meja registrasi, panggung dan backdrop", "2026-09-09", "Tinggi"],
  ["HARI-H", "Briefing final seluruh panitia sebelum acara", "2026-09-09", "Tinggi"],
  ["HARI-H", "Registrasi dan penerimaan peserta", "2026-09-09", "Tinggi"],
  ["HARI-H", "Penerimaan dan pendampingan tamu VIP / narasumber", "2026-09-09", "Tinggi"],
  ["HARI-H", "Pelaksanaan protokoler dan pengaturan tempat duduk", "2026-09-09", "Tinggi"],
  ["HARI-H", "Operator multimedia / sound / presentasi standby", "2026-09-09", "Tinggi"],
  ["HARI-H", "MC memegang rundown final dan cue acara", "2026-09-09", "Tinggi"],
  ["HARI-H", "Distribusi konsumsi sesuai jadwal", "2026-09-09", "Sedang"],
  ["HARI-H", "Dokumentasi foto dan video seluruh rangkaian", "2026-09-09", "Tinggi"],
  ["HARI-H", "Time keeper memastikan acara sesuai rundown", "2026-09-09", "Tinggi"],
  ["HARI-H", "Runner standby untuk kebutuhan mendadak", "2026-09-09", "Sedang"],
  ["HARI-H", "Koordinator acara memantau keseluruhan pelaksanaan", "2026-09-09", "Tinggi"],
  ["PASCA ACARA", "Beres-beres venue dan inventaris perlengkapan", "2026-09-09", "Sedang"],
  ["PASCA ACARA", "Finalisasi pembayaran vendor / kewajiban acara", "2026-09-10", "Tinggi"],
  ["PASCA ACARA", "Kirim ucapan terima kasih kepada tamu, narasumber dan partner", "2026-09-10", "Sedang"],
  ["PASCA ACARA", "Publikasi dokumentasi / recap acara", "2026-09-10", "Sedang"],
  ["PASCA ACARA", "Evaluasi internal panitia", "2026-09-11", "Sedang"],
  ["PASCA ACARA", "Rekap laporan keuangan acara", "2026-09-12", "Tinggi"],
  ["PASCA ACARA", "Susun LPJ dan arsip dokumentasi", "2026-09-12", "Sedang"],
] as const;

function getD1() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

export async function ensureSeedData() {
  const db = getD1();
  const categoryCount = await db.prepare("SELECT COUNT(*) AS total FROM categories").first<{ total: number }>();
  if (!categoryCount?.total) {
    await db.batch(seedCategories.map((name, index) =>
      db.prepare("INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)").bind(index + 1, name, index + 1)
    ));
  }
  const taskCount = await db.prepare("SELECT COUNT(*) AS total FROM tasks").first<{ total: number }>();
  if (!taskCount?.total) {
    await db.batch(seedTasks.map(([category, title, dueDate, priority], index) =>
      db.prepare(`INSERT INTO tasks (id, category_id, title, due_date, priority, status, sort_order)
        VALUES (?, ?, ?, ?, ?, 'Belum Mulai', ?)`).bind(index + 1, categoryIds[category], title, dueDate, priority, index + 1)
    ));
  }
}

export async function listCategories(): Promise<Category[]> {
  const result = await getD1().prepare("SELECT id, name, sort_order AS sortOrder FROM categories ORDER BY sort_order, id").all<Category>();
  return result.results;
}

function cleanPicName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizedPicName(name: string) {
  return cleanPicName(name).toLowerCase();
}

async function backfillPics() {
  await getD1().prepare(`INSERT OR IGNORE INTO pics (name, normalized_name)
    SELECT MIN(TRIM(pic)), LOWER(TRIM(pic)) FROM tasks
    WHERE TRIM(pic) <> '' GROUP BY LOWER(TRIM(pic))`).run();
}

export async function listPics(): Promise<Pic[]> {
  await backfillPics();
  const result = await getD1().prepare("SELECT id, name FROM pics ORDER BY name COLLATE NOCASE, id").all<Pic>();
  return result.results;
}

export async function createPic(name: string, actor = "Panitia"): Promise<{ pic: Pic; created: boolean }> {
  const db = getD1();
  const cleaned = cleanPicName(name);
  const normalized = normalizedPicName(cleaned);
  const existing = await db.prepare("SELECT id, name FROM pics WHERE normalized_name = ?").bind(normalized).first<Pic>();
  if (existing) return { pic: existing, created: false };
  const pic = await db.prepare("INSERT INTO pics (name, normalized_name) VALUES (?, ?) RETURNING id, name")
    .bind(cleaned, normalized).first<Pic>();
  if (!pic) throw new Error("PIC belum dapat disimpan");
  await db.prepare(`INSERT INTO activities (task_title, action, description, actor)
    VALUES ('', 'created_pic', ?, ?)`).bind(`Mendaftarkan PIC ${pic.name}`, actor).run();
  return { pic, created: true };
}

export async function canonicalPicName(name: string): Promise<string | null> {
  const cleaned = cleanPicName(name);
  if (!cleaned) return "";
  await backfillPics();
  const pic = await getD1().prepare("SELECT name FROM pics WHERE normalized_name = ?")
    .bind(normalizedPicName(cleaned)).first<{ name: string }>();
  return pic?.name ?? null;
}

export async function createCategory(name: string, actor = "Panitia"): Promise<Category | null> {
  const db = getD1();
  const max = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM categories").first<{ value: number }>();
  const category = await db.prepare(`INSERT INTO categories (name, sort_order) VALUES (?, ?)
    RETURNING id, name, sort_order AS sortOrder`).bind(name, (max?.value ?? 0) + 1).first<Category>();
  if (category) {
    await db.prepare(`INSERT INTO activities (task_title, action, description, actor)
      VALUES ('', 'created_category', ?, ?)`).bind(`Menambahkan kategori ${name}`, actor).run();
  }
  return category;
}

export async function listTasks(): Promise<Task[]> {
  const result = await getD1().prepare(`SELECT t.id, t.category_id AS categoryId, c.name AS category,
    t.title, t.pic, t.due_date AS dueDate, t.priority, t.status, t.notes, t.sort_order AS sortOrder
    FROM tasks t JOIN categories c ON c.id = t.category_id
    WHERE t.deleted_at IS NULL ORDER BY t.sort_order, t.id`).all<Task>();
  return result.results;
}

export async function createTask(input: Omit<Task, "id" | "category" | "sortOrder">, actor = "Panitia"): Promise<Task | null> {
  const db = getD1();
  const max = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM tasks").first<{ value: number }>();
  const task = await db.prepare(`INSERT INTO tasks (category_id, title, pic, due_date, priority, status, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, category_id AS categoryId, '' AS category, title,
    pic, due_date AS dueDate, priority, status, notes, sort_order AS sortOrder`).bind(
      input.categoryId, input.title, input.pic, input.dueDate, input.priority, input.status,
      input.notes, (max?.value ?? 0) + 1
    ).first<Task>();
  if (task) {
    await db.prepare(`INSERT INTO activities (task_id, task_title, action, description, actor, new_data)
      VALUES (?, ?, 'created_task', 'Menambahkan pekerjaan', ?, ?)`).bind(
        task.id, task.title, actor, JSON.stringify(input)
      ).run();
  }
  return task;
}

export async function updateTask(id: number, input: Partial<Omit<Task, "id" | "category" | "sortOrder">>, actor = "Panitia"): Promise<Task | null> {
  const db = getD1();
  const current = await db.prepare(`SELECT id, category_id AS categoryId, '' AS category, title, pic,
    due_date AS dueDate, priority, status, notes, sort_order AS sortOrder FROM tasks
    WHERE id = ? AND deleted_at IS NULL`).bind(id).first<Task>();
  if (!current) return null;
  const next = { ...current, ...input };
  const fields: (keyof Pick<Task, "categoryId" | "title" | "pic" | "dueDate" | "priority" | "status" | "notes">)[] =
    ["categoryId", "title", "pic", "dueDate", "priority", "status", "notes"];
  const changed = fields.filter((field) => current[field] !== next[field]);
  if (changed.length) {
    const description = changed.length === 1 && changed[0] === "status"
      ? `Mengubah status menjadi ${next.status}`
      : `Memperbarui ${changed.map((field) => ({ categoryId: "kategori", title: "pekerjaan", pic: "PIC", dueDate: "due date", priority: "prioritas", status: "status", notes: "catatan" })[field]).join(", ")}`;
    await db.batch([
      db.prepare(`UPDATE tasks SET category_id = ?, title = ?, pic = ?, due_date = ?, priority = ?,
        status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(
          next.categoryId, next.title, next.pic, next.dueDate, next.priority, next.status, next.notes, id
      ),
      db.prepare(`INSERT INTO activities (task_id, task_title, action, description, actor, old_data, new_data)
        VALUES (?, ?, 'updated_task', ?, ?, ?, ?)`).bind(
          id, next.title, description, actor,
          JSON.stringify({ categoryId: current.categoryId, title: current.title, pic: current.pic, dueDate: current.dueDate, priority: current.priority, status: current.status, notes: current.notes }),
          JSON.stringify({ categoryId: next.categoryId, title: next.title, pic: next.pic, dueDate: next.dueDate, priority: next.priority, status: next.status, notes: next.notes })
      ),
    ]);
  }
  return db.prepare(`SELECT t.id, t.category_id AS categoryId, c.name AS category, t.title, t.pic,
    t.due_date AS dueDate, t.priority, t.status, t.notes, t.sort_order AS sortOrder FROM tasks t
    JOIN categories c ON c.id = t.category_id WHERE t.id = ? AND t.deleted_at IS NULL`).bind(id).first<Task>();
}

export async function deleteTask(id: number, actor = "Panitia"): Promise<boolean> {
  const db = getD1();
  const current = await db.prepare(`SELECT id, category_id AS categoryId, '' AS category, title, pic,
    due_date AS dueDate, priority, status, notes, sort_order AS sortOrder FROM tasks
    WHERE id = ? AND deleted_at IS NULL`).bind(id).first<Task>();
  if (!current) return false;

  const oldData = JSON.stringify({
    categoryId: current.categoryId, title: current.title, pic: current.pic,
    dueDate: current.dueDate, priority: current.priority, status: current.status, notes: current.notes,
  });
  await db.batch([
    db.prepare(`UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`).bind(id),
    db.prepare(`INSERT INTO activities (task_id, task_title, action, description, actor, old_data)
      VALUES (?, ?, 'deleted_task', 'Menghapus pekerjaan', ?, ?)`).bind(id, current.title, actor, oldData),
  ]);
  return true;
}

export async function listActivities(): Promise<Activity[]> {
  const result = await getD1().prepare(`SELECT a.id, a.task_id AS taskId, a.task_title AS taskTitle,
    a.action, a.description, a.actor, a.created_at AS createdAt, a.undone_at AS undoneAt,
    CASE WHEN a.old_data IS NOT NULL AND a.undone_at IS NULL AND a.id = (
      SELECT MAX(a2.id) FROM activities a2 WHERE a2.task_id = a.task_id AND a2.old_data IS NOT NULL AND a2.undone_at IS NULL
    ) THEN 1 ELSE 0 END AS canUndo
    FROM activities a ORDER BY a.id DESC LIMIT 80`).all<Activity>();
  return result.results;
}

export async function undoActivity(id: number): Promise<boolean> {
  const db = getD1();
  const activity = await db.prepare(`SELECT a.task_id AS taskId, a.old_data AS oldData FROM activities a
    WHERE a.id = ? AND a.old_data IS NOT NULL AND a.undone_at IS NULL AND a.id = (
      SELECT MAX(a2.id) FROM activities a2 WHERE a2.task_id = a.task_id AND a2.old_data IS NOT NULL AND a2.undone_at IS NULL
    )`).bind(id).first<{ taskId: number; oldData: string }>();
  if (!activity) return false;
  const old = JSON.parse(activity.oldData) as Omit<Task, "id" | "category" | "sortOrder">;
  await db.batch([
    db.prepare(`UPDATE tasks SET category_id = ?, title = ?, pic = ?, due_date = ?, priority = ?,
      status = ?, notes = ?, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(
        old.categoryId, old.title, old.pic, old.dueDate, old.priority, old.status, old.notes, activity.taskId
    ),
    db.prepare("UPDATE activities SET undone_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
  ]);
  return true;
}
