import { useMemoryTransition } from "@/components/MemoryTransition/MemoryTransition";
import Particle, { ParticleType } from "@/components/@elements/Particle/Particle";
import { COLORS, INDEX_LAYOUT, PARTICLE_DIMENSIONS, ParticleDimensions } from "@/constants/design";
import { db } from "@/db/client";
import { memories } from "@/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { Accelerometer, DeviceMotion, DeviceMotionOrientation } from "expo-sensors";
import Matter from "matter-js";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

const MAX_PARTICLES = 20;
const WALL_THICKNESS = 40;
const JAR_HEIGHT = INDEX_LAYOUT.jarHeight;
const JAR_PADDING = INDEX_LAYOUT.jarPadding;
const JAR_TOP_INSET = 0;
const SENSOR_INTERVAL = 50;
const GRAVITY_SMOOTHING = 0.18;
const MAX_GRAVITY_COMPONENT = 1.5;
const PHYSICS_STEP = 1000 / 60;
const MAX_FRAME_DELTA = 50;

type Memory = typeof memories.$inferSelect;
type JarSize = { width: number; height: number };

export type MemoryJarHandle = {
	openRandomMemory: () => void;
};

const dimensionsForType = (type: string): ParticleDimensions =>
	PARTICLE_DIMENSIONS[type as ParticleType] ?? PARTICLE_DIMENSIONS.WARM;

