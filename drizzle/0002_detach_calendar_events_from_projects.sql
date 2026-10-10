UPDATE `events`
SET
	`project_id` = NULL,
	`updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `project_id` IS NOT NULL;
