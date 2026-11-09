import assert from "node:assert/strict";
import worker from "../src/index.ts";

const env = {
  ELEVENLABS_API_KEY: "eleven-secret-value",
  GEMINI_API_KEY: "gemini-secret-value",
  DEMO_SECRET: "demo-secret-value",
};

const originalFetch = globalThis.fetch;

function tokenRequest(secret) {
  return new Request("https://comfety.test/v1/scribe-token", {
    method: "POST",
    headers: secret ? { "x-comfety-demo": secret } : {},
  });
}

try {
  const missingSecret = await worker.fetch(tokenRequest(), {
    ...env,
    DEMO_SECRET: "",
  });
  assert.equal(missingSecret.status, 500);
  const missingSecretBody = await missingSecret.text();
  assert.match(missingSecretBody, /worker\/\.dev\.vars/);
  assert.equal(missingSecretBody.includes(env.ELEVENLABS_API_KEY), false);

  const missingKey = await worker.fetch(tokenRequest(env.DEMO_SECRET), {
    ...env,
    ELEVENLABS_API_KEY: "",
  });
  assert.equal(missingKey.status, 500);
  const missingKeyBody = await missingKey.text();
  assert.match(missingKeyBody, /ELEVENLABS_API_KEY is not set/);
  assert.match(missingKeyBody, /worker\/\.dev\.vars/);
  assert.equal(missingKeyBody.includes("eleven-secret-value"), false);

  const rejected = await worker.fetch(tokenRequest("wrong"), env);
  assert.equal(rejected.status, 401);

  let upstreamKey = "";
  let upstreamUrl = "";
  globalThis.fetch = async (input, init) => {
    upstreamUrl = String(input);
    upstreamKey = init?.headers?.["xi-api-key"] ?? "";
    return Response.json({ token: "sutkn_test" });
  };
  const minted = await worker.fetch(tokenRequest(env.DEMO_SECRET), env);
  assert.equal(minted.status, 200);
  assert.equal(upstreamUrl, "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe");
  assert.equal(upstreamKey, env.ELEVENLABS_API_KEY);
  const mintedBody = await minted.text();
  assert.equal(mintedBody.includes(env.ELEVENLABS_API_KEY), false);
  assert.deepEqual(JSON.parse(mintedBody), { token: "sutkn_test" });

  globalThis.fetch = async () => new Response("nope", { status: 403 });
  const failed = await worker.fetch(tokenRequest(env.DEMO_SECRET), env);
  assert.equal(failed.status, 502);
  const failedBody = await failed.text();
  assert.equal(failedBody.includes(env.ELEVENLABS_API_KEY), false);
  assert.match(failedBody, /Scribe token request failed/);

  console.log("scribe token route ok");
} finally {
  globalThis.fetch = originalFetch;
}
