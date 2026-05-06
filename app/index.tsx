import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { SQLiteProvider } from "expo-sqlite";
import React from "react";
import { Text, View } from "react-native";
import AddMemory from "../components/AddMemory/AddMemory";
import MemoryJar from "../components/MemoryJar/MemoryJar";
import { db } from "../db/client";
import migrations from "../drizzle/migrations";

export default function Index() {
	const { success, error } = useMigrations(db, migrations);
	if (error) return <Text>Migration error: {error.message}</Text>;
	if (!success) return <Text>Setting up database...</Text>;
	return (
		<SQLiteProvider databaseName="db.db">
			<View
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<AddMemory />
				<MemoryJar />
			</View>
		</SQLiteProvider>
	);
}
