CREATE TABLE IF NOT EXISTS public_member_submissions (
  id BIGSERIAL PRIMARY KEY,

  member_name TEXT NOT NULL,
  tda_passport TEXT,
  whatsapp TEXT NOT NULL,

  business_name TEXT NOT NULL,
  business_category TEXT DEFAULT '' NOT NULL,
  business_description TEXT DEFAULT '' NOT NULL,
  business_location TEXT DEFAULT '' NOT NULL,

  instagram_url TEXT DEFAULT '' NOT NULL,
  website_url TEXT DEFAULT '' NOT NULL,
  marketplace_url TEXT DEFAULT '' NOT NULL,

  logo_key TEXT,
  logo_name TEXT,
  logo_type TEXT,

  business_photo_key TEXT,
  business_photo_name TEXT,
  business_photo_type TEXT,

  position_title TEXT DEFAULT '' NOT NULL,
  testimonial TEXT DEFAULT '' NOT NULL,

  profile_photo_key TEXT,
  profile_photo_name TEXT,
  profile_photo_type TEXT,

  publication_consent BIGINT DEFAULT 0 NOT NULL,

  review_status TEXT DEFAULT 'pending' NOT NULL,
  publish_business BIGINT DEFAULT 0 NOT NULL,
  publish_testimonial BIGINT DEFAULT 0 NOT NULL,

  admin_notes TEXT DEFAULT '' NOT NULL,
  reviewed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

  business_published_at TEXT,
  testimonial_published_at TEXT,

  created_at TEXT DEFAULT (
    to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    'YYYY-MM-DD HH24:MI:SS')
  ) NOT NULL,

  updated_at TEXT DEFAULT (
    to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    'YYYY-MM-DD HH24:MI:SS')
  ) NOT NULL
);
