import { demoGate, json } from "./scribe-token.ts";

export const SPEAK_MODEL = "eleven_v4_turbo";

export const SPEAK_VOICES = {
  "warm-woman": "hpp4J3VqNfWAUOO0d1Us",
  "warm-man": "JBFqnCBsd6RMkjVDRZzb",
  "clear-woman": "Xb7hH8MSUJpSbSDYk0k2",
  "clear-man": "onwK4e9ZLuTAKqWW03F9",
} as const;

export type SpeakVoice = keyof typeof SPEAK_VOICES;

export const DEFAULT_SPEAK_VOICE: SpeakVoice = "warm-woman";

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

export async function speakResponse(request: Request, env: SecretEnv): Promise<Response> {
  const gated = demoGate(request, env);
  if (gated) {
    return gated;
  }

  let text = "";
  let voice: SpeakVoice = DEFAULT_SPEAK_VOICE;
  try {
    const body = (await request.json()) as { text?: unknown; voice?: unknown };
    if (typeof body.text === "string") {
      text = body.text;
    }
    if (body.voice !== undefined) {
      if (typeof body.voice !== "string" || !(body.voice in SPEAK_VOICES)) {
        return json({ error: "Choose a voice." }, 400);
      }
      voice = body.voice as SpeakVoice;
    }
  } catch {
    return json({ error: "Type a reply." }, 400);
  }
  if (!text) {
    return json({ error: "Type a reply." }, 400);
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${SPEAK_VOICES[voice]}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "xi-api-key": env.ELEVENLABS_API_KEY,
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: SPEAK_MODEL,
        }),
      },
    );
    if (!upstream.ok) {
      return json({ error: "Speak request failed." }, 502);
    }
    const bytes = new Uint8Array(await upstream.arrayBuffer());
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
