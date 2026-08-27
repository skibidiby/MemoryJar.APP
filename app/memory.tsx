import Particle, { ParticleType } from "@/components/@elements/Particle/Particle";
import { useMemoryTransition } from "@/components/MemoryTransition/MemoryTransition";
import { ADD_MEMORY_LAYOUT, COLORS, FONT_FAMILIES, MEMORY_DETAIL_LAYOUT, REFERENCE_SCREEN } from "@/constants/design";
import { db } from "@/db/client";
import { memories, memoryImages } from "@/db/schema";
import { MaterialIcons } from "@expo/vector-icons";
import { usePreventRemove } from "@react-navigation/native";
import { eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { router, Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const ordinal = (day: number) => {
	const remainder100 = day % 100;
	if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
	switch (day % 10) {
		case 1:
			return `${day}st`;
		case 2:
			return `${day}nd`;
		case 3:
			return `${day}rd`;
		default:
			return `${day}th`;
	}
};

const detailParticleDimensions = (type: ParticleType) => ADD_MEMORY_LAYOUT.feelings[type];

function useMemoryRecord() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const memoryId = Number(id);
	const memoryQuery = useMemo(() => db.select().from(memories).where(eq(memories.id, memoryId)), [memoryId]);
	const imageQuery = useMemo(() => db.select().from(memoryImages).where(eq(memoryImages.memoryId, memoryId)), [memoryId]);
	const { data: memoryData } = useLiveQuery(memoryQuery, [memoryId]);
	const { data: imageData } = useLiveQuery(imageQuery, [memoryId]);
	return { memoryId, memory: memoryData[0], imageUri: imageData[0]?.imageUri ?? null };
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
	const { activeMemoryId, cancelTransition, registerDestination, requestReturn } = useMemoryTransition();
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
	const editMemory = useCallback(
		(focusLocation = false) => {
			cancelTransition();
			router.push({
				pathname: "/add-memory",
				params: { id: String(memoryId), ...(focusLocation ? { focus: "location" } : {}) },
			});
		},
		[cancelTransition, memoryId],
	);
	return { destinationRef, measureDestination, hasSharedParticle, goBack, editMemory };
}

export default function Memory() {
	const { memoryId, memory, imageUri } = useMemoryRecord();
	const contentAnimation = useMemoryContentAnimation();
	const particleTransition = useMemoryParticleTransition(memoryId, contentAnimation.animateOut);
	const { width } = useWindowDimensions();
	const scale = Math.min(width / REFERENCE_SCREEN.width, 1);
	const [cardHeight, setCardHeight] = useState<number>(MEMORY_DETAIL_LAYOUT.card.minHeight);
	const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
	const [imageFailed, setImageFailed] = useState(false);

	useEffect(() => {
		setImageAspectRatio(null);
		setImageFailed(false);
		if (!imageUri) return;
		Image.getSize(
			imageUri,
			(imageWidth, imageHeight) => setImageAspectRatio(imageWidth / imageHeight),
			() => setImageFailed(true),
		);
	}, [imageUri]);

	if (!memory) return <View style={styles.screen} />;

	const particleDimensions = detailParticleDimensions(memory.type);
	const cardExtraHeight = cardHeight - MEMORY_DETAIL_LAYOUT.card.minHeight;
	const photoContentWidth = MEMORY_DETAIL_LAYOUT.card.width - MEMORY_DETAIL_LAYOUT.photoBorderWidth * 2;
	const photoHeight = imageUri && imageAspectRatio && !imageFailed
		? photoContentWidth / imageAspectRatio + MEMORY_DETAIL_LAYOUT.photoBorderWidth * 2
		: 0;
	const photoTop = MEMORY_DETAIL_LAYOUT.card.top + cardHeight + MEMORY_DETAIL_LAYOUT.photoGap;
	const dynamicOffset = cardExtraHeight + (photoHeight ? MEMORY_DETAIL_LAYOUT.photoGap + photoHeight : 0);
	const locationTop = MEMORY_DETAIL_LAYOUT.location.top + dynamicOffset;
	const feelingTop = MEMORY_DETAIL_LAYOUT.feeling.top + dynamicOffset;
	const particleTop = MEMORY_DETAIL_LAYOUT.particle.top + dynamicOffset;
	const canvasHeight = Math.max(REFERENCE_SCREEN.height, particleTop + particleDimensions.height + 60);
	const date = new Date(memory.date);
	const month = date.toLocaleString("en-US", { month: "long" });

	const measureContent = (event: LayoutChangeEvent) => {
		const nextHeight = Math.max(MEMORY_DETAIL_LAYOUT.card.minHeight, Math.ceil(event.nativeEvent.layout.height + 61));
		setCardHeight((current) => (current === nextHeight ? current : nextHeight));
	};

	return (
		<View style={styles.screen}>
			<Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={{ width: REFERENCE_SCREEN.width * scale, height: canvasHeight * scale }}>
					<View style={[styles.canvas, { height: canvasHeight, transform: [{ scale }] }]}>
						<Animated.View style={[styles.animatedContent, { height: canvasHeight }, contentAnimation.style]}>
						<Text style={styles.date}>{month} {ordinal(date.getDate())}</Text>
						<Pressable
							onPress={() => particleTransition.editMemory(false)}
							accessibilityRole="button"
							accessibilityLabel="Edit memory"
							style={styles.editButton}
						>
							<MaterialIcons name="edit" size={MEMORY_DETAIL_LAYOUT.edit.size} color={COLORS.ink} />
						</Pressable>
						<View style={[styles.card, { height: cardHeight }]} />
						<View style={styles.accent} />
						<Text onLayout={measureContent} style={styles.memoryText}>{memory.content}</Text>
						{photoHeight ? (
							<View style={[styles.photoContainer, { top: photoTop, height: photoHeight }]}>
								<Image
									source={{ uri: imageUri! }}
									resizeMode="contain"
									onError={() => setImageFailed(true)}
									style={styles.photo}
								/>
							</View>
						) : null}
						<Pressable
							onPress={() => !memory.location.trim() && particleTransition.editMemory(true)}
							disabled={!!memory.location.trim()}
							accessibilityRole={memory.location.trim() ? undefined : "button"}
							accessibilityLabel={memory.location.trim() ? memory.location : "Add location"}
							style={[styles.locationRow, { top: locationTop }]}
						>
							<MaterialIcons name="location-on" size={MEMORY_DETAIL_LAYOUT.location.iconSize} color={COLORS.ink} />
							<Text style={styles.locationText}>{memory.location.trim() || "Add location"}</Text>
						</Pressable>
						<Text style={[styles.feeling, { top: feelingTop }]}>{memory.type.toLowerCase()}{"\n"}feeling</Text>
						<Pressable
							ref={particleTransition.destinationRef}
							collapsable={false}
							onLayout={particleTransition.measureDestination}
							onPress={particleTransition.goBack}
							accessibilityRole="button"
							accessibilityLabel="Return to memory jar"
							style={[
								styles.destination,
								{
									top: particleTop,
									left: REFERENCE_SCREEN.width - MEMORY_DETAIL_LAYOUT.particle.right - particleDimensions.width,
									width: particleDimensions.width,
									height: particleDimensions.height,
								},
							]}
						>
							<View style={{ opacity: particleTransition.hasSharedParticle ? 0 : 1 }}>
								<Particle
									type={memory.type}
									id={memory.id}
									width={particleDimensions.width}
									height={particleDimensions.height}
								/>
							</View>
						</Pressable>
						</Animated.View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

const baseText = { fontFamily: FONT_FAMILIES.glykeRegular, color: COLORS.ink } as const;

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: COLORS.background },
	scrollContent: { flexGrow: 1, alignItems: "center", backgroundColor: COLORS.background },
	canvas: {
		position: "absolute",
		top: 0,
		left: 0,
		width: REFERENCE_SCREEN.width,
		transformOrigin: "top left",
	},
	animatedContent: {
		position: "relative",
		width: REFERENCE_SCREEN.width,
	},
	date: {
		...baseText,
		position: "absolute",
		left: MEMORY_DETAIL_LAYOUT.date.left,
		top: MEMORY_DETAIL_LAYOUT.date.top,
		fontSize: MEMORY_DETAIL_LAYOUT.date.fontSize,
		lineHeight: 49,
	},
	editButton: {
		position: "absolute",
		right: MEMORY_DETAIL_LAYOUT.edit.right,
		top: MEMORY_DETAIL_LAYOUT.edit.top,
		width: MEMORY_DETAIL_LAYOUT.edit.size,
		height: MEMORY_DETAIL_LAYOUT.edit.size,
	},
	card: {
		position: "absolute",
		left: MEMORY_DETAIL_LAYOUT.card.left,
		top: MEMORY_DETAIL_LAYOUT.card.top,
		width: MEMORY_DETAIL_LAYOUT.card.width,
		backgroundColor: COLORS.yellowBand,
	},
	accent: {
		position: "absolute",
		left: MEMORY_DETAIL_LAYOUT.accent.left,
		top: MEMORY_DETAIL_LAYOUT.accent.top,
		width: MEMORY_DETAIL_LAYOUT.accent.width,
		height: MEMORY_DETAIL_LAYOUT.accent.height,
		backgroundColor: COLORS.orangeBand,
	},
	memoryText: {
		...baseText,
		position: "absolute",
		left: MEMORY_DETAIL_LAYOUT.card.textLeft,
		top: MEMORY_DETAIL_LAYOUT.card.textTop,
		width: MEMORY_DETAIL_LAYOUT.card.textWidth,
		fontSize: 32,
		lineHeight: 29,
	},
	photoContainer: {
		position: "absolute",
		left: MEMORY_DETAIL_LAYOUT.card.left,
		width: MEMORY_DETAIL_LAYOUT.card.width,
		borderWidth: MEMORY_DETAIL_LAYOUT.photoBorderWidth,
		borderColor: COLORS.warm,
		backgroundColor: COLORS.background,
		overflow: "hidden",
	},
	photo: { width: "100%", height: "100%" },
	locationRow: {
		position: "absolute",
		left: MEMORY_DETAIL_LAYOUT.location.left,
		flexDirection: "row",
		alignItems: "center",
		minHeight: MEMORY_DETAIL_LAYOUT.location.iconSize,
	},
	locationText: {
		...baseText,
		marginLeft: MEMORY_DETAIL_LAYOUT.location.textLeft - MEMORY_DETAIL_LAYOUT.location.left - MEMORY_DETAIL_LAYOUT.location.iconSize,
		fontSize: MEMORY_DETAIL_LAYOUT.location.fontSize,
		lineHeight: 39,
	},
	feeling: {
		...baseText,
		position: "absolute",
		left: MEMORY_DETAIL_LAYOUT.feeling.left,
		width: MEMORY_DETAIL_LAYOUT.feeling.width,
		fontSize: MEMORY_DETAIL_LAYOUT.feeling.fontSize,
		lineHeight: MEMORY_DETAIL_LAYOUT.feeling.lineHeight,
		letterSpacing: -3,
		paddingBottom: 8,
	},
	destination: { position: "absolute" },
});
