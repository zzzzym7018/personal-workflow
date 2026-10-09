CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`stage` integer DEFAULT 1 NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`next_step` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#167F78' NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#159AA9' NOT NULL,
	`source` text DEFAULT 'local' NOT NULL,
	`external_id` text,
	`external_calendar_id` text,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`project_id` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`calendar_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#159AA9' NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`writable` integer DEFAULT false NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_connections` (
	`user_email` text PRIMARY KEY NOT NULL,
	`google_email` text NOT NULL,
	`access_token_cipher` text NOT NULL,
	`refresh_token_cipher` text,
	`expires_at` integer NOT NULL,
	`scope` text DEFAULT '' NOT NULL,
	`last_sync_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'idea' NOT NULL,
	`status` text DEFAULT 'inbox' NOT NULL,
	`project_id` text,
	`domain_id` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`title` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`minutes` integer DEFAULT 0 NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`color` text DEFAULT '#3449A4' NOT NULL,
	`deadline` text,
	`next_action` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`domain_id` text,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`due_date` text,
	`start_at` text,
	`end_at` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
