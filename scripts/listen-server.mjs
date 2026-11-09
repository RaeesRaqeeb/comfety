import { createServer } from "node:http";
import worker from "../worker/src/index.ts";

const port = 8791;
const env = {
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? "",
  XAI_API_KEY: process.env.XAI_API_KEY ?? "",
  DEMO_SECRET: process.env.DEMO_SECRET ?? "",
};

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? body : undefined,
  });
  const response = await worker.fetch(request, env);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, "0.0.0.0");
