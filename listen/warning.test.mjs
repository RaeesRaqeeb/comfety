import assert from "node:assert/strict";
import { createWatcher, nextWarning, NOT_WATCHING } from "./warning.ts";

const person = { label: "person", heightRatio: 0.5, centerXRatio: 0.2 };
const chair = { label: "chair", heightRatio: 0.9, centerXRatio: 0.5 };
const farCar = { label: "car", heightRatio: 0.2, centerXRatio: 0.5 };
const closeCar = { label: "car", heightRatio: 0.5, centerXRatio: 0.5 };

function frames(state, boxes, start) {
  let cursor = state;
  let spoke = null;
  for (let i = 0; i < 3; i += 1) {
    const step = nextWarning(cursor, boxes, start + i);
    cursor = step.state;
    spoke = step.speak;
  }
  return { state: cursor, spoke };
}

const first = frames(createWatcher(), [person, chair], 0);
assert.equal(first.spoke, "Person close on the left");

const cooling = frames(first.state, [person], 100);
assert.equal(cooling.spoke, null);

const again = frames(cooling.state, [person], first.state.cooldownUntil);
assert.equal(again.spoke, "Person close on the left");

assert.equal(frames(createWatcher(), [farCar], 0).spoke, null);
assert.equal(frames(createWatcher(), [chair], 0).spoke, null);
assert.equal(frames(createWatcher(), [closeCar], 0).spoke, "Vehicle close ahead");

assert.equal(NOT_WATCHING.includes("not watching"), true);
assert.equal(NOT_WATCHING.includes("Person close"), false);

console.log("warning rules ok");
