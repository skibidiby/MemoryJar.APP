import AddMemory from "@/components/AddMemory/AddMemory";
import { useLocalSearchParams } from "expo-router";

export default function AddMemoryScreen() {
	const { id, focus } = useLocalSearchParams<{ id?: string; focus?: string }>();
	const memoryId = id ? Number(id) : undefined;
	return <AddMemory memoryId={Number.isFinite(memoryId) ? memoryId : undefined} focusLocation={focus === "location"} />;
}
