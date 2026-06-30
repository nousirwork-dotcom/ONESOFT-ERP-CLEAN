/**
 * BarcodeService.ts — خدمة الباركود المركزية
 *
 * تُنشئ باركود Code128 كـ SVG بدون مكتبات خارجية.
 * يُستخدم في LabelBuilder وأي مستند يحتاج باركود.
 */

/* ── Code128B character set ─────────────────────────────────────────────── */
const CODE128_CHARS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

/* Code128B patterns (binary: 1=bar, 0=space) */
const CODE128_PATTERNS: number[] = [
  0b11011001100, 0b11001101100, 0b11001100110, 0b10010011000, 0b10010001100,
  0b10001001100, 0b10011001000, 0b10011000100, 0b10001100100, 0b11001001000,
  0b11001000100, 0b11000100100, 0b10110011100, 0b10011011100, 0b10011001110,
  0b10111001100, 0b10011101100, 0b10011100110, 0b11001110010, 0b11001011100,
  0b11001001110, 0b11011100100, 0b11001110100, 0b11101101110, 0b11101001100,
  0b11100101100, 0b11100100110, 0b11101100100, 0b11100110100, 0b11100110010,
  0b11011011000, 0b11011000110, 0b11000110110, 0b10100011000, 0b10001011000,
  0b10001000110, 0b10110001000, 0b10001101000, 0b10001100010, 0b11010001000,
  0b11000101000, 0b11000100010, 0b10110111000, 0b10110001110, 0b10001101110,
  0b10111011000, 0b10111000110, 0b10001110110, 0b11101110110, 0b11010001110,
  0b11000101110, 0b11011101000, 0b11011100010, 0b11011101110, 0b11101011000,
  0b11101000110, 0b11100010110, 0b11101101000, 0b11101100010, 0b11100011010,
  0b11101111010, 0b11001000010, 0b11110001010, 0b10100110000, 0b10100001100,
  0b10010110000, 0b10010000110, 0b10000101100, 0b10000100110, 0b10110010000,
  0b10110000100, 0b10011010000, 0b10011000010, 0b10000110100, 0b10000110010,
  0b11000010010, 0b11001010000, 0b11110111010, 0b11000010100, 0b10001111010,
  0b10100111100, 0b10010111100, 0b10010011110, 0b10111100100, 0b10011110100,
  0b10011110010, 0b11110100100, 0b11110010100, 0b11110010010, 0b11011011110,
  0b11011110110, 0b11110110110, 0b10101111000, 0b10100011110, 0b10001011110,
  0b10111101000, 0b10111100010, 0b11110101000, 0b11110100010, 0b10111011110,
  0b10111101110, 0b11101011110, 0b11110101110, 0b11010000100, 0b11010010000,
  0b11010011100,
];

const START_B  = 104;
const STOP_PAT = 0b1100011101011;
const QUIET    = 10;

export interface BarcodeOptions {
  width?:       number;
  height?:      number;
  barWidth?:    number;
  showText?:    boolean;
  textSize?:    number;
  color?:       string;
  background?:  string;
}

export const BarcodeService = {
  /**
   * يُنشئ باركود Code128B كـ SVG string.
   * @param text  النص المراد تحويله لباركود
   * @param opts  خيارات العرض
   */
  generateSvg(text: string, opts: BarcodeOptions = {}): string {
    if (!text) return "";

    const {
      height     = 60,
      barWidth   = 2,
      showText   = true,
      textSize   = 11,
      color      = "#000000",
      background = "transparent",
    } = opts;

    const codes: number[] = [];
    let checksum = START_B;

    for (let i = 0; i < text.length; i++) {
      const idx = CODE128_CHARS.indexOf(text[i]);
      if (idx === -1) continue;
      codes.push(idx);
      checksum += idx * (i + 1);
    }
    checksum = checksum % 103;

    const allCodes = [START_B, ...codes, checksum];
    const patterns = allCodes.map(c => CODE128_PATTERNS[c]);

    let bars: { x: number; width: number; isBar: boolean }[] = [];
    let xPos = QUIET;

    for (const pattern of patterns) {
      for (let bit = 10; bit >= 0; bit--) {
        const isBar = !!((pattern >> bit) & 1);
        bars.push({ x: xPos, width: barWidth, isBar });
        xPos += barWidth;
      }
    }

    for (let bit = 12; bit >= 0; bit--) {
      const isBar = !!((STOP_PAT >> bit) & 1);
      bars.push({ x: xPos, width: barWidth, isBar });
      xPos += barWidth;
    }

    xPos += QUIET;
    const svgWidth = xPos;
    const textY = height + textSize + 4;
    const svgHeight = showText ? textY + 4 : height;

    const rects = bars
      .filter(b => b.isBar)
      .map(b => `<rect x="${b.x}" y="0" width="${b.width}" height="${height}" fill="${color}"/>`)
      .join("");

    const textEl = showText
      ? `<text x="${svgWidth / 2}" y="${textY}" text-anchor="middle" font-family="monospace" font-size="${textSize}" fill="${color}">${escBc(text)}</text>`
      : "";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  ${background !== "transparent" ? `<rect width="${svgWidth}" height="${svgHeight}" fill="${background}"/>` : ""}
  ${rects}
  ${textEl}
</svg>`;
  },

  /**
   * يُنشئ باركود كـ data URL لاستخدامه في <img src="...">
   */
  generateDataUrl(text: string, opts: BarcodeOptions = {}): string {
    const svg = this.generateSvg(text, opts);
    if (!svg) return "";
    const encoded = encodeURIComponent(svg);
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  },
};

function escBc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
