ALTER TABLE `tasks` ADD `planned_date` text;
--> statement-breakpoint
UPDATE `tasks`
SET `planned_date` = substr(datetime(`created_at`, '+8 hours'), 1, 10)
WHERE `planned_date` IS NULL AND `project_id` IS NULL;
