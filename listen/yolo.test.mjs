import assert from "node:assert/strict";
import { boxesFromYolo, BOX_SCALE, BOX_ZERO, SCORE_SCALE, SCORE_ZERO } from "./yolo.ts";
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
console.log("yolo decode ok");
