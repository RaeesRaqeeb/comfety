export interface Env {
  ELEVENLABS_API_KEY: string;
  GEMINI_API_KEY: string;
  DEMO_SECRET: string;
}

const ENV_NAMES = [
  "ELEVENLABS_API_KEY",
  "GEMINI_API_KEY",
  "DEMO_SECRET",
] as const satisfies readonly (keyof Env)[];

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, env: ENV_NAMES });
    }
    return new Response("Not found", { status: 404 });
  },
};
