import type { Box } from "./warning";

export const MODEL_INPUT = 640;
export const BOX_SCALE = 0.0041012950241565704;
export const BOX_ZERO = -122;
export const SCORE_SCALE = 0.00390625;
export const SCORE_ZERO = -128;

const WATCHED: ReadonlyArray<readonly [number, string]> = [
  [0, "person"],
  [1, "bicycle"],
  [2, "car"],
  [3, "motorcycle"],
  [5, "bus"],
  [7, "truck"],
];

function dequant(quantized: number, scale: number, zero: number): number {
  "worklet";
  return (quantized - zero) * scale;
}

export function boxesFromYolo(boxesQ: ArrayLike<number>, scoresQ: ArrayLike<number>, scoreMin = 0.35): Box[] {
  "worklet";
  const found: Box[] = [];
  for (let index = 0; index < 8400; index += 1) {
    let best = 0;
    let label = "";
    for (const [classIndex, name] of WATCHED) {
      const score = dequant(scoresQ[classIndex * 8400 + index] ?? 0, SCORE_SCALE, SCORE_ZERO);
      if (score > best) {
        best = score;
        label = name;
      }
    }
    if (best < scoreMin) {
      continue;
    }
    // Channels are center x, center y, width, height. Reading them as
    // left/top/right/bottom makes a close person look too short to say.
    const centerX = dequant(boxesQ[index] ?? 0, BOX_SCALE, BOX_ZERO);
    const width = dequant(boxesQ[16800 + index] ?? 0, BOX_SCALE, BOX_ZERO);
    const height = dequant(boxesQ[25200 + index] ?? 0, BOX_SCALE, BOX_ZERO);
    if (width <= 0 || height <= 0) {
      continue;
    }
    found.push({
      label,
      heightRatio: height,
      centerXRatio: centerX,
    });
  }
  return found;
}

export type RgbOrder = "rgb" | "rgba" | "bgra";

export function stretchRgb(
  pixels: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
  channels: number,
  order: RgbOrder,
): Uint8Array {
  "worklet";
  const dst = new Uint8Array(MODEL_INPUT * MODEL_INPUT * 3);
  const srcW = Math.trunc(width);
  const srcH = Math.trunc(height);
  const stride = Math.trunc(bytesPerRow);
  const count = Math.trunc(channels);
  if (srcW < 1 || srcH < 1 || count < 3 || stride < srcW * count) {
    return dst;
  }
  const redAt = order === "bgra" ? 2 : 0;
  const blueAt = order === "bgra" ? 0 : 2;
  for (let y = 0; y < MODEL_INPUT; y += 1) {
    const srcY = Math.floor((y * srcH) / MODEL_INPUT);
    const row = srcY * stride;
    const dstRow = y * MODEL_INPUT * 3;
    for (let x = 0; x < MODEL_INPUT; x += 1) {
      const srcX = Math.floor((x * srcW) / MODEL_INPUT);
      const pixel = row + srcX * count;
      const out = dstRow + x * 3;
      dst[out] = pixels[pixel + redAt] ?? 0;
      dst[out + 1] = pixels[pixel + 1] ?? 0;
      dst[out + 2] = pixels[pixel + blueAt] ?? 0;
    }
  }
  return dst;
}
