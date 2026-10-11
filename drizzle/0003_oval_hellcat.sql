CREATE TABLE `knowledge_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text,
	`kind` text DEFAULT 'note' NOT NULL,
	`stage` integer,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
