ALTER TABLE `attendance_events` ADD `public_title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `collaboration_partner` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `is_collaboration` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `flyer_key` text;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `flyer_name` text;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `flyer_type` text;