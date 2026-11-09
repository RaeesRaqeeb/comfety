import assert from "node:assert/strict";
import worker from "../src/index.ts";
import { DOSAGE_LINE } from "../src/look.ts";

const env = {
  ELEVENLABS_API_KEY: "eleven-secret-value",
  XAI_API_KEY: "xai-secret-value",
  DEMO_SECRET: "demo-secret-value",
};

const originalFetch = globalThis.fetch;
const image = "a".repeat(40);

function lookRequest(secret, body) {
  return new Request("https://comfety.test/v1/look", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-comfety-demo": secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

try {
  const missing = await worker.fetch(lookRequest(env.DEMO_SECRET, { mode: "describe", image }), {
    ...env,
    XAI_API_KEY: "",
  });
  assert.equal(missing.status, 500);
  assert.match(await missing.text(), /XAI_API_KEY is not set/);

  const empty = await worker.fetch(lookRequest(env.DEMO_SECRET, { mode: "describe", image: "" }), env);
  assert.equal(empty.status, 400);

  let upstreamBody = "";
  let upstreamKey = "";
  globalThis.fetch = async (_input, init) => {
    const headers = init?.headers;
    upstreamKey = headers && typeof headers.get === "function"
      ? (headers.get("authorization") ?? "").replace(/^Bearer /, "")
      : (headers?.authorization ?? "").replace(/^Bearer /, "");
    upstreamBody = typeof init?.body === "string" ? init.body : "";
    return Response.json({
      choices: [{ message: { content: "One tablet is visible." } }],
    });
  };

  const read = await worker.fetch(lookRequest(env.DEMO_SECRET, { mode: "read", image }), env);
  assert.equal(read.status, 200);
  const readBody = await read.json();
  assert.equal(readBody.text.includes("One tablet is visible."), true);
  assert.equal(readBody.text.endsWith(DOSAGE_LINE), true);
  assert.equal(upstreamBody.includes(image), true);
  assert.equal(upstreamBody.includes("medicine label"), true);
  assert.equal(upstreamKey, env.XAI_API_KEY);
  assert.equal(JSON.stringify(readBody).includes(image), false);
  assert.equal(JSON.stringify(readBody).includes(env.XAI_API_KEY), false);

  globalThis.fetch = async () =>
    Response.json({
      choices: [{ message: { content: "A white cup is on the table." } }],
    });
  const described = await worker.fetch(
    lookRequest(env.DEMO_SECRET, { mode: "describe", image }),
    env,
  );
  const describedBody = await described.json();
  assert.equal(describedBody.text, "A white cup is on the table.");
  assert.equal(describedBody.text.includes(DOSAGE_LINE), false);

  console.log("look route ok");
} finally {
  globalThis.fetch = originalFetch;
}
