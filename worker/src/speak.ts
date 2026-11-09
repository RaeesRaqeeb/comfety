import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { demoGate, json } from "./scribe-token.ts";

export const SPEAK_MODEL = "eleven_v4_turbo";
// Bella, a premade voice. The old default library voice is rejected on a free key.
export const SPEAK_VOICE_ID = "hpp4J3VqNfWAUOO0d1Us";

type SecretEnv = {
  ELEVENLABS_API_KEY: string;
  DEMO_SECRET: string;
};

const AUDIO_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "x-comfety-demo, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "audio/mpeg",
  "cache-control": "no-store",
};

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function speakResponse(request: Request, env: SecretEnv): Promise<Response> {
  const gated = demoGate(request, env);
  if (gated) {
    return gated;
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    if (typeof body.text === "string") {
      text = body.text;
    }
  } catch {
    return json({ error: "Type a reply." }, 400);
  }
  if (!text) {
    return json({ error: "Type a reply." }, 400);
  }

  try {
    const audio = await new ElevenLabsClient({
      apiKey: env.ELEVENLABS_API_KEY,
    }).textToSpeech.convert(SPEAK_VOICE_ID, {
      text,
      modelId: SPEAK_MODEL,
      outputFormat: "mp3_44100_128",
    });
    const bytes = await readStream(audio);
    if (bytes.byteLength === 0) {
      return json({ error: "Speak request failed." }, 502);
    }
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return new Response(copy, { status: 200, headers: AUDIO_HEADERS });
  } catch {
    return json({ error: "Speak request failed." }, 502);
  }
}
