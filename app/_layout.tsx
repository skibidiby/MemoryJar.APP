import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { MemoryTransitionProvider } from "@/components/MemoryTransition/MemoryTransition";

export default function RootLayout() {
	return (
		<SQLiteProvider databaseName="db.db" options={{ enableChangeListener: true }}>
			<MemoryTransitionProvider>
				<Stack initialRouteName="index">
					<Stack.Screen name="index" options={{ headerShown: false }} />
					<Stack.Screen name="memory" options={{ animation: "none" }} />
				</Stack>
			</MemoryTransitionProvider>
		</SQLiteProvider>
	);
}
