CREATE TABLE `program_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'Lainnya' NOT NULL,
	`expense_date` text NOT NULL,
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
CREATE INDEX `idx_program_expenses_program_date` ON `program_expenses` (`program_id`,`expense_date`);--> statement-breakpoint
CREATE TABLE `program_lpj` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`status` text DEFAULT 'belum_dibuat' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`evaluation` text DEFAULT '' NOT NULL,
	`submitted_at` text,
	`completed_at` text,
	`updated_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `program_lpj_program_id_unique` ON `program_lpj` (`program_id`);--> statement-breakpoint
CREATE INDEX `idx_program_lpj_status` ON `program_lpj` (`status`);