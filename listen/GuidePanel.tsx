import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioStream,
} from "expo-audio";
import type { AudioStreamBuffer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { AudioFormat, CommitStrategy, RealtimeEvents, Scribe } from "@elevenlabs/client";
import type { RealtimeConnection } from "@elevenlabs/client";
import { wantsSimpler } from "./guideTurn";
import {
  applyScribeMessage,
  encodeBase64,
  monoPcm16,
  resamplePcm16,
  scribeSession,
  transcriptLine,
  type Transcript,
} from "./scribe";
import { readVoice } from "./voices";

const EMPTY: Transcript = { committed: [], partial: "" };
const NO_NETWORK = "I can't answer without the network.";
const KEY_HINT =
  "XAI_API_KEY is not set. Put it in .env.local on this machine, then run npm run listen.";

function workerBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_WORKER_URL?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? "";
  const host = hostUri.split(":")[0];
  return host ? `http://${host}:8791` : null;
}

function sayStatus(line: string) {
  try {
    Speech.stop();
    Speech.speak(line);
  } catch {
    return;
  }
}

export function GuidePanel() {
  const [transcript, setTranscript] = useState<Transcript>(EMPTY);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("The microphone is off.");
  const [answer, setAnswer] = useState("");
  const previousRef = useRef("");
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const listeningRef = useRef(false);
  const player = useAudioPlayer(null);
  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer) => sendBuffer(buffer),
  });

  function sendBuffer(buffer: AudioStreamBuffer) {
    const connection = connectionRef.current;
    if (!listeningRef.current || !connection) {
      return;
    }
    const mono = monoPcm16(buffer.data, "int16", buffer.channels || 1);
    const pcm = resamplePcm16(mono, buffer.sampleRate || 16000);
    if (pcm.length === 0) {
      return;
    }
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    connection.send({ audioBase64: encodeBase64(bytes), sampleRate: 16000 });
  }

  function stopRecognizer() {
    listeningRef.current = false;
    setListening(false);
    const connection = connectionRef.current;
    connectionRef.current = null;
    connection?.close();
    stream?.stop?.();
  }

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      connectionRef.current?.close();
      stream?.stop?.();
      player.pause();
      Speech.stop();
    };
  }, [player, stream]);

  async function playAnswer(text: string) {
    const secret = process.env.EXPO_PUBLIC_DEMO_SECRET ?? "";
    const base = workerBaseUrl();
    const voice = await readVoice();
    if (!secret || !base) {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    setNotice("Speaking");
    sayStatus("Speaking");
    let response: Response;
    try {
      response = await fetch(`${base}/v1/speak`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-comfety-demo": secret,
        },
        body: JSON.stringify({ text, voice }),
      });
    } catch {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    if (!response.ok) {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    try {
      Speech.stop();
      const bytes = new Uint8Array(await response.arrayBuffer());
      const file = new File(Paths.cache, "comfety-guide.mp3");
      if (file.exists) {
        file.delete();
      }
      file.create();
      await file.write(bytes);
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        allowsRecording: false,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      player.replace({ uri: file.uri });
      player.play();
    } catch {
      setNotice("Speaking failed.");
    }
  }

  async function ask(line: string) {
    const secret = process.env.EXPO_PUBLIC_DEMO_SECRET ?? "";
    const base = workerBaseUrl();
    if (!secret || !base) {
      setAnswer(NO_NETWORK);
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    let response: Response;
    try {
      response = await fetch(`${base}/v1/guide`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-comfety-demo": secret,
        },
        body: JSON.stringify({
          text: line,
          simpler: wantsSimpler(line),
          previous: previousRef.current,
        }),
      });
    } catch {
      setAnswer(NO_NETWORK);
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    const body = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
    if (!response.ok || !body?.text) {
      const message = body?.error?.includes("XAI_API_KEY") ? KEY_HINT : body?.error || NO_NETWORK;
      setAnswer(message);
      setNotice(message);
      if (message === NO_NETWORK) {
        sayStatus(NO_NETWORK);
      }
      return;
    }
    previousRef.current = body.text;
    setAnswer(body.text);
    await playAnswer(body.text);
  }

  async function start() {
    setNotice("The microphone hears your question.");
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNotice("The microphone stays off.");
      return;
    }
    if (!stream?.start) {
      setNotice("Open this screen in Expo Go on the phone. This browser preview has no microphone stream.");
      return;
    }
    const secret = process.env.EXPO_PUBLIC_DEMO_SECRET ?? "";
    const base = workerBaseUrl();
    if (!secret || !base) {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    let response: Response;
    try {
      response = await fetch(`${base}/v1/scribe-token`, {
        method: "POST",
        headers: { "x-comfety-demo": secret },
      });
    } catch {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    const body = (await response.json().catch(() => null)) as { token?: string } | null;
    if (!response.ok || !body?.token) {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    const connection = Scribe.connect({
      ...scribeSession(body.token),
      audioFormat: AudioFormat.PCM_16000,
      commitStrategy: CommitStrategy.VAD,
    });
    connectionRef.current = connection;
    connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
      setTranscript((current) => applyScribeMessage(current, data));
    });
    connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
      setTranscript((current) => applyScribeMessage(current, data));
    });
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        allowsRecording: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await new Promise<void>((resolve, reject) => {
        connection.on(RealtimeEvents.OPEN, () => resolve());
        connection.on(RealtimeEvents.ERROR, () => reject(new Error("socket")));
      });
      await stream.start();
    } catch {
      connection.close();
      connectionRef.current = null;
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    listeningRef.current = true;
    setListening(true);
    setTranscript(EMPTY);
    setNotice("Listening");
    sayStatus("Listening");
  }

  async function finish() {
    const line = transcriptLine(transcript).trim();
    stopRecognizer();
    if (!line) {
      setNotice("Say a question.");
      return;
    }
    await ask(line);
  }

  return (
    <View style={styles.panel} testID="guide-panel">
      <Text style={styles.body}>This is not a cane.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop" : "Talk"}
        onPress={() => {
          if (listeningRef.current) {
            void finish();
          } else {
            void start();
          }
        }}
        testID="guide-talk"
        style={({ pressed }) => [styles.talk, listening && styles.talkOn, pressed && styles.pressed]}
      >
        <Text style={[styles.talkTitle, listening && styles.ink]}>{listening ? "Stop" : "Talk"}</Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.status} testID="guide-status">
        {notice}
      </Text>
      <Text style={styles.answer} testID="guide-answer">
        {answer || transcriptLine(transcript) || "Ask a question."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  body: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
  },
  talk: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  talkOn: {
    backgroundColor: "#ffffff",
  },
  talkTitle: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600",
  },
  status: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 34,
  },
  answer: {
    flex: 1,
    minHeight: 0,
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 28,
  },
  ink: {
    color: "#000000",
  },
  pressed: {
    opacity: 0.72,
  },
});
