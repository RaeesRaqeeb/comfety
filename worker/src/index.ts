import { guideResponse } from "./guide.ts";
import { scribeTokenResponse } from "./scribe-token.ts";
import { speakResponse } from "./speak.ts";

export interface Env {
  ELEVENLABS_API_KEY: string;
  XAI_API_KEY: string;
  DEMO_SECRET: string;
}

const ENV_NAMES = [
  "ELEVENLABS_API_KEY",
  "XAI_API_KEY",
  "DEMO_SECRET",
] as const satisfies readonly (keyof Env)[];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, env: ENV_NAMES });
    }
    if (url.pathname === "/v1/scribe-token") {
      return scribeTokenResponse(request, env);
    }
    if (url.pathname === "/v1/speak") {
      return speakResponse(request, env);
    }
    if (url.pathname === "/v1/guide") {
      return guideResponse(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};
