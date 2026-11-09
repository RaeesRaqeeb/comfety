import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioStream,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
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
import { readVoice, saveVoice, VOICES, type VoiceId } from "./voices";

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
  const [speaking, setSpeaking] = useState(false);
  const [reply, setReply] = useState("");
  const [voice, setVoice] = useState<VoiceId>("warm-woman");
  const [notice, setNotice] = useState("The microphone is off.");
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const speakGeneration = useRef(0);
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

  function stop() {
    speakGeneration.current += 1;
    stopRecognizer();
    speakingRef.current = false;
    setSpeaking(false);
    player.pause();
    setNotice("Paused");
  }

  useEffect(() => {
    let active = true;
    void readVoice().then((saved) => {
      if (active) {
        setVoice(saved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish || !speakingRef.current) {
        return;
      }
      speakingRef.current = false;
      setSpeaking(false);
      setNotice("Paused");
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      speakingRef.current = false;
      connectionRef.current?.close();
      stream?.stop?.();
      player.pause();
    };
  }, [player, stream]);

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
      if (listeningRef.current) {
        setNotice("Listening failed.");
      }
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
    if (speakingRef.current) {
      connection.close();
      if (connectionRef.current === connection) {
        connectionRef.current = null;
      }
      stream?.stop?.();
      return;
    }
    listeningRef.current = true;
    setListening(true);
    setNotice("Listening");
  }

  async function speak() {
    const text = reply;
    if (!text || speakingRef.current) {
      if (!text) {
        setNotice("Type a reply.");
      }
      return;
    }
    stopRecognizer();
    const generation = speakGeneration.current + 1;
    speakGeneration.current = generation;
    speakingRef.current = true;
    setSpeaking(true);
    setNotice("Speaking");

    const secret = process.env.EXPO_PUBLIC_DEMO_SECRET ?? "";
    const base = workerBaseUrl();
    if (!secret) {
      speakingRef.current = false;
      setSpeaking(false);
      setNotice(SECRET_HINT);
      return;
    }
    if (!base) {
      speakingRef.current = false;
      setSpeaking(false);
      setNotice("The worker address is missing. Start Expo on this machine, then reopen the app.");
      return;
    }

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
      if (speakGeneration.current !== generation) {
        return;
      }
      speakingRef.current = false;
      setSpeaking(false);
      setNotice("No network.");
      return;
    }
    if (speakGeneration.current !== generation) {
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      speakingRef.current = false;
      setSpeaking(false);
      setNotice(body?.error?.includes("ELEVENLABS_API_KEY") ? KEY_HINT : body?.error || "No network.");
      return;
    }

    try {
      const bytes = new Uint8Array(await response.arrayBuffer());
      const file = new File(Paths.cache, "comfety-reply.mp3");
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
      if (speakGeneration.current !== generation) {
        return;
      }
      player.replace({ uri: file.uri });
      player.play();
    } catch {
      speakingRef.current = false;
      setSpeaking(false);
      setNotice("Speaking failed.");
    }
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
          if (speakingRef.current) {
            stop();
            return;
          }
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
      <View style={styles.voiceGrid} testID="voice-choices">
        {VOICES.map((choice) => {
          const selected = voice === choice.id;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityLabel={choice.label}
              accessibilityState={{ selected }}
              onPress={() => {
                setVoice(choice.id);
                void saveVoice(choice.id);
              }}
              testID={`voice-${choice.id}`}
              style={({ pressed }) => [
                styles.voice,
                selected ? styles.listenOn : styles.listenOff,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.voiceLabel, selected && styles.ink]}>{choice.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.replyRow}>
        <TextInput
          accessibilityLabel="Reply"
          onChangeText={setReply}
          placeholder="Type a reply"
          placeholderTextColor="#a3a3a3"
          style={styles.reply}
          testID="reply-input"
          value={reply}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Speak"
          accessibilityState={{ disabled: speaking }}
          disabled={speaking}
          onPress={() => {
            void speak();
          }}
          testID="speak-button"
          style={({ pressed }) => [styles.speak, pressed && !speaking && styles.pressed]}
        >
          <Text style={styles.speakTitle}>Speak</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 4,
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
  voiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    flexGrow: 0,
    flexShrink: 0,
    gap: 4,
  },
  voice: {
    flexBasis: "47%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    borderWidth: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  voiceLabel: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  replyRow: {
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 0,
    alignItems: "center",
    gap: 8,
  },
  reply: {
    flex: 1,
    minHeight: 44,
    borderWidth: 2,
    borderColor: "#ffffff",
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  speak: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderWidth: 2,
    borderColor: "#ffffff",
    paddingHorizontal: 12,
  },
  speakTitle: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
  },
  ink: {
    color: "#000000",
  },
  pressed: {
    opacity: 0.72,
  },
});
