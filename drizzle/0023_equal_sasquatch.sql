CREATE TABLE `program_publications` (
	`program_id` integer PRIMARY KEY NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`public_title` text DEFAULT '' NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`benefits` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_phone` text DEFAULT '' NOT NULL,
	`registration_event_id` integer,
	`is_featured` integer DEFAULT false NOT NULL,
	`flyer_key` text,
	`flyer_name` text,
	`flyer_type` text,
	`updated_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_program_publications_published_featured` ON `program_publications` (`is_published`,`is_featured`);--> statement-breakpoint
CREATE INDEX `idx_program_publications_registration_event` ON `program_publications` (`registration_event_id`);