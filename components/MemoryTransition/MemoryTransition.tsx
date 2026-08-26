import Particle, { ParticleType } from "@/components/@elements/Particle/Particle";
import React, { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export type ParticleRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type ActiveTransition = {
	id: number;
	type: ParticleType;
	source: ParticleRect;
	destination?: ParticleRect;
};

type MemoryTransitionContextValue = {
	activeMemoryId: number | null;
	isTransitioning: boolean;
	beginTransition: (id: number, type: ParticleType, source: ParticleRect) => boolean;
	registerDestination: (id: number, destination: ParticleRect) => void;
	reverseTransition: () => Promise<void>;
	cancelTransition: () => void;
};

const TRANSITION_DURATION = 350;
const TRANSITION_EASING = Easing.bezier(0.22, 1, 0.36, 1);

const MemoryTransitionContext = createContext<MemoryTransitionContextValue | null>(null);

export function MemoryTransitionProvider({ children }: PropsWithChildren) {
	const [active, setActive] = useState<ActiveTransition | null>(null);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const left = useSharedValue(0);
	const top = useSharedValue(0);
	const width = useSharedValue(0);
	const height = useSharedValue(0);

	const placeAt = useCallback(
		(rect: ParticleRect, animated: boolean) => {
			const timing = { duration: TRANSITION_DURATION, easing: TRANSITION_EASING };
			if (animated) {
				left.value = withTiming(rect.x, timing);
				top.value = withTiming(rect.y, timing);
				width.value = withTiming(rect.width, timing);
				height.value = withTiming(rect.height, timing);
			} else {
				left.value = rect.x;
				top.value = rect.y;
				width.value = rect.width;
				height.value = rect.height;
			}
		},
		[height, left, top, width],
	);

	const beginTransition = useCallback(
		(id: number, type: ParticleType, source: ParticleRect) => {
			if (Platform.OS === "web" || active || isTransitioning) return false;
			placeAt(source, false);
			setActive({ id, type, source });
			setIsTransitioning(true);
			return true;
		},
		[active, isTransitioning, placeAt],
	);

	const registerDestination = useCallback(
		(id: number, destination: ParticleRect) => {
			setActive((current) => {
				if (!current || current.id !== id || current.destination) return current;
				placeAt(destination, true);
				setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION);
				return { ...current, destination };
			});
		},
		[placeAt],
	);

	const cancelTransition = useCallback(() => {
		setActive(null);
		setIsTransitioning(false);
	}, []);

	const reverseTransition = useCallback(async () => {
		if (!active) return;
		setIsTransitioning(true);
		placeAt(active.source, true);
		await new Promise<void>((resolve) => setTimeout(resolve, TRANSITION_DURATION));
	}, [active, placeAt]);

	const overlayStyle = useAnimatedStyle(() => ({
		left: left.value,
		top: top.value,
		width: width.value,
		height: height.value,
	}));

	const value = useMemo(
		() => ({
			activeMemoryId: active?.id ?? null,
			isTransitioning,
			beginTransition,
			registerDestination,
			reverseTransition,
			cancelTransition,
		}),
		[active?.id, beginTransition, cancelTransition, isTransitioning, registerDestination, reverseTransition],
	);

	return (
		<MemoryTransitionContext.Provider value={value}>
			{children}
			{active ? (
				<Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
					<Particle id={active.id} type={active.type} size="100%" />
				</Animated.View>
			) : null}
		</MemoryTransitionContext.Provider>
	);
}

export function useMemoryTransition() {
	const value = useContext(MemoryTransitionContext);
	if (!value) throw new Error("useMemoryTransition must be used inside MemoryTransitionProvider");
	return value;
}

const styles = StyleSheet.create({
	overlay: {
		position: "absolute",
		zIndex: 1000,
	},
});
