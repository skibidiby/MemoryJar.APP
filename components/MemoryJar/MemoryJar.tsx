import { useMemoryTransition } from "@/components/MemoryTransition/MemoryTransition";
import { db } from "@/db/client";
import { memories } from "@/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { DeviceMotion, DeviceMotionOrientation } from "expo-sensors";
import Matter from "matter-js";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Particle from "../@elements/Particle/Particle";

const PARTICLE_SIZE = 32;
const PARTICLE_RADIUS = PARTICLE_SIZE / 2;
const MAX_PARTICLES = 20;
const WALL_THICKNESS = 40;
const JAR_HEIGHT = 320;
const JAR_PADDING = 16;
const JAR_TOP_INSET = 36;
const SENSOR_INTERVAL = 50;
const GRAVITY_SMOOTHING = 0.18;
const MAX_GRAVITY_COMPONENT = 1.5;
const PHYSICS_STEP = 1000 / 60;
const MAX_FRAME_DELTA = 50;

type Memory = typeof memories.$inferSelect;
type ParticlePosition = { x: number; y: number; angle: number };
type JarSize = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const gravityForScreen = (x: number, y: number, orientation: DeviceMotionOrientation) => {
	const portraitX = x / DeviceMotion.Gravity;
	const portraitY = -y / DeviceMotion.Gravity;
	switch (orientation) {
		case DeviceMotionOrientation.RightLandscape:
			return { x: -portraitY, y: portraitX };
		case DeviceMotionOrientation.LeftLandscape:
			return { x: portraitY, y: -portraitX };
		case DeviceMotionOrientation.UpsideDown:
			return { x: -portraitX, y: -portraitY };
		default:
			return { x: portraitX, y: portraitY };
	}
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MemoryParticle = ({
	memory,
	body,
	engine,
	freezeBody,
	releaseBody,
	jarRef,
}: {
	memory: Memory;
	body: Matter.Body;
	engine: Matter.Engine;
	freezeBody: (id: number) => ParticlePosition | null;
	releaseBody: () => void;
	jarRef: RefObject<View | null>;
}) => {
	const { activeMemoryId, beginTransition, isAnimating } = useMemoryTransition();
	const x = useSharedValue(body.position.x);
	const y = useSharedValue(body.position.y);
	const angle = useSharedValue(body.angle);

	useEffect(() => {
		const updatePosition = () => {
			x.value = body.position.x;
			y.value = body.position.y;
			angle.value = body.angle;
		};
		Matter.Events.on(engine, "afterUpdate", updatePosition);
		return () => Matter.Events.off(engine, "afterUpdate", updatePosition);
	}, [angle, body, engine, x, y]);

	const animatedStyle = useAnimatedStyle(() => ({
		left: x.value - PARTICLE_RADIUS,
		top: y.value - PARTICLE_RADIUS,
		transform: [{ rotate: `${angle.value}rad` }],
	}));

	const openMemory = () => {
		if (isAnimating) return;
		if (Platform.OS === "web") {
			router.push({ pathname: "/memory", params: { id: String(memory.id) } });
			return;
		}
		const bodyPosition = freezeBody(memory.id);
		if (!bodyPosition) return;
		jarRef.current?.measureInWindow((jarX, jarY) => {
			const transitioning = beginTransition(memory.id, memory.type, {
				x: jarX + bodyPosition.x - PARTICLE_RADIUS,
				y: jarY + bodyPosition.y - PARTICLE_RADIUS,
				width: PARTICLE_SIZE,
				height: PARTICLE_SIZE,
				angle: bodyPosition.angle,
			});
			if (!transitioning) releaseBody();
			router.push({ pathname: "/memory", params: { id: String(memory.id) } });
		});
	};

	return (
		<AnimatedPressable
			onPress={openMemory}
			disabled={isAnimating}
			style={[styles.particle, animatedStyle]}
		>
			<View collapsable={false} style={{ opacity: activeMemoryId === memory.id ? 0 : 1 }}>
				<Particle type={memory.type} id={memory.id} size={PARTICLE_SIZE} />
			</View>
		</AnimatedPressable>
	);
};

const createWalls = ({ width, height }: JarSize) => [
	Matter.Bodies.rectangle(width / 2, JAR_TOP_INSET - WALL_THICKNESS / 2, width, WALL_THICKNESS, { isStatic: true }),
	Matter.Bodies.rectangle(width / 2, height - JAR_PADDING + WALL_THICKNESS / 2, width, WALL_THICKNESS, { isStatic: true }),
	Matter.Bodies.rectangle(JAR_PADDING - WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height, { isStatic: true }),
	Matter.Bodies.rectangle(width - JAR_PADDING + WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height, { isStatic: true }),
];

const MemoryJar = () => {
	const { data: memoryList } = useLiveQuery(db.select().from(memories));
	const randomSeed = useRef(Math.random());
	const visibleMemoryList = useMemo(
		() =>
			[...memoryList]
				.sort((a, b) => {
					const scoreA = Math.sin(a.id * 12.9898 + randomSeed.current * 43758.5453);
					const scoreB = Math.sin(b.id * 12.9898 + randomSeed.current * 43758.5453);
					return scoreA - scoreB;
				})
				.slice(0, MAX_PARTICLES),
		[memoryList],
	);
	const { activeMemoryId, cancelTransition, returnToSource, transitionPhase } = useMemoryTransition();
	const isFocused = useIsFocused();
	const [engine] = useState(() => Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } }));
	const bodiesRef = useRef(new Map<number, Matter.Body>());
	const wallsRef = useRef<Matter.Body[]>([]);
	const [jarSize, setJarSize] = useState<JarSize>({ width: 0, height: 0 });
	const [, setBodyRevision] = useState(0);
	const frozenBodyRef = useRef<Matter.Body | null>(null);
	const jarRef = useRef<View>(null);

	const freezeBody = useCallback((id: number) => {
		const body = bodiesRef.current.get(id);
		if (!body) return null;
		Matter.Body.setStatic(body, true);
		frozenBodyRef.current = body;
		return { x: body.position.x, y: body.position.y, angle: body.angle };
	}, []);
	const releaseBody = useCallback(() => {
		if (!frozenBodyRef.current) return;
		Matter.Body.setStatic(frozenBodyRef.current, false);
		Matter.Sleeping.set(frozenBodyRef.current, false);
		frozenBodyRef.current = null;
	}, []);

	const handleLayout = useCallback((event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		setJarSize((current) => (current.width === width && current.height === height ? current : { width, height }));
	}, []);

	useEffect(() => {
		if (!isFocused || transitionPhase !== "returning" || activeMemoryId === null) return;
		const frame = requestAnimationFrame(() => {
			const body = bodiesRef.current.get(activeMemoryId);
			if (!body || !jarRef.current) {
				cancelTransition();
				return;
			}
			Matter.Body.setPosition(body, {
				x: body.position.x,
				y: JAR_TOP_INSET + PARTICLE_RADIUS,
			});
			Matter.Body.setVelocity(body, { x: 0, y: 0 });
			jarRef.current.measureInWindow((jarX, jarY) => {
				returnToSource(activeMemoryId, {
					x: jarX + body.position.x - PARTICLE_RADIUS,
					y: jarY + body.position.y - PARTICLE_RADIUS,
					width: PARTICLE_SIZE,
					height: PARTICLE_SIZE,
					angle: body.angle,
				});
			});
		});
		return () => cancelAnimationFrame(frame);
	}, [activeMemoryId, cancelTransition, isFocused, returnToSource, transitionPhase]);

	useEffect(() => {
		if (activeMemoryId !== null || !frozenBodyRef.current) return;
		const body = frozenBodyRef.current;
		Matter.Body.setStatic(body, false);
		Matter.Sleeping.set(body, false);
		Matter.Body.setVelocity(body, { x: 0, y: 2.5 });
		frozenBodyRef.current = null;
	}, [activeMemoryId]);

	useEffect(() => {
		const bodies = bodiesRef.current;
		let animationFrame: number;
		let previousTime: number | null = null;
		let accumulator = 0;

		const updatePhysics = (time: number) => {
			if (previousTime === null) previousTime = time;
			const frameDelta = Math.min(time - previousTime, MAX_FRAME_DELTA);
			previousTime = time;
			accumulator += frameDelta;

			while (accumulator >= PHYSICS_STEP) {
				Matter.Engine.update(engine, PHYSICS_STEP);
				accumulator -= PHYSICS_STEP;
			}

			animationFrame = requestAnimationFrame(updatePhysics);
		};

		animationFrame = requestAnimationFrame(updatePhysics);
		return () => {
			cancelAnimationFrame(animationFrame);
			Matter.World.clear(engine.world, false);
			Matter.Engine.clear(engine);
			bodies.clear();
			wallsRef.current = [];
		};
	}, [engine]);

	useEffect(() => {
		if (!jarSize.width || !jarSize.height) return;
		const world = engine.world;
		if (wallsRef.current.length) Matter.World.remove(world, wallsRef.current);
		wallsRef.current = createWalls(jarSize);
		Matter.World.add(world, wallsRef.current);
		bodiesRef.current.forEach((body) => {
			Matter.Body.setPosition(body, {
				x: clamp(body.position.x, JAR_PADDING + PARTICLE_RADIUS, jarSize.width - JAR_PADDING - PARTICLE_RADIUS),
				y: clamp(body.position.y, JAR_TOP_INSET + PARTICLE_RADIUS, jarSize.height - JAR_PADDING - PARTICLE_RADIUS),
			});
		});
	}, [engine, jarSize]);

	useEffect(() => {
		if (!jarSize.width || !jarSize.height) return;
		const world = engine.world;
		const memoryIds = new Set(visibleMemoryList.map(({ id }) => id));
		let bodiesChanged = false;
		bodiesRef.current.forEach((body, id) => {
			if (!memoryIds.has(id)) {
				Matter.World.remove(world, body);
				bodiesRef.current.delete(id);
				bodiesChanged = true;
			}
		});
		visibleMemoryList.forEach((memory) => {
			if (bodiesRef.current.has(memory.id)) return;
			const availableWidth = Math.max(0, jarSize.width - JAR_PADDING * 2 - PARTICLE_SIZE);
			const availableSpawnHeight = Math.max(0, jarSize.height / 2 - JAR_TOP_INSET - PARTICLE_SIZE);
			const x = JAR_PADDING + PARTICLE_RADIUS + Math.random() * availableWidth;
			const y = JAR_TOP_INSET + PARTICLE_RADIUS + Math.random() * availableSpawnHeight;
			const body = Matter.Bodies.circle(x, y, PARTICLE_RADIUS, {
				restitution: 0.45,
				friction: 0.08,
				frictionAir: 0.012,
			});
			bodiesRef.current.set(memory.id, body);
			Matter.World.add(world, body);
			bodiesChanged = true;
		});
		if (bodiesChanged) setBodyRevision((current) => current + 1);
	}, [engine, jarSize, visibleMemoryList]);

	useEffect(() => {
		let subscription: ReturnType<typeof DeviceMotion.addListener> | undefined;
		let cancelled = false;
		let smoothed = { x: 0, y: 1 };
		const setFallbackGravity = () => {
			engine.gravity.x = 0;
			engine.gravity.y = 1;
		};
		const subscribe = async () => {
			setFallbackGravity();
			if (Platform.OS === "web" || !(await DeviceMotion.isAvailableAsync()) || cancelled) return;
			let permission = await DeviceMotion.getPermissionsAsync();
			if (!permission.granted && permission.canAskAgain) permission = await DeviceMotion.requestPermissionsAsync();
			if (!permission.granted || cancelled) return;
			DeviceMotion.setUpdateInterval(SENSOR_INTERVAL);
			subscription = DeviceMotion.addListener(({ accelerationIncludingGravity, orientation }) => {
				const { x, y } = accelerationIncludingGravity;
				if (!Number.isFinite(x) || !Number.isFinite(y)) return;
				const gravity = gravityForScreen(x, y, orientation);
				smoothed = {
					x: smoothed.x + (clamp(gravity.x, -MAX_GRAVITY_COMPONENT, MAX_GRAVITY_COMPONENT) - smoothed.x) * GRAVITY_SMOOTHING,
					y: smoothed.y + (clamp(gravity.y, -MAX_GRAVITY_COMPONENT, MAX_GRAVITY_COMPONENT) - smoothed.y) * GRAVITY_SMOOTHING,
				};
				engine.gravity.x = smoothed.x;
				engine.gravity.y = smoothed.y;
			});
		};
		subscribe().catch(setFallbackGravity);
		return () => {
			cancelled = true;
			subscription?.remove();
		};
	}, [engine]);

	return (
		<View ref={jarRef} collapsable={false} style={styles.jar} onLayout={handleLayout}>
			<Text style={styles.title}>Memory Jar</Text>
			{visibleMemoryList.map((memory) => {
				const body = bodiesRef.current.get(memory.id);
				return body ? (
					<MemoryParticle
						key={memory.id}
						memory={memory}
						body={body}
						engine={engine}
						freezeBody={freezeBody}
						releaseBody={releaseBody}
						jarRef={jarRef}
					/>
				) : null;
			})}
		</View>
	);
};

const styles = StyleSheet.create({
	jar: { width: "100%", height: JAR_HEIGHT, marginTop: "auto", overflow: "hidden" },
	title: { position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", zIndex: 1 },
	particle: { position: "absolute", width: PARTICLE_SIZE, height: PARTICLE_SIZE },
});

export default MemoryJar;
