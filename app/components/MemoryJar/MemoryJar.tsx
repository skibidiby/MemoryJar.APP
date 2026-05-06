import { db } from "@/app/db/client";
import { memories } from "@/app/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

type Memory = InferSelectModel<typeof memories>;

const MemoryJar = () => {
	const [memoryList, setMemoryList] = useState<Memory[]>([]);
	useEffect(() => {
		fetchMemories();
	}, []);

	const fetchMemories = async () => {
		const allMemories = await db.select().from(memories).all();
		setMemoryList(allMemories);
	};
	return (
		<View>
			<Text>Memory Jar</Text>
			{memoryList.map((memory) => (
				<Text key={memory.id}>{memory.content}</Text>
			))}
		</View>
	);
};

export default MemoryJar;
