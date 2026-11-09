import assert from "node:assert/strict";
import {
  applyScribeMessage,
  audioChunkMessage,
  resamplePcm16,
  scribeSession,
  transcriptLine,
} from "./scribe.ts";

const session = scribeSession("sutkn_test");
assert.equal(session.modelId, "scribe_v2_realtime");
assert.equal(session.languageCode, "ur");
assert.deepEqual(session.secondaryLanguages, ["en"]);
assert.equal(session.filterBackgroundAudio, true);
assert.equal(session.commitStrategy, "vad");
assert.equal(session.audioFormat, "pcm_16000");
assert.equal(session.token, "sutkn_test");
assert.equal(JSON.stringify(session).includes("xi-api-key"), false);

const partial = applyScribeMessage(
  { committed: [], partial: "" },
  { message_type: "partial_transcript", text: "Bhai yeh" },
);
assert.equal(transcriptLine(partial), "Bhai yeh");

const committed = applyScribeMessage(partial, {
  message_type: "committed_transcript",
  text: "Bhai yeh bill kitna hai, cash mein do.",
});
assert.deepEqual(committed.committed, ["Bhai yeh bill kitna hai, cash mein do."]);
assert.equal(committed.partial, "");
assert.equal(transcriptLine(committed), "Bhai yeh bill kitna hai, cash mein do.");

const pcm = resamplePcm16(Int16Array.from([0, 3, 0, 6, 0, 9]), 48000, 16000);
assert.equal(pcm.length, 2);

const message = JSON.parse(audioChunkMessage(Int16Array.from([1, -1])));
assert.equal(message.message_type, "input_audio_chunk");
assert.equal(message.sample_rate, 16000);
assert.equal(message.commit, false);
assert.equal(typeof message.audio_base_64, "string");
assert.equal(JSON.stringify(message).includes("eleven"), false);

console.log("scribe client ok");
