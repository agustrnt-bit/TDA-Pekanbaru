import { env } from "cloudflare:workers";

function db() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

export type PublicSiteSettings = {
  id: number;
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  contactWhatsapp: string;
  contactEmail: string;
  address: string;
  instagramUrl: string;
  youtubeUrl: string;
  linkedinUrl: string;
  tiktokUrl: string;
  footerText: string;
  seoTitle: string;
  seoDescription: string;
};

export type PublicSiteSection = {
  id: number;
  sectionKey: string;
  sectionType: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  contentJson: string;
  status: "draft" | "published" | "archived";
  isVisible: number;
  sortOrder: number;
  publishedAt: string | null;
};

export type PublicNavigationItem = {
  id: number;
  location: "header" | "footer";
  label: string;
  href: string;
  parentId: number | null;
  sortOrder: number;
  isActive: number;
};


export async function getPublicSiteSettings() {
  return db()
    .prepare(`
      SELECT
        id,
        site_name AS siteName,
        site_tagline AS siteTagline,
        site_description AS siteDescription,
        contact_whatsapp AS contactWhatsapp,
        contact_email AS contactEmail,
        address,
        instagram_url AS instagramUrl,
        youtube_url AS youtubeUrl,
        linkedin_url AS linkedinUrl,
        tiktok_url AS tiktokUrl,
        footer_text AS footerText,
        seo_title AS seoTitle,
        seo_description AS seoDescription
      FROM public_site_settings
      WHERE id = 1
      LIMIT 1
    `)
    .first<PublicSiteSettings>();
}

export async function listPublicSiteSections(publishedOnly = false) {
  const where = publishedOnly
    ? "WHERE status = 'published' AND is_visible = 1"
    : "";

  return (
    await db()
      .prepare(`
        SELECT
          id,
          section_key AS sectionKey,
          section_type AS sectionType,
          eyebrow,
          title,
          subtitle,
          body,
          primary_cta_label AS primaryCtaLabel,
          primary_cta_url AS primaryCtaUrl,
          secondary_cta_label AS secondaryCtaLabel,
          secondary_cta_url AS secondaryCtaUrl,
          content_json AS contentJson,
          status,
          is_visible AS isVisible,
          sort_order AS sortOrder,
          published_at AS publishedAt
        FROM public_site_sections
        ${where}
        ORDER BY sort_order, id
      `)
      .all<PublicSiteSection>()
  ).results;
}

export async function listPublicNavigation(
  location?: "header" | "footer",
  activeOnly = false,
) {
  const filters: string[] = [];
  const values: unknown[] = [];

  if (location) {
    filters.push("location = ?");
    values.push(location);
  }

  if (activeOnly) {
    filters.push("is_active = 1");
  }

  const where = filters.length
    ? `WHERE ${filters.join(" AND ")}`
    : "";

  const statement = db().prepare(`
    SELECT
      id,
      location,
      label,
      href,
      parent_id AS parentId,
      sort_order AS sortOrder,
      is_active AS isActive
    FROM public_navigation_items
    ${where}
    ORDER BY sort_order, id
  `);

  return (
    await (
      values.length
        ? statement.bind(...values)
        : statement
    ).all<PublicNavigationItem>()
  ).results;
}

export async function updatePublicSiteSettings(
  input: Omit<PublicSiteSettings, "id">,
  userId: number,
) {
  await db()
    .prepare(`
      UPDATE public_site_settings SET
        site_name = ?,
        site_tagline = ?,
        site_description = ?,
        contact_whatsapp = ?,
        contact_email = ?,
        address = ?,
        instagram_url = ?,
        youtube_url = ?,
        linkedin_url = ?,
        tiktok_url = ?,
        footer_text = ?,
        seo_title = ?,
        seo_description = ?,
        updated_by_user_id = ?,
        updated_at = datetime('now')
      WHERE id = 1
    `)
    .bind(
      input.siteName,
      input.siteTagline,
      input.siteDescription,
      input.contactWhatsapp,
      input.contactEmail,
      input.address,
      input.instagramUrl,
      input.youtubeUrl,
      input.linkedinUrl,
      input.tiktokUrl,
      input.footerText,
      input.seoTitle,
      input.seoDescription,
      userId,
    )
    .run();
}

