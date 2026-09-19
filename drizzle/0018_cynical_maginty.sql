CREATE TABLE `membership_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_membership_options_type_label` ON `membership_options` (`type`,`label`);--> statement-breakpoint
CREATE INDEX `idx_membership_options_type_active` ON `membership_options` (`type`,`is_active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `membership_registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_code` text NOT NULL,
	`registration_type` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`whatsapp` text NOT NULL,
	`business_name` text DEFAULT '' NOT NULL,
	`business_field` text NOT NULL,
	`business_age` text NOT NULL,
	`employee_count` integer DEFAULT 0 NOT NULL,
	`annual_revenue` text NOT NULL,
	`previous_training` text DEFAULT '' NOT NULL,
	`business_issues` text DEFAULT '[]' NOT NULL,
	`existing_systems` text DEFAULT '[]' NOT NULL,
	`tda_goal` text DEFAULT '' NOT NULL,
	`information_source` text DEFAULT '' NOT NULL,
	`package_code` text NOT NULL,
	`package_name` text NOT NULL,
	`amount_due` integer NOT NULL,
	`includes_shirt` integer DEFAULT false NOT NULL,
	`shirt_size` text DEFAULT '' NOT NULL,
	`treasury_account_id` integer,
	`payment_method` text DEFAULT '' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`payment_proof_key` text,
	`payment_proof_name` text,
	`payment_proof_type` text,
	`payment_confirmed_at` text,
	`payment_verified_at` text,
	`payment_verified_by_user_id` integer,
	`payment_received_amount` integer DEFAULT 0 NOT NULL,
	`payment_paid_at` text,
	`payment_note` text DEFAULT '' NOT NULL,
	`member_status` text DEFAULT 'menunggu_pembayaran' NOT NULL,
	`shirt_status` text DEFAULT 'belum_diproses' NOT NULL,
	`confirmation_token` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`treasury_account_id`) REFERENCES `treasury_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_registrations_registration_code_unique` ON `membership_registrations` (`registration_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `membership_registrations_confirmation_token_unique` ON `membership_registrations` (`confirmation_token`);--> statement-breakpoint
CREATE INDEX `idx_membership_registrations_status` ON `membership_registrations` (`payment_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_membership_registrations_whatsapp` ON `membership_registrations` (`whatsapp`);--> statement-breakpoint
CREATE INDEX `idx_membership_registrations_type` ON `membership_registrations` (`registration_type`);--> statement-breakpoint
CREATE INDEX `idx_membership_registrations_treasury` ON `membership_registrations` (`treasury_account_id`);--> statement-breakpoint
CREATE TABLE `membership_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`admin_whatsapp` text DEFAULT '6285121804468' NOT NULL,
	`treasury_account_id` integer,
	`qris_key` text,
	`qris_name` text,
	`qris_type` text,
	`payment_instructions` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`treasury_account_id`) REFERENCES `treasury_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
