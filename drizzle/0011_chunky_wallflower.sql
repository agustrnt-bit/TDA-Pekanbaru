CREATE TABLE `attendance_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`event_date` text NOT NULL,
	`start_time` text DEFAULT '' NOT NULL,
	`end_time` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_events_date` ON `attendance_events` (`event_date`);--> statement-breakpoint
CREATE TABLE `attendance_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Member' NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`qr_token` text NOT NULL,
	`checked_in_at` text,
	`check_in_method` text,
	`checked_in_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `attendance_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checked_in_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_participants_qr_token_unique` ON `attendance_participants` (`qr_token`);--> statement-breakpoint
CREATE INDEX `idx_attendance_participants_event_status` ON `attendance_participants` (`event_id`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX `idx_attendance_participants_event_name` ON `attendance_participants` (`event_id`,`name`);