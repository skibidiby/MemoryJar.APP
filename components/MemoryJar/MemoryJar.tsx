import { db } from "@/db/client";
import { memories } from "@/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Pressable, Text, View } from "react-native";
import Particle from "../@elements/Particle/Particle";
import { router } from "expo-router";
import { useRef } from "react";
import { useMemoryTransition } from "../MemoryTransition/MemoryTransition";

type MemoryParticleProps = {
	memory: (typeof memories.$inferSelect);
};

const MemoryParticle = ({ memory }: MemoryParticleProps) => {
	const particleRef = useRef<View>(null);
	const { activeMemoryId, beginTransition, isTransitioning } = useMemoryTransition();

	const openMemory = () => {
		if (isTransitioning) return;
		particleRef.current?.measureInWindow((x, y, width, height) => {
			beginTransition(memory.id, memory.type, { x, y, width, height });
			router.push({ pathname: "/memory", params: { id: String(memory.id) } });
		});
	};

	return (
		<Pressable onPress={openMemory} disabled={isTransitioning}>
			<View ref={particleRef} collapsable={false} style={{ opacity: activeMemoryId === memory.id ? 0 : 1 }}>
				<Particle type={memory.type} id={memory.id} size={20} />
			</View>
		</Pressable>
	);
};

const MemoryJar = () => {
	const { data: memoryList } = useLiveQuery(db.select().from(memories));
	return (
		<View>
			<Text>Memory Jar</Text>
			{memoryList.map((memory) => <MemoryParticle key={memory.id} memory={memory} />)}
		</View>
	);
};

export default MemoryJar;
