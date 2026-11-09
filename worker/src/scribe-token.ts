const TOKEN_URL = "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe";

type SecretEnv = {
  ELEVENLABS_API_KEY: string;
  DEMO_SECRET: string;
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "x-comfety-demo, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: CORS });
}

function sameSecret(given: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(given);
  const right = encoder.encode(expected);
  const length = Math.max(left.length, right.length);
  let difference = left.length === right.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function scribeTokenResponse(request: Request, env: SecretEnv): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return new Response("Not found", { status: 404 });
  }
  if (!env.DEMO_SECRET) {
    return json(
      { error: "DEMO_SECRET is not set. Put it in worker/.dev.vars." },
      500,
    );
  }
  if (!env.ELEVENLABS_API_KEY) {
    return json(
      {
        error:
          "ELEVENLABS_API_KEY is not set. Put it in worker/.dev.vars.",
      },
      500,
    );
  }
  const given = request.headers.get("x-comfety-demo") ?? "";
  if (!sameSecret(given, env.DEMO_SECRET)) {
    return json({ error: "The demo secret does not match." }, 401);
  }

  let upstream: Response;
  try {
    upstream = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
    });
  } catch {
    return json({ error: "No network." }, 502);
  }
  if (!upstream.ok) {
    return json({ error: "Scribe token request failed." }, 502);
  }

  let token = "";
  try {
    const body = (await upstream.json()) as { token?: unknown };
    if (typeof body.token === "string") {
      token = body.token;
    }
  } catch {
    token = "";
  }
  if (!token) {
    return json({ error: "Scribe token request failed." }, 502);
  }
  return json({ token }, 200);
}
