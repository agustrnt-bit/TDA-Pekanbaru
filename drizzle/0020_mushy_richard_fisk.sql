ALTER TABLE `attendance_participants` ADD `payment_treasury_account_id` integer REFERENCES treasury_accounts(id);--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_received_by_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_received_at` text;--> statement-breakpoint
CREATE INDEX `idx_attendance_participants_payment_status` ON `attendance_participants` (`payment_status`);