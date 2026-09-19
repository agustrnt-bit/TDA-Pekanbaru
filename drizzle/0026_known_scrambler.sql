ALTER TABLE `attendance_events` ADD `allow_public_category` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `allow_member_category` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `allow_committee_category` integer DEFAULT true NOT NULL;