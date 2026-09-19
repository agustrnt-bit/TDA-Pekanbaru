CREATE TABLE `membership_packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_type` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`includes_shirt` integer DEFAULT false NOT NULL,
	`includes_class` integer DEFAULT false NOT NULL,
	`is_recommended` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_membership_packages_type_code` ON `membership_packages` (`registration_type`,`code`);--> statement-breakpoint
CREATE INDEX `idx_membership_packages_type_active` ON `membership_packages` (`registration_type`,`is_active`,`sort_order`);--> statement-breakpoint
ALTER TABLE `membership_registrations` ADD `passport_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `membership_registrations` ADD `sleeve_type` text DEFAULT '' NOT NULL;