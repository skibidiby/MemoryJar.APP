CREATE TABLE IF NOT EXISTS `memory_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`memory_id` integer NOT NULL REFERENCES `memories`(`id`) ON DELETE CASCADE,
	`image_uri` text NOT NULL
);
