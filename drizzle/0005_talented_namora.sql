CREATE TABLE `program_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`title` text NOT NULL,
	`pic` text DEFAULT '' NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'belum_mulai' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_program_tasks_program_status` ON `program_tasks` (`program_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_program_tasks_due_date` ON `program_tasks` (`due_date`);--> statement-breakpoint
ALTER TABLE `programs` ADD `pic` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `start_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `end_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `target` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `budget` integer DEFAULT 0 NOT NULL;