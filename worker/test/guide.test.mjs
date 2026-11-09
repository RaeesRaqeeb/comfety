import assert from "node:assert/strict";
import worker from "../src/index.ts";
import { GUIDE_MODEL } from "../src/guide.ts";

const env = {
  ELEVENLABS_API_KEY: "eleven-secret-value",
  XAI_API_KEY: "xai-secret-value",
  DEMO_SECRET: "demo-secret-value",
};

const originalFetch = globalThis.fetch;
const asked = "Where is the door?";

function guideRequest(secret, body) {
  return new Request("https://comfety.test/v1/guide", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-comfety-demo": secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

try {
  const missing = await worker.fetch(guideRequest(env.DEMO_SECRET, { text: asked }), {
    ...env,
    XAI_API_KEY: "",
  });
  assert.equal(missing.status, 500);
  const missingBody = await missing.text();
  assert.match(missingBody, /XAI_API_KEY is not set/);
  assert.equal(missingBody.includes(env.ELEVENLABS_API_KEY), false);

  const rejected = await worker.fetch(guideRequest("wrong", { text: asked }), env);
  assert.equal(rejected.status, 401);

  let upstreamUrl = "";
  let upstreamKey = "";
  let upstreamBody = "";
  globalThis.fetch = async (input, init) => {
    upstreamUrl = String(input);
    const headers = init?.headers;
    const authorization = headers && typeof headers.get === "function"
      ? headers.get("authorization") ?? ""
      : headers?.authorization ?? "";
    upstreamKey = authorization.replace(/^Bearer /, "");
    upstreamBody = typeof init?.body === "string" ? init.body : "";
    return Response.json({
      choices: [{ message: { content: "The door is on your left." } }],
    });
  };

  const answered = await worker.fetch(
    guideRequest(env.DEMO_SECRET, { text: asked, simpler: true, previous: "It is ahead." }),
    env,
  );
  assert.equal(answered.status, 200);
  assert.equal(upstreamUrl, "https://api.x.ai/v1/chat/completions");
  assert.equal(upstreamBody.includes(GUIDE_MODEL), true);
  assert.equal(upstreamKey, env.XAI_API_KEY);
  assert.equal(upstreamBody.includes(asked), true);
  assert.equal(upstreamBody.includes("shorter words"), true);
  assert.equal(upstreamBody.includes("It is ahead."), true);
  const answer = await answered.json();
  assert.equal(answer.text, "The door is on your left.");
  assert.equal(JSON.stringify(answer).includes(env.XAI_API_KEY), false);

  console.log("guide route ok");
} finally {
  globalThis.fetch = originalFetch;
}
