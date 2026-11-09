import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from "expo-audio";
import type { AudioStreamBuffer } from "expo-audio";
import { AudioFormat, CommitStrategy, RealtimeEvents, Scribe } from "@elevenlabs/client";
import type { RealtimeConnection } from "@elevenlabs/client";
import {
  applyScribeMessage,
  encodeBase64,
  monoPcm16,
  resamplePcm16,
  scribeSession,
  transcriptLine,
  type Transcript,
} from "./scribe";

const EMPTY: Transcript = { committed: [], partial: "" };

const KEY_HINT =
  "ELEVENLABS_API_KEY is not set. It belongs in .env.local on this machine. Then run npm run listen.";
const SECRET_HINT =
  "DEMO_SECRET is not set. Add it to .env.local and set the same value as EXPO_PUBLIC_DEMO_SECRET in .env, then restart npm start and run npm run listen.";

function workerBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_WORKER_URL?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    "";
  const host = hostUri.split(":")[0];
  if (!host) {
    return null;
  }
  return `http://${host}:8791`;
}

export function ListenPanel() {
  const [transcript, setTranscript] = useState<Transcript>(EMPTY);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("The microphone is off.");
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const listeningRef = useRef(false);

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

  function stop() {
    listeningRef.current = false;
    setListening(false);
    const connection = connectionRef.current;
    connectionRef.current = null;
    connection?.close();
    stream?.stop?.();
    setNotice("Paused");
  }

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      connectionRef.current?.close();
      stream?.stop?.();
    };
  }, [stream]);

  async function start() {
    setNotice("The microphone hears the other person, or your question.");
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
    if (!secret) {
      setNotice(SECRET_HINT);
      return;
    }
    if (!base) {
      setNotice("The worker address is missing. Start Expo on this machine, then reopen the app.");
      return;
    }

    let response: Response;
    try {
      response = await fetch(`${base}/v1/scribe-token`, {
        method: "POST",
        headers: { "x-comfety-demo": secret },
      });
    } catch {
      setNotice("No network.");
      return;
    }
    const body = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;
    if (!response.ok || !body?.token) {
      setNotice(body?.error?.includes("ELEVENLABS_API_KEY") ? KEY_HINT : body?.error || "No network.");
      return;
    }

    const session = scribeSession(body.token);
    const connection = Scribe.connect({
      ...session,
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
    connection.on(RealtimeEvents.ERROR, () => {
      setNotice("Listening failed.");
    });
    connection.on(RealtimeEvents.CLOSE, () => {
      if (listeningRef.current) {
        listeningRef.current = false;
        setListening(false);
        setNotice("Paused");
      }
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
    } catch {
      connection.close();
      connectionRef.current = null;
      setNotice("No network.");
      return;
    }
    try {
      await stream.start();
    } catch {
      connection.close();
      connectionRef.current = null;
      setNotice("The microphone stays off.");
      return;
    }
    listeningRef.current = true;
    setListening(true);
    setNotice("Listening");
  }

  const line = transcriptLine(transcript);

  return (
    <View style={styles.panel} testID="listen-panel">
      <Text style={styles.body}>The microphone hears the other person, or your question.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop listening" : "Listen"}
        accessibilityState={{ selected: listening }}
        onPress={() => {
          if (listeningRef.current) {
            stop();
          } else {
            void start();
          }
        }}
        testID="listen-button"
        style={({ pressed }) => [
          styles.listen,
          listening ? styles.listenOn : styles.listenOff,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.listenTitle, listening && styles.ink]}>{listening ? "Stop" : "Listen"}</Text>
      </Pressable>
      <Text style={styles.body}>Hold the phone toward them.</Text>
      <Text accessibilityLiveRegion="polite" style={styles.body} testID="listen-status">
        {notice}
      </Text>
      <Text style={styles.transcript} testID="transcript">
        {line || "The transcript appears here."}
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
  listen: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  listenOff: {
    backgroundColor: "#000000",
    borderColor: "#ffffff",
  },
  listenOn: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  listenTitle: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
  },
  body: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
  },
  transcript: {
    flexShrink: 1,
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
