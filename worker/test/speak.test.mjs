import assert from "node:assert/strict";
import worker from "../src/index.ts";
import { DEFAULT_SPEAK_VOICE, SPEAK_MODEL, SPEAK_VOICES } from "../src/speak.ts";

const env = {
  ELEVENLABS_API_KEY: "eleven-secret-value",
  GEMINI_API_KEY: "gemini-secret-value",
  DEMO_SECRET: "demo-secret-value",
};

const originalFetch = globalThis.fetch;
const typed = "Bhai yeh bill kitna hai, cash mein do";

function speakRequest(secret, text, voice) {
  return new Request("https://comfety.test/v1/speak", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-comfety-demo": secret } : {}),
    },
    body: JSON.stringify(voice === undefined ? { text } : { text, voice }),
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
  assert.equal(SPEAK_VOICES[DEFAULT_SPEAK_VOICE], "hpp4J3VqNfWAUOO0d1Us");
  assert.equal(upstreamUrl.includes(`/v1/text-to-speech/${SPEAK_VOICES[DEFAULT_SPEAK_VOICE]}`), true);
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

  for (const [name, id] of Object.entries(SPEAK_VOICES)) {
    const chosen = await worker.fetch(speakRequest(env.DEMO_SECRET, typed, name), env);
    assert.equal(chosen.status, 200);
    assert.equal(upstreamUrl.includes(`/v1/text-to-speech/${id}`), true);
    assert.equal(JSON.parse(upstreamBody).text, typed);
  }

  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("nope", { status: 403 });
  };
  const unknown = await worker.fetch(speakRequest(env.DEMO_SECRET, typed, "library"), env);
  assert.equal(unknown.status, 400);
  assert.equal(called, false);
  const unknownBody = await unknown.text();
  assert.equal(unknownBody.includes(env.ELEVENLABS_API_KEY), false);

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
