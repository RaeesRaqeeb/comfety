export const SCRIBE_SAMPLE_RATE = 16000;

export type Transcript = {
  committed: string[];
  partial: string;
};

export function scribeSession(token: string) {
  return {
    token,
    modelId: "scribe_v2_realtime",
    languageCode: "ur",
    secondaryLanguages: ["en"],
    filterBackgroundAudio: true,
    commitStrategy: "vad" as const,
    audioFormat: "pcm_16000" as const,
    sampleRate: 16000,
  };
}

export function applyScribeMessage(state: Transcript, message: unknown): Transcript {
  if (!message || typeof message !== "object") {
    return state;
  }
  const row = message as { message_type?: unknown; text?: unknown };
  if (row.message_type === "partial_transcript" && typeof row.text === "string") {
    return { committed: state.committed, partial: row.text };
  }
  if (
    (row.message_type === "committed_transcript" ||
      row.message_type === "committed_transcript_with_timestamps") &&
    typeof row.text === "string"
  ) {
    const text = row.text.trim();
    return {
      committed: text ? [...state.committed, text] : state.committed,
      partial: "",
    };
  }
  return state;
}

export function transcriptLine(state: Transcript): string {
  const locked = state.committed.join("\n");
  if (!state.partial) {
    return locked;
  }
  return locked ? `${locked}\n${state.partial}` : state.partial;
}

export function monoPcm16(
  data: ArrayBuffer,
  encoding: "int16" | "float32",
  channels: number,
): Int16Array {
  const samples =
    encoding === "int16" ? new Int16Array(data) : floatToInt16(new Float32Array(data));
  if (channels <= 1) {
    return samples;
  }
  const frames = Math.floor(samples.length / channels);
  const mono = new Int16Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      sum += samples[frame * channels + channel];
    }
    mono[frame] = clampInt16(Math.round(sum / channels));
  }
  return mono;
}

export function resamplePcm16(samples: Int16Array, fromRate: number, toRate = SCRIBE_SAMPLE_RATE): Int16Array {
  if (fromRate === toRate || samples.length === 0 || fromRate <= 0) {
    return samples;
  }
  const outLength = Math.floor((samples.length * toRate) / fromRate);
  const out = new Int16Array(outLength);
  for (let index = 0; index < outLength; index += 1) {
    const start = Math.floor((index * fromRate) / toRate);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor(((index + 1) * fromRate) / toRate)));
    let sum = 0;
    let count = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      sum += samples[cursor];
      count += 1;
    }
    out[index] = count ? clampInt16(Math.round(sum / count)) : 0;
  }
  return out;
}

export function encodeBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triple = (first << 16) | (second << 8) | third;
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += index + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : "=";
    out += index + 2 < bytes.length ? alphabet[triple & 63] : "=";
  }
  return out;
}

export function audioChunkMessage(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return JSON.stringify({
    message_type: "input_audio_chunk",
    audio_base_64: encodeBase64(bytes),
    commit: false,
    sample_rate: SCRIBE_SAMPLE_RATE,
  });
}

function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    out[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return out;
}

function clampInt16(value: number): number {
  return Math.max(-32768, Math.min(32767, value));
}
