CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer,
	`task_title` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`description` text NOT NULL,
	`actor` text DEFAULT 'Panitia' NOT NULL,
	`old_data` text,
	`new_data` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`undone_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
