/**
 * jsPDF draws characters one by one and cannot shape complex scripts: Tamil vowel signs
 * such as ெ ே ை are written before their consonant, and forms like கு டி க்ஷ are font
 * ligatures. The browser shapes text correctly, so any PDF cell containing such text is
 * drawn onto a canvas with a bundled Noto Sans Tamil font and embedded as an image.
 */

/** Characters Helvetica can draw; anything outside this needs browser shaping. */
const PLAIN = /^[\u0000-ÿ–—‘’“”₹]*$/;

export const needsShaping = (text: string) => !PLAIN.test(text);

const FONT_FAMILY = 'Noto Sans Tamil';
const FONT_URL = '/fonts/NotoSansTamil-Regular.ttf';
/** Tamil first, then Helvetica-like fonts so mixed Latin text matches the rest of the PDF. */
const FONT_STACK = `"${FONT_FAMILY}", Helvetica, Arial, sans-serif`;
/** Canvas pixels per PDF point — high enough to stay sharp when printed. */
const SCALE = 5;
/** Tamil has tall above/below marks, so lines need more room than Latin text. */
export const SHAPED_LINE_HEIGHT = 1.45;

let fontReady: Promise<void> | null = null;

/** Loads the bundled Tamil font once per session. */
export function loadShapingFont(): Promise<void> {
	fontReady ??= (async () => {
		const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`);
		await face.load();
		document.fonts.add(face);
	})().catch((e) => {
		fontReady = null;
		throw e;
	});
	return fontReady;
}

export const canShape = () => typeof document !== 'undefined' && typeof FontFace !== 'undefined';

export interface ShapedText {
	/** PNG data URL of the rendered text block. */
	image: string;
	/** Stable name so jsPDF embeds each distinct image once, however many rows repeat it. */
	alias: string;
	/** Size in PDF points. */
	width: number;
	height: number;
}

function graphemes(text: string): string[] {
	if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
		return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
	}
	return [...text];
}

/** Greedy word wrap; words wider than a line are broken between graphemes (never inside one). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const lines: string[] = [];
	let line = '';
	const fits = (s: string) => ctx.measureText(s).width <= maxWidth;
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const candidate = line ? `${line} ${word}` : word;
		if (fits(candidate)) {
			line = candidate;
			continue;
		}
		if (line) lines.push(line);
		line = '';
		if (fits(word)) {
			line = word;
			continue;
		}
		for (const g of graphemes(word)) {
			if (line && !fits(line + g)) {
				lines.push(line);
				line = '';
			}
			line += g;
		}
	}
	if (line) lines.push(line);
	return lines.length ? lines : [''];
}

/** Renders text wrapped to `maxWidth` points at `fontSize` points. */
let aliasSeq = 0;

export function shapeText(text: string, fontSize: number, maxWidth: number): ShapedText {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d')!;
	const font = `${fontSize * SCALE}px ${FONT_STACK}`;
	ctx.font = font;
	const lines = wrap(ctx, text.trim(), maxWidth * SCALE);
	const lineHeight = fontSize * SHAPED_LINE_HEIGHT;

	canvas.width = Math.ceil(maxWidth * SCALE);
	canvas.height = Math.ceil(lines.length * lineHeight * SCALE);
	// Resizing a canvas resets its state.
	ctx.font = font;
	ctx.fillStyle = '#000';
	ctx.textBaseline = 'middle';
	lines.forEach((l, i) => ctx.fillText(l, 0, (i + 0.5) * lineHeight * SCALE));

	return {
		image: canvas.toDataURL('image/png'),
		alias: `shaped-${++aliasSeq}`,
		width: maxWidth,
		height: lines.length * lineHeight
	};
}
