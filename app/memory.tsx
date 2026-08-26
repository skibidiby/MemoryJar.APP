import Particle from "@/components/@elements/Particle/Particle";
import { useMemoryTransition } from "@/components/MemoryTransition/MemoryTransition";
import { db } from "@/db/client";
import { memories } from "@/db/schema";
import { usePreventRemove } from "@react-navigation/native";
import { eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { router, Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function useMemoryRecord() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const memoryId = Number(id);
	const query = useMemo(() => db.select().from(memories).where(eq(memories.id, memoryId)), [memoryId]);
	const { data } = useLiveQuery(query, [memoryId]);
	return { memoryId, memory: data[0] };
}

function useMemoryContentAnimation() {
	const progress = useSharedValue(0);
	const style = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [{ translateY: (1 - progress.value) * 12 }],
	}));

	useEffect(() => {
		progress.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
	}, [progress]);

	const animateOut = useCallback(() => {
		progress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
	}, [progress]);

	return { style, animateOut };
}

function useMemoryParticleTransition(memoryId: number, animateOut: () => void) {
	const navigation = useNavigation();
	const destinationRef = useRef<View>(null);
	const reversingRef = useRef(false);
	const { activeMemoryId, registerDestination, requestReturn } = useMemoryTransition();
	const hasSharedParticle = activeMemoryId === memoryId;

	const measureDestination = useCallback(() => {
		if (!hasSharedParticle) return;
		destinationRef.current?.measureInWindow((x, y, width, height) => {
			registerDestination(memoryId, { x, y, width, height, angle: 0 });
		});
	}, [hasSharedParticle, memoryId, registerDestination]);

	usePreventRemove(hasSharedParticle, ({ data: { action } }) => {
		if (reversingRef.current) return;
		reversingRef.current = true;
		animateOut();
		if (!requestReturn(memoryId)) {
			reversingRef.current = false;
			return;
		}
		requestAnimationFrame(() => navigation.dispatch(action));
	});

	const goBack = useCallback(() => router.back(), []);
	return { destinationRef, measureDestination, hasSharedParticle, goBack };
}

export default function Memory() {
	const { memoryId, memory } = useMemoryRecord();
	const content = useMemoryContentAnimation();
	const particle = useMemoryParticleTransition(memoryId, content.animateOut);
	const insets = useSafeAreaInsets();

	if (!memory) return null;

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "Memory", gestureEnabled: true }} />
			<Animated.View style={content.style}>
				<Text style={styles.title}>Memory</Text>
				<Text>{memory.content}</Text>
				<Text>{memory.location}</Text>
				<Text>{new Date(memory.date).toLocaleDateString()}</Text>
			</Animated.View>
			<Pressable
				ref={particle.destinationRef}
				collapsable={false}
				onLayout={particle.measureDestination}
				onPress={particle.goBack}
				accessibilityRole="button"
				accessibilityLabel="Return to memory jar"
				style={[styles.destination, { right: 24 + insets.right, bottom: 24 + insets.bottom }]}
			>
				<View style={{ opacity: particle.hasSharedParticle ? 0 : 1 }}>
					<Particle type={memory.type} id={memory.id} size={80} />
				</View>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24 },
	title: { fontSize: 24, fontWeight: "600", marginBottom: 16 },
	destination: { position: "absolute", width: 80, height: 80 },
});
