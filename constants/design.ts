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

export type ParticleDimensions = { width: number; height: number };

export const PARTICLE_DIMENSIONS: Record<ParticleType, ParticleDimensions> = {
	WARM: { width: 50, height: 50 },
	CALM: { width: 42, height: 50 },
	FUZZY: { width: 52, height: 52 },
};
