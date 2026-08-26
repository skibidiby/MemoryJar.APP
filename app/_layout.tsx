import { MemoryTransitionProvider } from "@/components/MemoryTransition/MemoryTransition";
import { FONT_FAMILIES } from "@/constants/design";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
	const [fontsLoaded, fontError] = useFonts({
		[FONT_FAMILIES.glykeRegular]: require("../assets/fonts/ccsglyke.otf"),
	});

	useEffect(() => {
		if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => undefined);
	}, [fontError, fontsLoaded]);

	if (!fontsLoaded && !fontError) return null;

	return (
		<SQLiteProvider databaseName="db.db" options={{ enableChangeListener: true }}>
			<MemoryTransitionProvider>
				<Stack initialRouteName="index">
					<Stack.Screen name="index" options={{ headerShown: false }} />
					<Stack.Screen name="add-memory" options={{ headerShown: false }} />
					<Stack.Screen name="memory" options={{ animation: "none" }} />
				</Stack>
			</MemoryTransitionProvider>
		</SQLiteProvider>
	);
}
