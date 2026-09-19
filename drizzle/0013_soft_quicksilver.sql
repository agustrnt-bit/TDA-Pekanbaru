ALTER TABLE `attendance_events` ADD `program_id` integer REFERENCES programs(id);--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `is_paid` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `public_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `member_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `committee_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `early_bird_public_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `early_bird_member_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `early_bird_committee_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `early_bird_ends_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `bank_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `bank_account_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `bank_account_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `payment_instructions` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `qris_key` text;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `qris_name` text;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `qris_type` text;--> statement-breakpoint
CREATE INDEX `idx_attendance_events_program_id` ON `attendance_events` (`program_id`);--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `passport_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `amount_due` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `price_label` text DEFAULT 'Gratis' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_status` text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_method` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_proof_key` text;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_proof_name` text;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_proof_type` text;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_confirmed_at` text;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_verified_at` text;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_verified_by_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_attendance_participants_event_payment` ON `attendance_participants` (`event_id`,`payment_status`);