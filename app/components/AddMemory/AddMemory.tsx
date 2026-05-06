import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { Button, Text, TextInput, View } from "react-native";
import { useImmer } from "use-immer";
import { db } from "../../db/client";
import { memories } from "../../db/schema";

export type Memory = InferSelectModel<typeof memories>;
export type NewMemory = InferInsertModel<typeof memories>;

const AddMemory = () => {
	const [form, updateForm] = useImmer<NewMemory>({
		title: "",
		content: "",
		intensity: 0,
		createdAt: Date.now(),
	});
	const updateField = <K extends keyof NewMemory>(field: K, value: NewMemory[K]) => {
		updateForm((draft) => {
			draft[field] = value;
		});
	};
	const SubmitMemory = async () => {
		const finalMemory: NewMemory = {
			...form,
			createdAt: Date.now(),
		};
		await db.insert(memories).values(finalMemory);
		updateForm((draft) => {
			draft.title = "";
			draft.content = "";
			draft.intensity = 0;
		});
	};

	return (
		<View>
			<Text>Add Memory</Text>
			<Text>Title</Text>
			<TextInput placeholder="Title" value={form.title} onChangeText={(text) => updateField("title", text)} />
			<Text>Content</Text>
			<TextInput
				placeholder="Content"
				multiline
				value={form.content}
				onChangeText={(text) => updateField("content", text)}
			/>
			<Text>Intensity</Text>
			<TextInput
				placeholder="Intensity"
				keyboardType="numeric"
				value={String(form.intensity)}
				onChangeText={(text) => updateField("intensity", Number(text))}
			/>
			<Button title="Add Memory" onPress={SubmitMemory} />
		</View>
	);
};

export default AddMemory;
