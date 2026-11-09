import { demoGate, json } from "./scribe-token.ts";

export const GUIDE_MODEL = "grok-4.3";

type SecretEnv = {
  ELEVENLABS_API_KEY: string;
  XAI_API_KEY: string;
  DEMO_SECRET: string;
};

export function buildGuidePrompt(input: {
  text: string;
  simpler: boolean;
  previous: string;
}): string {
  const lines = [
    "You are Comfety, guiding a person who cannot see.",
    "Answer in a few short sentences.",
    "Use the same language they used: Urdu, English, or a mix.",
    "No medical advice. Do not say the path is safe. Do not give distances.",
    "If they are lost, or they say what, again, simpler, or سمجھ نہیں آئی, use shorter words and one concrete example.",
  ];
  if (input.previous) {
    lines.push(`What you said last: ${input.previous}`);
  } else if (input.simpler) {
    lines.push("There is no earlier answer. Say that in one short sentence and ask them to ask a question.");
  }
  if (input.simpler) {
    lines.push("They are lost. Use shorter words and one concrete example.");
  }
  lines.push(`Their words: ${input.text}`);
  return lines.join("\n");
}

export async function guideResponse(request: Request, env: SecretEnv): Promise<Response> {
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

  let text = "";
  let simpler = false;
  let previous = "";
  try {
    const body = (await request.json()) as {
      text?: unknown;
      simpler?: unknown;
      previous?: unknown;
    };
    if (typeof body.text === "string") {
      text = body.text;
    }
    simpler = body.simpler === true;
    if (typeof body.previous === "string") {
      previous = body.previous;
    }
  } catch {
    return json({ error: "Say a question." }, 400);
  }
  if (!text) {
    return json({ error: "Say a question." }, 400);
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
        temperature: 0.4,
        max_tokens: 256,
        messages: [{ role: "user", content: buildGuidePrompt({ text, simpler, previous }) }],
      }),
    });
  } catch {
    return json({ error: "I can't answer without the network." }, 502);
  }
  if (!upstream.ok) {
    return json({ error: "I can't answer without the network." }, 502);
  }

  let answer = "";
  try {
    const payload = (await upstream.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      answer = content.trim();
    } else if (Array.isArray(content)) {
      answer = content
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
  } catch {
    answer = "";
  }
  if (!answer) {
    return json({ error: "I can't answer without the network." }, 502);
  }
  return json({ text: answer }, 200);
}
