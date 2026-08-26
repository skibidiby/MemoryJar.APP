import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const memories = sqliteTable("memories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	content: text("content").notNull(),
	type: text({ enum: ["WARM", "CALM", "FUZZY"] }).notNull(),
	location: text("location").notNull(),
	date: integer("date").notNull(),
});

export const memoryImages = sqliteTable("memory_images", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	memoryId: integer("memory_id")
		.notNull()
		.references(() => memories.id, { onDelete: "cascade" }),
	imageUri: text("image_uri").notNull(),
});
