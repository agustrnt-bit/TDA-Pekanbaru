CREATE TABLE `notification_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`run_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_runs_user_date` ON `notification_runs` (`user_id`,`run_date`);--> statement-breakpoint
CREATE INDEX `idx_programs_end_date` ON `programs` (`end_date`);