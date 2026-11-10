type SecretEnv = {
  ELEVENLABS_API_KEY: string;
  DEMO_SECRET: string;
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "x-comfety-demo, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function json(body: unknown, status: number): Response {
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

export function demoGate(request: Request, env: SecretEnv): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return new Response("Not found", { status: 404 });
  }
  if (!env.DEMO_SECRET) {
    return json(
      { error: "DEMO_SECRET is not set. Put it in .env.local." },
      500,
    );
  }
  if (!env.ELEVENLABS_API_KEY) {
    return json(
      {
        error:
          "ELEVENLABS_API_KEY is not set. Put it in .env.local and run npm run listen.",
      },
      500,
    );
  }
  const given = request.headers.get("x-comfety-demo") ?? "";
  if (!sameSecret(given, env.DEMO_SECRET)) {
    return json({ error: "The demo secret does not match." }, 401);
  }
  return null;
}

export async function scribeTokenResponse(request: Request, env: SecretEnv): Promise<Response> {
  const gated = demoGate(request, env);
  if (gated) {
    return gated;
  }

  try {
    const upstream = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
      },
    );
    if (!upstream.ok) {
      return json({ error: "Scribe token request failed." }, 502);
    }
    const body = (await upstream.json()) as { token?: unknown };
    if (typeof body.token !== "string" || !body.token) {
      return json({ error: "Scribe token request failed." }, 502);
    }
    return json({ token: body.token }, 200);
  } catch {
    return json({ error: "Scribe token request failed." }, 502);
  }
}
