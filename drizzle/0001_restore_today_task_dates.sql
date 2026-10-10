UPDATE `tasks`
SET
	`due_date` = '2026-10-10',
	`updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE
	`id` IN (
		'8a2f603b-524a-4200-b797-c8b8fbf5dc5b',
		'fc22c083-1dc1-41d9-afe8-e073124a3ae8'
	)
	AND `due_date` IS NULL
	AND `archived_at` IS NULL;
