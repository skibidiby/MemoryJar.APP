import Particle, { ParticleType } from "@/components/@elements/Particle/Particle";
import { ADD_MEMORY_LAYOUT, COLORS, FONT_FAMILIES, REFERENCE_SCREEN } from "@/constants/design";
import { db } from "@/db/client";
import { memories, memoryImages } from "@/db/schema";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
	Alert,
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	useWindowDimensions,
	View,
} from "react-native";

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

type SelectedImage = ImagePicker.ImagePickerAsset;

const normalizedDate = (value: Date) => {
	const date = new Date(value);
	date.setHours(12, 0, 0, 0);
	return date;
};

const extensionForImage = (image: SelectedImage) => {
	const fileExtension = image.fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1];
	if (fileExtension) return fileExtension.toLowerCase();
	if (image.mimeType === "image/png") return "png";
	if (image.mimeType === "image/webp") return "webp";
	if (image.mimeType === "image/heic" || image.mimeType === "image/heif") return "heic";
	return "jpg";
};

const persistImage = (image: SelectedImage) => {
	const directory = new Directory(Paths.document, "memory-images");
	directory.create({ idempotent: true, intermediates: true });
	const destination = new File(
		directory,
		`${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForImage(image)}`,
	);
	new File(image.uri).copy(destination);
	return destination;
};

type FeelingOptionProps = {
	type: ParticleType;
	label: string;
	id: number;
	left: number;
	labelLeft: number;
	width: number;
	height: number;
	disabled: boolean;
	onPress: (type: ParticleType) => void;
};

function FeelingOption({ type, label, id, left, labelLeft, width, height, disabled, onPress }: FeelingOptionProps) {
	return (
		<>
			<Text style={[styles.feelingLabel, { left: labelLeft }]}>{label}</Text>
			<Pressable
				onPress={() => onPress(type)}
				disabled={disabled}
				accessibilityRole="button"
				accessibilityLabel={`Save as ${label} memory`}
				accessibilityState={{ disabled }}
				style={[styles.feelingButton, { left, width, height }]}
			>
				<Particle id={id} type={type} width={width} height={height} />
			</Pressable>
		</>
	);
}

