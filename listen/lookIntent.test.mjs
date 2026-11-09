import assert from "node:assert/strict";
import { lookIntent } from "./lookIntent.ts";

assert.equal(lookIntent("What's in front of me?"), "describe");
assert.equal(lookIntent("what is in front of me"), "describe");
assert.equal(lookIntent("سامنے کیا ہے"), "describe");
assert.equal(lookIntent("Read this"), "read");
assert.equal(lookIntent("یہ پڑھو"), "read");
assert.equal(lookIntent("what?"), null);
assert.equal(lookIntent("Where is the door?"), null);

console.log("look intent ok");
