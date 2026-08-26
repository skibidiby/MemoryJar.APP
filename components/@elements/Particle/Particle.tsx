import { StyleProp, View, ViewStyle } from "react-native";
import WarmIcon from "@/assets/icons/Warm.svg";
import CalmIcon from "@/assets/icons/Calm.svg";
import FuzzyIcon from "@/assets/icons/Fuzzy.svg";
import type { NumberProp } from "react-native-svg";
export type ParticleType = "WARM" | "CALM" | "FUZZY";

export interface ParticleProps {
	type: ParticleType;
	id: number;
	size?: NumberProp;
	style?: StyleProp<ViewStyle>;
}

const ParticleIcon = ({ type, width, height }: { type: ParticleProps["type"]; width?: NumberProp; height?: NumberProp }) => {
	switch (type) {
		case "WARM":
			return <WarmIcon width={width} height={height} />;
		case "CALM":
			return <CalmIcon width={width} height={height} />;
		case "FUZZY":
			return <FuzzyIcon width={width} height={height} />;
		default:
			return null;
	}
};

const Particle = ({ type, id, size, style }: ParticleProps) => {
	return (
		<View style={style} key={id}>
			<ParticleIcon type={type} width={size} height={size} />
		</View>
	);
};
export default Particle;
