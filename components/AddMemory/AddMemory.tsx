import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { Button, Text, TextInput, View } from "react-native";
import { useImmer } from "use-immer";
import { db } from "../../db/client";
import { memories } from "../../db/schema";

export type Memory = InferSelectModel<typeof memories>;
export type NewMemory = InferInsertModel<typeof memories>;

const AddMemory = () => {
	const [form, updateForm] = useImmer<NewMemory>({
		content: "",
		type: "WARM",
		location: "",
		date: Date.now(),
	});
	const updateField = <K extends keyof NewMemory>(field: K, value: NewMemory[K]) => {
		updateForm((draft) => {
			draft[field] = value;
		});
	};
	const SubmitMemory = async () => {
		const finalMemory: NewMemory = {
			...form,
			date: Date.now(),
		};
		await db.insert(memories).values(finalMemory);
		updateForm((draft) => {
			draft.content = "";
			draft.type = "WARM";
			draft.location = "";
		});
	};

	return (
		<View>
			<Text>Add Memory</Text>
			<Text>Type</Text>
			<TextInput placeholder="Type" value={form.type} onChangeText={(text) => updateField("type", text)} />
			<Text>Content</Text>
			<TextInput
				placeholder="Content"
				multiline
				value={form.content}
				onChangeText={(text) => updateField("content", text)}
			/>
			<Text>Location</Text>
			<TextInput
				placeholder="Location"
				value={form.location}
				onChangeText={(text) => updateField("location", text)}
			/>
			<Button title="Add Memory" onPress={SubmitMemory} />
		</View>
	);
};

export default AddMemory;
