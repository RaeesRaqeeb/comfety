import assert from "node:assert/strict";
import worker from "../src/index.ts";
import { SPEAK_MODEL, SPEAK_VOICE_ID } from "../src/speak.ts";

const env = {
  ELEVENLABS_API_KEY: "eleven-secret-value",
  GEMINI_API_KEY: "gemini-secret-value",
  DEMO_SECRET: "demo-secret-value",
};

const originalFetch = globalThis.fetch;
const typed = "Bhai yeh bill kitna hai, cash mein do";

function speakRequest(secret, text) {
  return new Request("https://comfety.test/v1/speak", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-comfety-demo": secret } : {}),
    },
    body: JSON.stringify({ text }),
  });
}

try {
  const missingSecret = await worker.fetch(speakRequest("", typed), {
    ...env,
    DEMO_SECRET: "",
  });
  assert.equal(missingSecret.status, 500);
  const missingSecretBody = await missingSecret.text();
  assert.equal(missingSecretBody.includes(env.ELEVENLABS_API_KEY), false);

  const rejected = await worker.fetch(speakRequest("wrong", typed), env);
  assert.equal(rejected.status, 401);

  const empty = await worker.fetch(speakRequest(env.DEMO_SECRET, ""), env);
  assert.equal(empty.status, 400);

  let upstreamUrl = "";
  let upstreamKey = "";
  let upstreamBody = "";
  globalThis.fetch = async (input, init) => {
    upstreamUrl = String(input);
    const headers = init?.headers;
    if (headers && typeof headers.get === "function") {
      upstreamKey = headers.get("xi-api-key") ?? "";
    } else {
      upstreamKey = headers?.["xi-api-key"] ?? "";
    }
    upstreamBody = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? "");
    return new Response(Uint8Array.from([73, 68, 51, 1]), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    });
  };

  const spoken = await worker.fetch(speakRequest(env.DEMO_SECRET, typed), env);
  assert.equal(spoken.status, 200);
  assert.match(spoken.headers.get("content-type") ?? "", /audio\/mpeg/);
  assert.equal(SPEAK_VOICE_ID, "hpp4J3VqNfWAUOO0d1Us");
  assert.equal(upstreamUrl.includes(`/v1/text-to-speech/${SPEAK_VOICE_ID}`), true);
  assert.equal(upstreamUrl.includes("language_code"), false);
  assert.equal(upstreamKey, env.ELEVENLABS_API_KEY);
  const sent = JSON.parse(upstreamBody);
  assert.equal(sent.text, typed);
  assert.equal(sent.model_id, SPEAK_MODEL);
  assert.equal("language_code" in sent, false);
  const audio = new Uint8Array(await spoken.arrayBuffer());
  assert.deepEqual(Array.from(audio), [73, 68, 51, 1]);
  const audioText = new TextDecoder().decode(audio);
  assert.equal(audioText.includes(env.ELEVENLABS_API_KEY), false);

  globalThis.fetch = async () => new Response("nope", { status: 403 });
  const failed = await worker.fetch(speakRequest(env.DEMO_SECRET, typed), env);
  assert.equal(failed.status, 502);
  const failedBody = await failed.text();
  assert.equal(failedBody.includes(env.ELEVENLABS_API_KEY), false);
  assert.match(failedBody, /Speak request failed/);

  console.log("speak route ok");
} finally {
  globalThis.fetch = originalFetch;
}
