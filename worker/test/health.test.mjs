import assert from "node:assert/strict";
import worker from "../src/index.ts";

const env = {
  ELEVENLABS_API_KEY: "eleven-secret-value",
  GEMINI_API_KEY: "gemini-secret-value",
  DEMO_SECRET: "demo-secret-value",
};

const health = await worker.fetch(new Request("https://comfety.test/health"), env);
assert.equal(health.status, 200);
assert.match(health.headers.get("content-type") ?? "", /application\/json/);
const raw = await health.text();
for (const secret of Object.values(env)) {
  assert.equal(raw.includes(secret), false, "health must not echo a secret");
}
assert.deepEqual(JSON.parse(raw), {
  ok: true,
  env: ["ELEVENLABS_API_KEY", "GEMINI_API_KEY", "DEMO_SECRET"],
});

const missing = await worker.fetch(new Request("https://comfety.test/v1/missing"), env);
assert.equal(missing.status, 404);

const posted = await worker.fetch(
  new Request("https://comfety.test/health", { method: "POST" }),
  env,
);
assert.equal(posted.status, 404);

console.log("health route ok");
