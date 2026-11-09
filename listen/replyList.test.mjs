import assert from "node:assert/strict";
import { STARTER_REPLIES, addReply, deleteReply, replaceReply } from "./replyList.ts";

assert.deepEqual(STARTER_REPLIES, [
  "جی",
  "نہیں",
  "ایک منٹ میں لکھ رہا ہوں",
  "Please say that again",
  "کتنا ہے؟",
  "شکریہ",
]);

assert.deepEqual(addReply(STARTER_REPLIES, "  ٹھیک ہے  "), [...STARTER_REPLIES, "ٹھیک ہے"]);
assert.equal(addReply(STARTER_REPLIES, "جی"), STARTER_REPLIES);
assert.equal(addReply(STARTER_REPLIES, "   "), STARTER_REPLIES);

const replaced = replaceReply(STARTER_REPLIES, 0, "جی جی");
assert.equal(replaced[0], "جی جی");
assert.equal(replaced[1], "نہیں");
assert.equal(replaceReply(STARTER_REPLIES, 0, "  "), STARTER_REPLIES);

const removed = deleteReply(STARTER_REPLIES, 3);
assert.equal(removed.includes("Please say that again"), false);
assert.equal(removed.length, STARTER_REPLIES.length - 1);
assert.equal(deleteReply(STARTER_REPLIES, 9), STARTER_REPLIES);

console.log("reply list ok");
