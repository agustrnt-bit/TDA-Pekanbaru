import { env } from "cloudflare:workers";

export async function createPublicMemberSubmission(input:any) {
  if (!env.DB) throw new Error("Database belum tersedia");

  const result = await env.DB.prepare(`
    INSERT INTO public_member_submissions (
      member_name, tda_passport, whatsapp,
      business_name, business_category, business_description,
      business_location, instagram_url, website_url, marketplace_url,
      logo_key, logo_name, logo_type,
      business_photo_key, business_photo_name, business_photo_type,
      position_title, testimonial,
      profile_photo_key, profile_photo_name, profile_photo_type,
      publication_consent, review_status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'pending')
    RETURNING id
  `).bind(...input).first<{id:number}>();

  return result?.id;
}

export async function listPublicMemberSubmissions() {
  if (!env.DB) throw new Error("Database belum tersedia");

  return env.DB.prepare(`
    SELECT id,
      member_name AS memberName,
      business_name AS businessName,
      whatsapp,
      review_status AS reviewStatus,
      publish_business AS publishBusiness,
      publish_testimonial AS publishTestimonial,
      created_at AS createdAt
    FROM public_member_submissions
    ORDER BY id DESC
  `).all();
}

export async function getPublicMemberSubmission(id:number) {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB.prepare(`
    SELECT *,
      member_name AS memberName, tda_passport AS tdaPassport,
      business_name AS businessName, business_category AS businessCategory,
      business_description AS businessDescription,
      business_location AS businessLocation, position_title AS positionTitle,
      instagram_url AS instagramUrl, website_url AS websiteUrl,
      marketplace_url AS marketplaceUrl,
      logo_key AS logoKey, logo_type AS logoType,
      business_photo_key AS businessPhotoKey,
      business_photo_type AS businessPhotoType,
      profile_photo_key AS profilePhotoKey,
      profile_photo_type AS profilePhotoType,
      review_status AS reviewStatus
    FROM public_member_submissions WHERE id=? LIMIT 1
  `).bind(id).first();
}

export async function reviewPublicMemberSubmission(id:number,status:string,business:number,testimonial:number,userId:number) {
  if (!env.DB) throw new Error("Database belum tersedia");
  await env.DB.prepare(`
    UPDATE public_member_submissions SET
      review_status=?, publish_business=?, publish_testimonial=?,
      reviewed_by_user_id=?, updated_at=datetime('now'),
      business_published_at=CASE WHEN ?=1 THEN datetime('now') ELSE business_published_at END,
      testimonial_published_at=CASE WHEN ?=1 THEN datetime('now') ELSE testimonial_published_at END
    WHERE id=?
  `).bind(status,business,testimonial,userId,business,testimonial,id).run();
}

export async function listPublishedBusinesses() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB.prepare(`
    SELECT id, member_name AS memberName, business_name AS businessName,
      business_category AS businessCategory,
      business_description AS businessDescription,
      business_location AS businessLocation,
      instagram_url AS instagramUrl, website_url AS websiteUrl
    FROM public_member_submissions
    WHERE review_status='published' AND publish_business=1
    ORDER BY business_published_at DESC, id DESC
  `).all();
}

export async function listPublishedTestimonials() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB.prepare(`
    SELECT id, member_name AS memberName, business_name AS businessName,
      position_title AS positionTitle, testimonial
    FROM public_member_submissions
    WHERE review_status='published' AND publish_testimonial=1
    ORDER BY testimonial_published_at DESC, id DESC
  `).all();
}

export async function updatePublicMemberSubmission(id:number,input:any) {
  if (!env.DB) throw new Error("Database belum tersedia");

  return env.DB.prepare(`
    UPDATE public_member_submissions SET
      member_name=?, tda_passport=?, whatsapp=?,
      business_name=?, business_category=?,
      business_description=?, business_location=?,
      instagram_url=?, website_url=?, marketplace_url=?,
      position_title=?, testimonial=?,
      updated_at=datetime('now')
    WHERE id=?
  `).bind(
    input.memberName||"", input.tdaPassport||"", input.whatsapp||"",
    input.businessName||"", input.businessCategory||"",
    input.businessDescription||"", input.businessLocation||"",
    input.instagramUrl||"", input.websiteUrl||"",
    input.marketplaceUrl||"", input.positionTitle||"",
    input.testimonial||"", id
  ).run();
}

export async function deletePublicMemberSubmission(id:number) {
  if (!env.DB) throw new Error("Database belum tersedia");

  return env.DB.prepare(`
    DELETE FROM public_member_submissions
    WHERE id=?
  `).bind(id).run();
}
