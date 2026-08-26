import AddMemory from "@/components/AddMemory/AddMemory";
import { COLORS } from "@/constants/design";
import { StyleSheet, View } from "react-native";

export default function AddMemoryScreen() {
	return (
		<View style={styles.container}>
			<AddMemory />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: COLORS.background,
		padding: 24,
	},
});
