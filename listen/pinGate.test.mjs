import assert from "node:assert/strict";
import { DEMO_PIN, pinUnlocks } from "./pinGate.ts";

assert.equal(DEMO_PIN, "2026");
assert.equal(pinUnlocks("2026"), true);
assert.equal(pinUnlocks(" 2026 "), true);
assert.equal(pinUnlocks("0000"), false);
assert.equal(pinUnlocks(""), false);
console.log("pin gate ok");
