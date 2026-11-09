import assert from "node:assert/strict";
import { wantsSimpler } from "./guideTurn.ts";

assert.equal(wantsSimpler("what?"), true);
assert.equal(wantsSimpler("again"), true);
assert.equal(wantsSimpler("simpler"), true);
assert.equal(wantsSimpler("سمجھ نہیں آئی"), true);
assert.equal(wantsSimpler("Please say that again"), true);
assert.equal(wantsSimpler("Where is the door?"), false);

console.log("guide turn ok");