export async function savePublicSiteSection(
  sectionKey: string,
  title: string,
  body: string,
  sortOrder: number,
  userId: number,
) {
  const existing = await db()
    .prepare("SELECT id FROM public_site_sections WHERE section_key = ?")
    .bind(sectionKey)
    .first<{ id: number }>();

  if (existing) {
    await db()
      .prepare(`
        UPDATE public_site_sections
        SET title = ?, body = ?, sort_order = ?,
            updated_by_user_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(title, body, sortOrder, userId, existing.id)
      .run();
    return existing.id;
  }

  const result = await db()
    .prepare(`
      INSERT INTO public_site_sections
      (section_key, title, body, sort_order, created_by_user_id, updated_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(sectionKey, title, body, sortOrder, userId, userId)
    .run();

  return Number(result.meta.last_row_id);
}

export async function setPublicSiteSectionStatus(
  id: number,
  status: "draft" | "published" | "archived",
  userId: number,
) {
  await db()
    .prepare(`
      UPDATE public_site_sections
      SET status = ?,
          published_at = CASE
            WHEN ? = 'published' THEN datetime('now')
            ELSE published_at
          END,
          updated_by_user_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(status, status, userId, id)
    .run();
}

export async function updatePublicSiteSection(
  id: number,
  input: {
    eyebrow: string;
    title: string;
    subtitle: string;
    body: string;
    contentJson: string;
    primaryCtaLabel: string;
    primaryCtaUrl: string;
    secondaryCtaLabel: string;
    secondaryCtaUrl: string;
    sortOrder: number;
    isVisible: number;
  },
  userId: number,
) {
  await db()
    .prepare(`
      UPDATE public_site_sections SET
        eyebrow = ?,
        title = ?,
        subtitle = ?,
        body = ?,
        content_json = ?,
        primary_cta_label = ?,
        primary_cta_url = ?,
        secondary_cta_label = ?,
        secondary_cta_url = ?,
        sort_order = ?,
        is_visible = ?,
        updated_by_user_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(
      input.eyebrow,
      input.title,
      input.subtitle,
      input.body,
      input.contentJson,
      input.primaryCtaLabel,
      input.primaryCtaUrl,
      input.secondaryCtaLabel,
      input.secondaryCtaUrl,
      input.sortOrder,
      input.isVisible,
      userId,
      id,
    )
    .run();
}

export async function getPublicSiteSectionImage(id: number) {
  return db()
    .prepare(`
      SELECT image_key AS imageKey,
             image_name AS imageName,
             image_type AS imageType
      FROM public_site_sections
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first<{
      imageKey: string | null;
      imageName: string | null;
      imageType: string | null;
    }>();
}

export async function setPublicSiteSectionImage(
  id: number,
  key: string,
  name: string,
  type: string,
  userId: number,
) {
  await db()
    .prepare(`
      UPDATE public_site_sections
      SET image_key = ?,
          image_name = ?,
          image_type = ?,
          updated_by_user_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(key, name, type, userId, id)
    .run();
}

export async function getPublicSiteSectionContent(id: number) {
  return db()
    .prepare(`
      SELECT section_key AS sectionKey, content_json AS contentJson
      FROM public_site_sections
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first<{ sectionKey: string; contentJson: string }>();
}

export async function setPublicSiteSectionContent(
  id: number,
  contentJson: string,
  userId: number,
) {
  await db()
    .prepare(`
      UPDATE public_site_sections
      SET content_json = ?,
          updated_by_user_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(contentJson, userId, id)
    .run();
}
