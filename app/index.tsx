import { COLORS, FONT_FAMILIES, INDEX_LAYOUT, REFERENCE_SCREEN } from "@/constants/design";
import { db } from "@/db/client";
import { memories } from "@/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MemoryJar, { MemoryJarHandle } from "@/components/MemoryJar/MemoryJar";
import migrations from "@/drizzle/migrations";
import { useRef } from "react";

type ActionBandProps = {
	label: string;
	top: number;
	height: number;
	rotation: string;
	backgroundColor: string;
	onPress: () => void;
	disabled?: boolean;
};

function ActionBand({ label, top, height, rotation, backgroundColor, onPress, disabled }: ActionBandProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityState={{ disabled: !!disabled }}
			style={[
				styles.actionBand,
				{
					top,
					height,
					backgroundColor,
					transform: [{ rotate: rotation }],
				},
			]}
		>
			<Text style={styles.actionLabel}>{label}</Text>
		</Pressable>
	);
}

export default function Index() {
	const { success, error } = useMigrations(db, migrations);

	if (error) return <Text style={styles.status}>Migration error: {error.message}</Text>;
	if (!success) return <Text style={styles.status}>Setting up database...</Text>;
	return <IndexContent />;
}

function IndexContent() {
	const { data: memoryList } = useLiveQuery(db.select().from(memories));
	const memoryJarRef = useRef<MemoryJarHandle>(null);
	const { width, height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const scale = Math.min(width / REFERENCE_SCREEN.width, 1);
	const verticalOffset = Math.max(0, Math.min((height - REFERENCE_SCREEN.height) * 0.12, 28));
	const openRandomMemory = () => {
		memoryJarRef.current?.openRandomMemory();
	};

	return (
		<View style={[styles.container, { paddingBottom: insets.bottom }]}>
			<View style={[styles.composition, { transform: [{ scale }] }]}>
				<Text style={[styles.title, { top: INDEX_LAYOUT.titleTop + verticalOffset }]}>MEMORY</Text>
				<Text style={[styles.title, { top: INDEX_LAYOUT.jarTitleTop + verticalOffset }]}>JAR</Text>
				<ActionBand
					label="add memory"
					top={INDEX_LAYOUT.addBandTop + verticalOffset}
					height={INDEX_LAYOUT.addBandHeight}
					rotation={INDEX_LAYOUT.addBandRotation}
					backgroundColor={COLORS.yellowBand}
					onPress={() => router.push("/add-memory")}
				/>
				<ActionBand
					label="random"
					top={INDEX_LAYOUT.randomBandTop + verticalOffset}
					height={INDEX_LAYOUT.randomBandHeight}
					rotation={INDEX_LAYOUT.randomBandRotation}
					backgroundColor={COLORS.orangeBand}
					onPress={openRandomMemory}
					disabled={!memoryList.length}
				/>
			</View>
			<MemoryJar ref={memoryJarRef} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: COLORS.background,
		overflow: "hidden",
	},
	composition: {
		position: "absolute",
		top: 0,
		left: 0,
		width: REFERENCE_SCREEN.width,
		height: REFERENCE_SCREEN.height,
		transformOrigin: "top left",
	},
	title: {
		position: "absolute",
		left: INDEX_LAYOUT.titleLeft,
		color: COLORS.ink,
		fontFamily: FONT_FAMILIES.glykeRegular,
		fontSize: INDEX_LAYOUT.titleFontSize,
		lineHeight: INDEX_LAYOUT.titleLineHeight,
		letterSpacing: -3,
	},
	actionBand: {
		position: "absolute",
		left: -INDEX_LAYOUT.actionBandWidthOverflow / 2,
		width: REFERENCE_SCREEN.width + INDEX_LAYOUT.actionBandWidthOverflow,
		justifyContent: "center",
		paddingRight: 30,
	},
	actionLabel: {
		color: "#000000",
		fontFamily: FONT_FAMILIES.glykeRegular,
		fontSize: INDEX_LAYOUT.actionFontSize,
		lineHeight: 58,
		textAlign: "right",
	},
	status: {
		flex: 1,
		backgroundColor: COLORS.background,
		color: COLORS.ink,
		textAlign: "center",
		textAlignVertical: "center",
	},
});
