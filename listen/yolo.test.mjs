import assert from "node:assert/strict";
import { boxesFromYolo, BOX_SCALE, BOX_ZERO, MODEL_INPUT, SCORE_SCALE, SCORE_ZERO, stretchRgb } from "./yolo.ts";
import { createWatcher, nextWarning } from "./warning.ts";

function quant(real, scale, zero) {
  return Math.round(real / scale + zero);
}

function setBox(boxes, index, left, top, right, bottom) {
  boxes[index] = quant(left, BOX_SCALE, BOX_ZERO);
  boxes[8400 + index] = quant(top, BOX_SCALE, BOX_ZERO);
  boxes[16800 + index] = quant(right, BOX_SCALE, BOX_ZERO);
  boxes[25200 + index] = quant(bottom, BOX_SCALE, BOX_ZERO);
}

const boxes = new Int8Array(4 * 8400);
const scores = new Int8Array(80 * 8400);
boxes.fill(BOX_ZERO);
scores.fill(SCORE_ZERO);

setBox(boxes, 10, 0.05, 0.2, 0.35, 0.7);
scores[10] = quant(0.8, SCORE_SCALE, SCORE_ZERO);

setBox(boxes, 11, 0.1, 0.1, 0.9, 0.9);
scores[56 * 8400 + 11] = quant(0.95, SCORE_SCALE, SCORE_ZERO);

setBox(boxes, 12, 0.1, 0.1, 0.4, 0.8);
scores[12] = quant(0.2, SCORE_SCALE, SCORE_ZERO);

const found = boxesFromYolo(boxes, scores);
assert.equal(found.length, 1);
assert.equal(found[0].label, "person");
assert.ok(found[0].heightRatio >= 0.45 && found[0].heightRatio <= 0.55);
assert.ok(found[0].centerXRatio >= 0.15 && found[0].centerXRatio <= 0.25);

let step = nextWarning(createWatcher(), found, 0);
assert.equal(step.speak, null);
step = nextWarning(step.state, found, 100);
assert.equal(step.speak, null);
step = nextWarning(step.state, found, 200);
assert.equal(step.speak, "Person close on the left");

function rgbAt(buffer, x, y) {
  const index = (y * MODEL_INPUT + x) * 3;
  return [buffer[index], buffer[index + 1], buffer[index + 2]];
}

const frameW = 4;
const frameH = 2;
const rgbChannels = 3;
const stride = 16;
const rgb = new Uint8Array(stride * frameH);
rgb[1 * stride + 2 * rgbChannels] = 9;
rgb[1 * stride + 2 * rgbChannels + 1] = 8;
rgb[1 * stride + 2 * rgbChannels + 2] = 7;
rgb[0 * stride + 1 * rgbChannels] = 1;
rgb[0 * stride + 1 * rgbChannels + 1] = 2;
rgb[0 * stride + 1 * rgbChannels + 2] = 3;
rgb[stride - 1] = 255;
rgb[stride * frameH - 1] = 255;
const stretched = stretchRgb(rgb, frameW, frameH, stride, rgbChannels, "rgb");
assert.equal(stretched.length, MODEL_INPUT * MODEL_INPUT * 3);
assert.deepEqual(rgbAt(stretched, 320, 320), [9, 8, 7]);
assert.deepEqual(rgbAt(stretched, 319, 319), [1, 2, 3]);

const bgra = new Uint8Array([4, 5, 6, 255, 0, 0, 0, 0]);
const fromBgra = stretchRgb(bgra, 1, 1, 8, 4, "bgra");
assert.deepEqual(rgbAt(fromBgra, 0, 0), [6, 5, 4]);
assert.deepEqual(rgbAt(fromBgra, 639, 639), [6, 5, 4]);

const rgba = new Uint8Array([9, 8, 7, 1]);
const fromRgba = stretchRgb(rgba, 1, 1, 4, 4, "rgba");
assert.deepEqual(rgbAt(fromRgba, 100, 200), [9, 8, 7]);
console.log("yolo decode ok");
