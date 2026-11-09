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
    const left = dequant(boxesQ[index] ?? 0, BOX_SCALE, BOX_ZERO);
    const top = dequant(boxesQ[8400 + index] ?? 0, BOX_SCALE, BOX_ZERO);
    const right = dequant(boxesQ[16800 + index] ?? 0, BOX_SCALE, BOX_ZERO);
    const bottom = dequant(boxesQ[25200 + index] ?? 0, BOX_SCALE, BOX_ZERO);
    const heightRatio = bottom - top;
    if (heightRatio <= 0) {
      continue;
    }
    found.push({
      label,
      heightRatio,
      centerXRatio: (left + right) / 2,
    });
  }
  return found;
}
