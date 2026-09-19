CREATE TABLE `program_incomes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`description` text NOT NULL,
	`source` text DEFAULT 'Lainnya' NOT NULL,
	`income_date` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`receipt_key` text,
	`receipt_name` text,
	`receipt_type` text,
	`created_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_program_incomes_program_date` ON `program_incomes` (`program_id`,`income_date`);--> statement-breakpoint
ALTER TABLE `programs` ADD `income_budget` integer DEFAULT 0 NOT NULL;