export default function AddMemory() {
	const { width } = useWindowDimensions();
	const scale = Math.min(width / REFERENCE_SCREEN.width, 1);
	const [date, setDate] = useState(() => normalizedDate(new Date()));
	const [iosDraftDate, setIosDraftDate] = useState(date);
	const [isIosDatePickerVisible, setIsIosDatePickerVisible] = useState(false);
	const [content, setContent] = useState("");
	const [location, setLocation] = useState("");
	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const canvasSize = useMemo(
		() => ({ width: REFERENCE_SCREEN.width * scale, height: REFERENCE_SCREEN.height * scale }),
		[scale],
	);
	const maximumDate = useMemo(() => new Date(), []);

	const openDatePicker = () => {
		Keyboard.dismiss();
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({
				value: date,
				maximumDate,
				mode: "date",
				display: "default",
				onChange: (event, selectedDate) => {
					if (event.type === "set" && selectedDate) setDate(normalizedDate(selectedDate));
				},
			});
			return;
		}
		if (Platform.OS === "ios") {
			setIosDraftDate(date);
			setIsIosDatePickerVisible(true);
		}
	};

	const pickImage = async () => {
		try {
			const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (!permission.granted) {
				Alert.alert("Photo access required", "Allow photo-library access to attach an image to this memory.");
				return;
			}
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ["images"],
				allowsEditing: false,
				allowsMultipleSelection: false,
				quality: 1,
			});
			if (!result.canceled) setSelectedImage(result.assets[0]);
		} catch {
			Alert.alert("Photo unavailable", "The photo library could not be opened. Please try again.");
		}
	};

	const saveMemory = async (type: ParticleType) => {
		if (isSubmitting) return;
		if (!content.trim()) {
			Alert.alert("Write your memory", "Add some memory text before choosing a feeling.");
			return;
		}
		setIsSubmitting(true);
		let copiedImage: File | null = null;
		try {
			if (selectedImage) copiedImage = persistImage(selectedImage);
			db.transaction((tx) => {
				const created = tx
					.insert(memories)
					.values({ content: content.trim(), type, location: location.trim(), date: normalizedDate(date).getTime() })
					.returning({ id: memories.id })
					.get();
				if (copiedImage) tx.insert(memoryImages).values({ memoryId: created.id, imageUri: copiedImage.uri }).run();
			});
			router.back();
		} catch {
			if (copiedImage?.exists) copiedImage.delete();
			setIsSubmitting(false);
			Alert.alert("Memory not saved", "Something went wrong while saving. Please try again.");
		}
	};

	return (
		<>
			<KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<View style={canvasSize}>
					<View style={[styles.canvas, { transform: [{ scale }] }]}>
						<Text style={styles.title}>Add memory</Text>
						<Text pointerEvents="none" style={[styles.dateValue, styles.dayInput]}>{date.getDate()}</Text>
						<Text pointerEvents="none" style={[styles.dateValue, styles.monthInput]}>
							{MONTHS[date.getMonth()].slice(0, 3)}
						</Text>
						<Text pointerEvents="none" style={[styles.dateValue, styles.yearInput]}>{date.getFullYear()}</Text>
						<Pressable
							onPress={openDatePicker}
							accessibilityRole="button"
							accessibilityLabel={`Choose memory date, currently ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`}
							style={styles.datePressTarget}
						/>
						<View style={styles.memoryField}>
							<TextInput
								value={content}
								onChangeText={setContent}
								placeholder="write your memory..."
								placeholderTextColor="rgba(29, 30, 44, 0.6)"
								multiline
								textAlignVertical="top"
								style={styles.memoryInput}
							/>
							<Pressable
								onPress={pickImage}
								accessibilityRole="button"
								accessibilityLabel={selectedImage ? "Change attached photo" : "Attach photo"}
								style={styles.photoButton}
							>
								{selectedImage ? (
									<Image source={{ uri: selectedImage.uri }} resizeMode="cover" style={styles.thumbnail} />
								) : (
									<MaterialIcons name="photo" size={ADD_MEMORY_LAYOUT.photo.size} color={COLORS.ink} />
								)}
							</Pressable>
						</View>
						<TextInput
							value={location}
							onChangeText={setLocation}
							placeholder="Add location"
							placeholderTextColor="rgba(29, 30, 44, 0.6)"
							accessibilityLabel="Location"
							returnKeyType="done"
							style={styles.locationInput}
						/>
						<View pointerEvents="none" style={styles.locationIcon}>
							<MaterialIcons name="location-on" size={ADD_MEMORY_LAYOUT.location.iconSize} color={COLORS.ink} />
						</View>
						<FeelingOption type="FUZZY" label="Fuzzy" id={-1} {...ADD_MEMORY_LAYOUT.feelings.FUZZY} disabled={isSubmitting} onPress={saveMemory} />
						<FeelingOption type="CALM" label="Calm" id={-2} {...ADD_MEMORY_LAYOUT.feelings.CALM} disabled={isSubmitting} onPress={saveMemory} />
						<FeelingOption type="WARM" label="Warm" id={-3} {...ADD_MEMORY_LAYOUT.feelings.WARM} disabled={isSubmitting} onPress={saveMemory} />
					</View>
				</View>
			</ScrollView>
			</KeyboardAvoidingView>
			<Modal
				visible={isIosDatePickerVisible}
				transparent
				animationType="slide"
				presentationStyle="overFullScreen"
				onRequestClose={() => setIsIosDatePickerVisible(false)}
			>
				<Pressable style={styles.modalBackdrop} onPress={() => setIsIosDatePickerVisible(false)}>
					<Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
						<View style={styles.pickerActions}>
							<Pressable onPress={() => setIsIosDatePickerVisible(false)} accessibilityRole="button">
								<Text style={styles.pickerActionText}>Cancel</Text>
							</Pressable>
							<Pressable
								onPress={() => {
									setDate(normalizedDate(iosDraftDate));
									setIsIosDatePickerVisible(false);
								}}
								accessibilityRole="button"
							>
								<Text style={styles.pickerActionText}>Done</Text>
							</Pressable>
						</View>
						<DateTimePicker
							value={iosDraftDate}
							onChange={(_, selectedDate) => selectedDate && setIosDraftDate(selectedDate)}
							maximumDate={maximumDate}
							mode="date"
							display="spinner"
							style={styles.iosPicker}
						/>
					</Pressable>
				</Pressable>
			</Modal>
		</>
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
		height: REFERENCE_SCREEN.height,
		transformOrigin: "top left",
	},
	title: {
		...baseText,
		position: "absolute",
		left: ADD_MEMORY_LAYOUT.title.left,
		top: ADD_MEMORY_LAYOUT.title.top,
		fontSize: ADD_MEMORY_LAYOUT.title.fontSize,
		lineHeight: 49,
	},
	dateValue: {
		...baseText,
		position: "absolute",
		top: ADD_MEMORY_LAYOUT.dateTop,
		height: 46,
		padding: 0,
		borderBottomWidth: 3,
		borderBottomColor: COLORS.warm,
		fontSize: ADD_MEMORY_LAYOUT.dateFontSize,
		lineHeight: 46,
		textAlign: "center",
	},
	datePressTarget: {
		position: "absolute",
		left: ADD_MEMORY_LAYOUT.dateFields.day.left,
		top: ADD_MEMORY_LAYOUT.dateTop,
		width:
			ADD_MEMORY_LAYOUT.dateFields.year.left +
			ADD_MEMORY_LAYOUT.dateFields.year.width -
			ADD_MEMORY_LAYOUT.dateFields.day.left,
		height: 46,
	},
	dayInput: ADD_MEMORY_LAYOUT.dateFields.day,
	monthInput: ADD_MEMORY_LAYOUT.dateFields.month,
	yearInput: ADD_MEMORY_LAYOUT.dateFields.year,
	memoryField: {
		position: "absolute",
		left: ADD_MEMORY_LAYOUT.content.left,
		top: ADD_MEMORY_LAYOUT.content.top,
		width: ADD_MEMORY_LAYOUT.content.width,
		height: ADD_MEMORY_LAYOUT.content.height,
		borderWidth: 3,
		borderColor: COLORS.warm,
	},
	memoryInput: {
		...baseText,
		flex: 1,
		paddingHorizontal: 12,
		paddingTop: 12,
		paddingBottom: 42,
		fontSize: ADD_MEMORY_LAYOUT.contentFontSize,
		lineHeight: 39,
	},
	photoButton: {
		position: "absolute",
		right: 12,
		bottom: 10,
		width: ADD_MEMORY_LAYOUT.photo.size,
		height: ADD_MEMORY_LAYOUT.photo.size,
		alignItems: "center",
		justifyContent: "center",
	},
	thumbnail: { width: ADD_MEMORY_LAYOUT.photo.size, height: ADD_MEMORY_LAYOUT.photo.size, borderRadius: 2 },
	locationIcon: {
		position: "absolute",
		left: ADD_MEMORY_LAYOUT.location.left,
		top: ADD_MEMORY_LAYOUT.location.top,
		width: ADD_MEMORY_LAYOUT.location.iconSize,
		height: ADD_MEMORY_LAYOUT.location.iconSize,
	},
	locationInput: {
		...baseText,
		position: "absolute",
		left: ADD_MEMORY_LAYOUT.location.left,
		top: ADD_MEMORY_LAYOUT.location.top - 7,
		width: ADD_MEMORY_LAYOUT.location.inputLeft + ADD_MEMORY_LAYOUT.location.width - ADD_MEMORY_LAYOUT.location.left,
		height: 42,
		paddingTop: 0,
		paddingBottom: 0,
		paddingLeft: ADD_MEMORY_LAYOUT.location.inputLeft - ADD_MEMORY_LAYOUT.location.left,
		paddingRight: 0,
		fontSize: 32,
		lineHeight: 38,
	},
	modalBackdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: "rgba(0, 0, 0, 0.28)",
	},
	pickerSheet: {
		backgroundColor: COLORS.background,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingTop: 14,
		paddingBottom: 24,
	},
	pickerActions: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 24,
	},
	pickerActionText: { ...baseText, color: COLORS.warm, fontSize: 22, lineHeight: 30 },
	iosPicker: { alignSelf: "stretch", height: 216 },
	feelingLabel: {
		...baseText,
		position: "absolute",
		top: ADD_MEMORY_LAYOUT.feelingLabelTop,
		fontSize: ADD_MEMORY_LAYOUT.feelingLabelFontSize,
		lineHeight: 39,
	},
	feelingButton: { position: "absolute", top: ADD_MEMORY_LAYOUT.particleTop },
});
