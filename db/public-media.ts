import { env } from "cloudflare:workers";

function db() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}
function bucket() {
  if (!env.BUCKET) throw new Error("Penyimpanan gambar belum tersedia");
  return env.BUCKET;
}

export type PublicMediaItem = {
  id: number;
  mediaType: "banner" | "gallery";
  title: string;
  description: string;
  eventDate: string;
  linkUrl: string;
  imageName: string;
  imageType: string;
  sortOrder: number;
  isActive: number;
};

export type PublicMediaInput = {
  mediaType: "banner" | "gallery";
  title: string;
  description: string;
  eventDate: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
};

const columns = `SELECT id, media_type AS mediaType, title, description, event_date AS eventDate,
  link_url AS linkUrl, image_name AS imageName, image_type AS imageType, sort_order AS sortOrder,
  is_active AS isActive FROM public_media`;

export async function listPublicMedia(
  type?: "banner" | "gallery",
  activeOnly = false,
) {
  const where = [
    type ? "media_type = ?" : "",
    activeOnly ? "is_active = 1" : "",
  ]
    .filter(Boolean)
    .join(" AND ");
  const query = `${columns}${where ? ` WHERE ${where}` : ""} ORDER BY sort_order, id DESC${activeOnly ? ` LIMIT ${type === "banner" ? 8 : 18}` : ""}`;
  const statement = db().prepare(query);
  return (
    await (type ? statement.bind(type) : statement).all<PublicMediaItem>()
  ).results;
}

export async function createPublicMedia(
  input: PublicMediaInput,
  file: File,
  userId: number,
) {
  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const key = `public-media/${input.mediaType}/${crypto.randomUUID()}.${extension}`;
  await bucket().put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  try {
    const result = await db()
      .prepare(
        `INSERT INTO public_media
      (media_type, title, description, event_date, link_url, image_key, image_name, image_type, sort_order, is_active, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.mediaType,
        input.title,
        input.description,
        input.eventDate,
        input.linkUrl,
        key,
        file.name,
        file.type,
        input.sortOrder,
        input.isActive ? 1 : 0,
        userId,
      )
      .run();
    return Number(result.meta.last_row_id);
  } catch (error) {
    await bucket()
      .delete(key)
      .catch(() => undefined);
    throw error;
  }
}

export async function updatePublicMedia(id: number, input: PublicMediaInput) {
  await db()
    .prepare(
      `UPDATE public_media SET media_type = ?, title = ?, description = ?, event_date = ?,
    link_url = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(
      input.mediaType,
      input.title,
      input.description,
      input.eventDate,
      input.linkUrl,
      input.sortOrder,
      input.isActive ? 1 : 0,
      id,
    )
    .run();
}

export async function deletePublicMedia(id: number) {
  const row = await db()
    .prepare(`SELECT image_key AS imageKey FROM public_media WHERE id = ?`)
    .bind(id)
    .first<{ imageKey: string }>();
  await db().prepare(`DELETE FROM public_media WHERE id = ?`).bind(id).run();
  if (row?.imageKey)
    await bucket()
      .delete(row.imageKey)
      .catch(() => undefined);
}

export async function getPublicMediaImage(id: number, activeOnly: boolean) {
  const row = await db()
    .prepare(
      `SELECT image_key AS imageKey, image_name AS imageName, image_type AS imageType
    FROM public_media WHERE id = ?${activeOnly ? " AND is_active = 1" : ""} LIMIT 1`,
    )
    .bind(id)
    .first<{ imageKey: string; imageName: string; imageType: string }>();
  if (!row) return null;
  const object = await bucket().get(row.imageKey);
  return object ? { object, ...row } : null;
}
