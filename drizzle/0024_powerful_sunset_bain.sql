CREATE TABLE `public_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_type` text DEFAULT 'banner' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`event_date` text DEFAULT '' NOT NULL,
	`link_url` text DEFAULT '' NOT NULL,
	`image_key` text NOT NULL,
	`image_name` text DEFAULT '' NOT NULL,
	`image_type` text DEFAULT 'image/webp' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_public_media_type_active_order` ON `public_media` (`media_type`,`is_active`,`sort_order`);