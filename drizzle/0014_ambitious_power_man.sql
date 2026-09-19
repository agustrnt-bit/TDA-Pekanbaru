ALTER TABLE `attendance_participants` ADD `payment_verification_source` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_received_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_participants` ADD `payment_paid_at` text;