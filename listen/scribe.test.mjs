import assert from "node:assert/strict";
import {
  applyScribeMessage,
  audioChunkMessage,
  resamplePcm16,
  scribeSocketUrl,
  transcriptLine,
} from "./scribe.ts";

const url = new URL(scribeSocketUrl("sutkn_test"));
assert.equal(url.origin + url.pathname, "wss://api.elevenlabs.io/v1/speech-to-text/realtime");
assert.equal(url.searchParams.get("model_id"), "scribe_v2_realtime");
assert.equal(url.searchParams.get("language_code"), "ur");
assert.deepEqual(url.searchParams.getAll("secondary_languages"), ["en"]);
assert.equal(url.searchParams.get("filter_background_audio"), "true");
assert.equal(url.searchParams.get("audio_format"), "pcm_16000");
assert.equal(url.searchParams.get("token"), "sutkn_test");
assert.equal(url.search.includes("xi-api-key"), false);

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
