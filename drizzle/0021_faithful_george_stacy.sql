CREATE TABLE `program_feedback_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`answer_json` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `program_feedback_submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `program_feedback_questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_program_feedback_answers_submission_question` ON `program_feedback_answers` (`submission_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `program_feedback_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`question` text NOT NULL,
	`question_type` text DEFAULT 'paragraph' NOT NULL,
	`options_json` text DEFAULT '[]' NOT NULL,
	`is_required` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_program_feedback_questions_program` ON `program_feedback_questions` (`program_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `program_feedback_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`participant_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `attendance_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `attendance_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_program_feedback_submissions_participant` ON `program_feedback_submissions` (`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_program_feedback_submissions_program` ON `program_feedback_submissions` (`program_id`);--> statement-breakpoint
CREATE TABLE `program_task_divisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`division_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `program_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_program_task_divisions_unique` ON `program_task_divisions` (`task_id`,`division_id`);--> statement-breakpoint
CREATE INDEX `idx_program_task_divisions_division` ON `program_task_divisions` (`division_id`,`task_id`);--> statement-breakpoint
ALTER TABLE `attendance_events` ADD `feedback_open` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `program_expenses` ADD `task_id` integer REFERENCES program_tasks(id);--> statement-breakpoint
CREATE INDEX `idx_program_expenses_task_id` ON `program_expenses` (`task_id`);--> statement-breakpoint
ALTER TABLE `program_incomes` ADD `task_id` integer REFERENCES program_tasks(id);--> statement-breakpoint
CREATE INDEX `idx_program_incomes_task_id` ON `program_incomes` (`task_id`);--> statement-breakpoint
ALTER TABLE `program_tasks` ADD `uses_budget` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `program_tasks` ADD `budget_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `program_tasks` ADD `income_target` integer DEFAULT 0 NOT NULL;