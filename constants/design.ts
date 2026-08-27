import type { ParticleType } from "@/components/@elements/Particle/Particle";

export const COLORS = {
	background: "#F5F3EF",
	ink: "#1D1E2C",
	warm: "#F26419",
	calm: "#449DD1",
	fuzzy: "#8D6A9F",
	yellowBand: "rgba(255, 251, 136, 0.5)",
	orangeBand: "rgba(242, 100, 25, 0.7)",
} as const;

export const FONT_FAMILIES = {
	glykeRegular: "CCSGlykeRegular",
} as const;

export const REFERENCE_SCREEN = {
	width: 393,
	height: 852,
} as const;

export const INDEX_LAYOUT = {
	titleLeft: 20,
	titleTop: 65,
	jarTitleTop: 149,
	titleFontSize: 120,
	titleLineHeight: 120,
	actionFontSize: 50,
	actionBandWidthOverflow: 44,
	addBandTop: 345,
	addBandHeight: 74,
	addBandRotation: "-7.48deg",
	randomBandTop: 426,
	randomBandHeight: 66,
	randomBandRotation: "5.28deg",
	jarHeight: 176,
	jarPadding: 5,
} as const;

export const ADD_MEMORY_LAYOUT = {
	title: { left: 41, top: 64, fontSize: 40 },
	dateTop: 195,
	dateFontSize: 40,
	dateFields: {
		day: { left: 59, width: 57 },
		month: { left: 146, width: 79 },
		year: { left: 255, width: 91 },
	},
	content: { left: 56, top: 313, width: 293, height: 142 },
	contentFontSize: 32,
	photo: { right: 61, top: 416, size: 30 },
	location: { left: 47, top: 473, iconSize: 27, inputLeft: 87, width: 259 },
	feelingLabelTop: 622,
	feelingLabelFontSize: 32,
	feelings: {
		FUZZY: { left: 41, labelLeft: 58, width: 94, height: 94 },
		CALM: { left: 170, labelLeft: 183, width: 79, height: 93 },
		WARM: { left: 285, labelLeft: 300, width: 93, height: 93 },
	},
	particleTop: 659,
} as const;

export const MEMORY_DETAIL_LAYOUT = {
	date: { left: 25, top: 78, fontSize: 40 },
	edit: { right: 20, top: 71, size: 35 },
	card: { left: 38, top: 278, width: 318, minHeight: 148, textLeft: 67, textTop: 301, textWidth: 278 },
	accent: { left: 16, top: 263, width: 43, height: 38 },
	photoGap: 20,
	photoBorderWidth: 3,
	location: { left: 38, top: 445, iconSize: 27, textLeft: 78, fontSize: 32 },
	feeling: { left: 29, top: 590, width: 260, fontSize: 96, lineHeight: 82 },
	particle: { right: 15, top: 659 },
} as const;

export type ParticleDimensions = { width: number; height: number };

export const PARTICLE_DIMENSIONS: Record<ParticleType, ParticleDimensions> = {
	WARM: { width: 50, height: 50 },
	CALM: { width: 42, height: 50 },
	FUZZY: { width: 52, height: 52 },
};
