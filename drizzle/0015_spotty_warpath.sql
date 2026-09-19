CREATE TABLE `treasury_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'bank' NOT NULL,
	`bank_name` text DEFAULT '' NOT NULL,
	`account_number` text DEFAULT '' NOT NULL,
	`account_holder` text DEFAULT '' NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `treasury_accounts_code_unique` ON `treasury_accounts` (`code`);--> statement-breakpoint
CREATE TABLE `treasury_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`direction` text NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'Lainnya' NOT NULL,
	`transaction_date` text NOT NULL,
	`amount` integer NOT NULL,
	`transfer_group` text,
	`created_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `treasury_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_treasury_transactions_account_date` ON `treasury_transactions` (`account_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_treasury_transactions_transfer_group` ON `treasury_transactions` (`transfer_group`);--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `treasury_account_id` integer REFERENCES treasury_accounts(id);--> statement-breakpoint
CREATE INDEX `idx_attendance_events_treasury_account` ON `attendance_events` (`treasury_account_id`);--> statement-breakpoint
ALTER TABLE `program_expenses` ADD `treasury_account_id` integer REFERENCES treasury_accounts(id);--> statement-breakpoint
CREATE INDEX `idx_program_expenses_treasury_account` ON `program_expenses` (`treasury_account_id`);--> statement-breakpoint
ALTER TABLE `program_incomes` ADD `treasury_account_id` integer REFERENCES treasury_accounts(id);--> statement-breakpoint
CREATE INDEX `idx_program_incomes_treasury_account` ON `program_incomes` (`treasury_account_id`);