const radiusForType = (type: string) => {
	const dimensions = dimensionsForType(type);
	return Math.max(dimensions.width, dimensions.height) / 2;
};

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
	dimensions,
	openMemory,
}: {
	memory: Memory;
	body: Matter.Body;
	engine: Matter.Engine;
	dimensions: ParticleDimensions;
	openMemory: (memory: Memory) => void;
}) => {
	const { activeMemoryId, isAnimating } = useMemoryTransition();
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
		left: x.value - dimensions.width / 2,
		top: y.value - dimensions.height / 2,
		transform: [{ rotate: `${angle.value}rad` }],
	}));

	return (
		<AnimatedPressable
			onPress={() => openMemory(memory)}
			disabled={isAnimating}
			style={[styles.particle, { width: dimensions.width, height: dimensions.height }, animatedStyle]}
		>
			<View collapsable={false} style={{ opacity: activeMemoryId === memory.id ? 0 : 1 }}>
				<Particle type={memory.type} id={memory.id} width={dimensions.width} height={dimensions.height} />
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

const MemoryJar = forwardRef<MemoryJarHandle>(function MemoryJar(_, ref) {
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
	const { activeMemoryId, beginTransition, cancelTransition, isAnimating, returnToSource, transitionPhase } =
		useMemoryTransition();
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

	const openMemory = useCallback(
		(memory: Memory) => {
			if (isAnimating) return;
			if (Platform.OS === "web") {
				router.push({ pathname: "/memory", params: { id: String(memory.id) } });
				return;
			}
			const bodyPosition = freezeBody(memory.id);
			if (!bodyPosition) return;
			const dimensions = dimensionsForType(memory.type);
			jarRef.current?.measureInWindow((jarX, jarY) => {
				const transitioning = beginTransition(memory.id, memory.type, {
					x: jarX + bodyPosition.x - dimensions.width / 2,
					y: jarY + bodyPosition.y - dimensions.height / 2,
					width: dimensions.width,
					height: dimensions.height,
					angle: bodyPosition.angle,
				});
				if (!transitioning) releaseBody();
				router.push({ pathname: "/memory", params: { id: String(memory.id) } });
			});
		},
		[beginTransition, freezeBody, isAnimating, releaseBody],
	);

	useImperativeHandle(
		ref,
		() => ({
			openRandomMemory: () => {
				if (isAnimating || !visibleMemoryList.length) return;
				const memory = visibleMemoryList[Math.floor(Math.random() * visibleMemoryList.length)];
				openMemory(memory);
			},
		}),
		[isAnimating, openMemory, visibleMemoryList],
	);

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
				y: JAR_TOP_INSET + (body.circleRadius ?? PARTICLE_DIMENSIONS.WARM.width / 2),
			});
			Matter.Body.setVelocity(body, { x: 0, y: 0 });
			jarRef.current.measureInWindow((jarX, jarY) => {
				const memory = visibleMemoryList.find(({ id }) => id === activeMemoryId);
				const dimensions = dimensionsForType(memory?.type ?? "WARM");
				returnToSource(activeMemoryId, {
					x: jarX + body.position.x - dimensions.width / 2,
					y: jarY + body.position.y - dimensions.height / 2,
					width: dimensions.width,
					height: dimensions.height,
					angle: body.angle,
				});
			});
		});
		return () => cancelAnimationFrame(frame);
	}, [activeMemoryId, cancelTransition, isFocused, returnToSource, transitionPhase, visibleMemoryList]);

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
			const radius = body.circleRadius ?? PARTICLE_DIMENSIONS.WARM.width / 2;
			Matter.Body.setPosition(body, {
				x: clamp(body.position.x, JAR_PADDING + radius, jarSize.width - JAR_PADDING - radius),
				y: clamp(body.position.y, JAR_TOP_INSET + radius, jarSize.height - JAR_PADDING - radius),
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
			const existingBody = bodiesRef.current.get(memory.id);
			const existingType = (existingBody?.plugin as { memoryType?: string } | undefined)?.memoryType;
			if (existingBody && existingType === memory.type) return;
			const radius = radiusForType(memory.type);
			const diameter = radius * 2;
			const availableWidth = Math.max(0, jarSize.width - JAR_PADDING * 2 - diameter);
			const availableSpawnHeight = Math.max(0, jarSize.height / 2 - JAR_TOP_INSET - diameter);
			const x = existingBody
				? clamp(existingBody.position.x, JAR_PADDING + radius, jarSize.width - JAR_PADDING - radius)
				: JAR_PADDING + radius + Math.random() * availableWidth;
			const y = existingBody
				? clamp(existingBody.position.y, JAR_TOP_INSET + radius, jarSize.height - JAR_PADDING - radius)
				: JAR_TOP_INSET + radius + Math.random() * availableSpawnHeight;
			if (existingBody) {
				Matter.World.remove(world, existingBody);
				bodiesRef.current.delete(memory.id);
			}
			const body = Matter.Bodies.circle(x, y, radius, {
				restitution: 0.45,
				friction: 0.08,
				frictionAir: 0.012,
				angle: existingBody?.angle ?? 0,
				plugin: { memoryType: memory.type },
			});
			if (existingBody) Matter.Body.setVelocity(body, existingBody.velocity);
			bodiesRef.current.set(memory.id, body);
			Matter.World.add(world, body);
			bodiesChanged = true;
		});
		if (bodiesChanged) setBodyRevision((current) => current + 1);
	}, [engine, jarSize, visibleMemoryList]);

	useEffect(() => {
		let subscription: { remove: () => void } | undefined;
		let cancelled = false;
		let smoothed = { x: 0, y: 1 };
		const setFallbackGravity = () => {
			engine.gravity.x = 0;
			engine.gravity.y = 1;
		};
		const applyGravity = (gravity: { x: number; y: number }, smoothing = GRAVITY_SMOOTHING) => {
			smoothed = {
				x: smoothed.x + (clamp(gravity.x, -MAX_GRAVITY_COMPONENT, MAX_GRAVITY_COMPONENT) - smoothed.x) * smoothing,
				y: smoothed.y + (clamp(gravity.y, -MAX_GRAVITY_COMPONENT, MAX_GRAVITY_COMPONENT) - smoothed.y) * smoothing,
			};
			engine.gravity.x = smoothed.x;
			engine.gravity.y = smoothed.y;
		};
		const subscribe = async () => {
			setFallbackGravity();
			if (Platform.OS === "web") return;
			if (Platform.OS === "android") {
				Accelerometer.setUpdateInterval(200);
				subscription = Accelerometer.addListener(({ x, y }) => {
					if (!Number.isFinite(x) || !Number.isFinite(y)) return;
					applyGravity({ x: -x, y }, 0.45);
				});
				return;
			}
			if (!(await DeviceMotion.isAvailableAsync()) || cancelled) return;
			let permission = await DeviceMotion.getPermissionsAsync();
			if (!permission.granted && permission.canAskAgain) permission = await DeviceMotion.requestPermissionsAsync();
			if (!permission.granted || cancelled) return;
			DeviceMotion.setUpdateInterval(SENSOR_INTERVAL);
			subscription = DeviceMotion.addListener(({ accelerationIncludingGravity, orientation }) => {
				const { x, y } = accelerationIncludingGravity;
				if (!Number.isFinite(x) || !Number.isFinite(y)) return;
				applyGravity(gravityForScreen(x, y, orientation));
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
			{visibleMemoryList.map((memory) => {
				const body = bodiesRef.current.get(memory.id);
				const dimensions = dimensionsForType(memory.type);
				return body ? (
					<MemoryParticle
						key={memory.id}
						memory={memory}
						body={body}
						engine={engine}
						dimensions={dimensions}
						openMemory={openMemory}
					/>
				) : null;
			})}
		</View>
	);
});

const styles = StyleSheet.create({
	jar: { width: "100%", height: JAR_HEIGHT, marginTop: "auto", overflow: "hidden", backgroundColor: COLORS.background },
	particle: { position: "absolute" },
});

export default MemoryJar;
