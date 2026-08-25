import { db } from "@/db/client";
import { memories } from "@/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Text, View } from "react-native";
import Particle from "../@elements/Particle/Particle";

const MemoryJar = () => {
	const { data: memoryList } = useLiveQuery(db.select().from(memories));
	return (
		<View>
			<Text>Memory Jar</Text>
			{memoryList.map((memory) => (
				<Particle
					key={memory.id}
					type={memory.type}
					id={memory.id}
					size={20}
				/>
			))}
		</View>
	);
};

export default MemoryJar;
