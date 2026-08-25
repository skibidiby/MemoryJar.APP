CREATE TABLE `memories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`type` text NOT NULL,
	`location` text NOT NULL,
	`date` integer NOT NULL
);
CREATE TABLE `memory_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`memory_id` integer NOT NULL REFERENCES `memories`(`id`) ON DELETE CASCADE,
	`image_uri` text NOT NULL
);
