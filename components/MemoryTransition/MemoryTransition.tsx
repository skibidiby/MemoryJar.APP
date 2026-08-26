import Particle, { ParticleType } from "@/components/@elements/Particle/Particle";
import React, { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

export type ParticleRect = {
	x: number;
	y: number;
	width: number;
	height: number;
	angle: number;
};

type ActiveTransition = {
	id: number;
	type: ParticleType;
	source: ParticleRect;
	destination?: ParticleRect;
	phase: TransitionPhase;
};

export type TransitionPhase = "opening" | "open" | "returning";

type MemoryTransitionContextValue = {
	activeMemoryId: number | null;
	transitionPhase: TransitionPhase | null;
	isAnimating: boolean;
	beginTransition: (id: number, type: ParticleType, source: ParticleRect) => boolean;
	registerDestination: (id: number, destination: ParticleRect) => void;
	requestReturn: (id: number) => boolean;
	returnToSource: (id: number, source: ParticleRect) => void;
	cancelTransition: () => void;
};

const TRANSITION_DURATION = 350;
const TRANSITION_EASING = Easing.bezier(0.22, 1, 0.36, 1);

const MemoryTransitionContext = createContext<MemoryTransitionContextValue | null>(null);

export function MemoryTransitionProvider({ children }: PropsWithChildren) {
	const [active, setActive] = useState<ActiveTransition | null>(null);
	const activeRef = useRef<ActiveTransition | null>(null);
	const transitionLock = useRef(false);
	const hostRef = useRef<View>(null);
	const hostOriginRef = useRef({ x: 0, y: 0 });
	const left = useSharedValue(0);
	const top = useSharedValue(0);
	const width = useSharedValue(0);
	const height = useSharedValue(0);
	const angle = useSharedValue(0);
	const isAnimating = active?.phase === "opening" || active?.phase === "returning";

	const updateActive = useCallback((next: ActiveTransition | null) => {
		activeRef.current = next;
		setActive(next);
	}, []);

	const measureHostOrigin = useCallback(() => {
		hostRef.current?.measureInWindow((x, y) => {
			hostOriginRef.current = { x, y };
		});
	}, []);

	const placeAt = useCallback(
		(rect: ParticleRect, animated: boolean, onComplete?: () => void) => {
			const timing = { duration: TRANSITION_DURATION, easing: TRANSITION_EASING };
			const localX = rect.x - hostOriginRef.current.x;
			const localY = rect.y - hostOriginRef.current.y;
			if (animated) {
				left.value = withTiming(localX, timing);
				top.value = withTiming(localY, timing);
				width.value = withTiming(rect.width, timing, (finished) => {
					if (finished && onComplete) runOnJS(onComplete)();
				});
				height.value = withTiming(rect.height, timing);
				angle.value = withTiming(rect.angle, timing);
			} else {
				left.value = localX;
				top.value = localY;
				width.value = rect.width;
				height.value = rect.height;
				angle.value = rect.angle;
				onComplete?.();
			}
		},
		[angle, height, left, top, width],
	);

	const beginTransition = useCallback(
		(id: number, type: ParticleType, source: ParticleRect) => {
			if (Platform.OS === "web" || transitionLock.current) return false;
			transitionLock.current = true;
			const next: ActiveTransition = { id, type, source, phase: "opening" };
			placeAt(source, false);
			updateActive(next);
			return true;
		},
		[placeAt, updateActive],
	);

	const registerDestination = useCallback(
		(id: number, destination: ParticleRect) => {
			const current = activeRef.current;
			if (!current || current.id !== id || current.destination) return;
			updateActive({ ...current, destination, phase: "opening" });
			placeAt(destination, true, () => {
				const latest = activeRef.current;
				if (!latest || latest.id !== id || latest.phase !== "opening") return;
				updateActive({ ...latest, phase: "open" });
			});
		},
		[placeAt, updateActive],
	);

	const cancelTransition = useCallback(() => {
		cancelAnimation(left);
		cancelAnimation(top);
		cancelAnimation(width);
		cancelAnimation(height);
		cancelAnimation(angle);
		transitionLock.current = false;
		updateActive(null);
	}, [angle, height, left, top, updateActive, width]);

	const requestReturn = useCallback((id: number) => {
		const current = activeRef.current;
		if (!current || current.id !== id || current.phase === "returning") return false;
		updateActive({ ...current, phase: "returning" });
		return true;
	}, [updateActive]);

	const returnToSource = useCallback(
		(id: number, source: ParticleRect) => {
			const current = activeRef.current;
			if (!current || current.id !== id || current.phase !== "returning") return;
			updateActive({ ...current, source });
			placeAt(source, true, () => {
				const latest = activeRef.current;
				if (!latest || latest.id !== id || latest.phase !== "returning") return;
				transitionLock.current = false;
				updateActive(null);
			});
		},
		[placeAt, updateActive],
	);

	const overlayStyle = useAnimatedStyle(() => ({
		left: left.value,
		top: top.value,
		width: width.value,
		height: height.value,
		transform: [{ rotate: `${angle.value}rad` }],
	}));

	const value = useMemo(
		() => ({
			activeMemoryId: active?.id ?? null,
			transitionPhase: active?.phase ?? null,
			isAnimating,
			beginTransition,
			registerDestination,
			requestReturn,
			returnToSource,
			cancelTransition,
		}),
		[
			active?.id,
			active?.phase,
			beginTransition,
			cancelTransition,
			isAnimating,
			registerDestination,
			requestReturn,
			returnToSource,
		],
	);

	return (
		<MemoryTransitionContext.Provider value={value}>
			<View ref={hostRef} collapsable={false} onLayout={measureHostOrigin} style={styles.host}>
				{children}
				{active ? (
					<Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
						<Particle id={active.id} type={active.type} size="100%" />
					</Animated.View>
				) : null}
			</View>
		</MemoryTransitionContext.Provider>
	);
}

export function useMemoryTransition() {
	const value = useContext(MemoryTransitionContext);
	if (!value) throw new Error("useMemoryTransition must be used inside MemoryTransitionProvider");
	return value;
}

const styles = StyleSheet.create({
	host: {
		flex: 1,
	},
	overlay: {
		position: "absolute",
		zIndex: 1000,
	},
});
