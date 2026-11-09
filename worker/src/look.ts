import { demoGate, json } from "./scribe-token.ts";
import { GUIDE_MODEL } from "./guide.ts";

export const DOSAGE_LINE = "I can read the words. I cannot tell you how much to take.";

type SecretEnv = {
  ELEVENLABS_API_KEY: string;
  XAI_API_KEY: string;
  DEMO_SECRET: string;
};

type LookMode = "describe" | "read";

export function buildLookPrompt(mode: LookMode): string {
  if (mode === "read") {
    return [
      "Read the words you can see in this photo.",
      "Keep Urdu in Urdu and English in English.",
      'If a word is blurry, say "I can\'t read that word."',
      `If this is a medicine label, end with exactly: ${DOSAGE_LINE}`,
      "If it is not a medicine label, do not add that sentence.",
      "No diagnosis. Do not say how much to take. Do not say the path is safe.",
    ].join("\n");
  }
  return [
    "You are Comfety, guiding a person who cannot see.",
    "Describe this photo in a few short sentences of plain words.",
    "Mention any Urdu or English words you can actually read.",
    'If a word is blurry, say "I can\'t read that word."',
    "No medical advice. Do not say how much to take. Do not say the path is safe. Do not give distances.",
  ].join("\n");
}

export function finishReading(answer: string): string {
  const text = answer.trim();
  const label = /\bmg\b|tablet|capsule|\bdose\b|دوا|گولی/i.test(text);
  if (!label || text.includes(DOSAGE_LINE)) {
    return text;
  }
  return `${text} ${DOSAGE_LINE}`;
}

function jpegBase64(value: string): string {
  const comma = value.indexOf(",");
  const raw = value.startsWith("data:") && comma !== -1 ? value.slice(comma + 1) : value;
  return raw.replace(/\s/g, "");
}

function messageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("")
    .trim();
}

export async function lookResponse(request: Request, env: SecretEnv): Promise<Response> {
  const gated = demoGate(request, env);
  if (gated) {
    return gated;
  }
  if (!env.XAI_API_KEY) {
    return json(
      { error: "XAI_API_KEY is not set. Put it in .env.local and run npm run listen." },
      500,
    );
  }

  let mode: LookMode = "describe";
  let image = "";
  try {
    const body = (await request.json()) as { mode?: unknown; image?: unknown };
    if (body.mode === "read") {
      mode = "read";
    } else if (body.mode !== "describe") {
      return json({ error: "Choose a look." }, 400);
    }
    if (typeof body.image === "string") {
      image = jpegBase64(body.image);
    }
  } catch {
    return json({ error: "Take a photo." }, 400);
  }
  if (image.length < 32 || image.length > 2_000_000) {
    return json({ error: "Take a photo." }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: GUIDE_MODEL,
        reasoning_effort: "none",
        temperature: 0.2,
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${image}` },
              },
              { type: "text", text: buildLookPrompt(mode) },
            ],
          },
        ],
      }),
    });
  } catch {
    return json({ error: "I need the network to read this." }, 502);
  }
  if (!upstream.ok) {
    return json({ error: "I need the network to read this." }, 502);
  }

  let answer = "";
  try {
    const payload = (await upstream.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    answer = messageText(payload.choices?.[0]?.message?.content);
  } catch {
    answer = "";
  }
  if (!answer) {
    return json({ error: "I need the network to read this." }, 502);
  }
  if (mode === "read") {
    answer = finishReading(answer);
  }
  return json({ text: answer }, 200);
}
