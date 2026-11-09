import { useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { useTensorflowModel } from "react-native-fast-tflite";
import { Camera, useCameraPermission, useFrameOutput } from "react-native-vision-camera";
import type { Frame } from "react-native-vision-camera";
import { useResizer } from "react-native-vision-camera-resizer";
import { runOnJS } from "react-native-worklets";
import { createWatcher, nextWarning, type Box } from "./warning";
import { boxesFromYolo, MODEL_INPUT } from "./yolo";

export const WATCH_START = "Watching. I can miss things. This is not a cane.";

export type ObstacleWatchProps = {
  onWarning: (phrase: string) => void;
  onReady: (phrase: string) => void;
  onUnavailable: () => void;
};

export function ObstacleWatch({ onWarning, onReady, onUnavailable }: ObstacleWatchProps) {
  const permission = useCameraPermission();
  const model = useTensorflowModel(require("../assets/models/yolo11n-int8.tflite"), []);
  const resizerState = useResizer({
    width: MODEL_INPUT,
    height: MODEL_INPUT,
    channelOrder: "rgb",
    dataType: "uint8",
    scaleMode: "stretch",
    pixelLayout: "interleaved",
  });
  const watcher = useRef(createWatcher());
  const pace = useRef({ at: 0 }).current;
  const asked = useRef(false);
  const announced = useRef(false);
  const warnRef = useRef(onWarning);
  const readyRef = useRef(onReady);
  const unavailableRef = useRef(onUnavailable);
  warnRef.current = onWarning;
  readyRef.current = onReady;
  unavailableRef.current = onUnavailable;

  const accept = useCallback((boxes: Box[]) => {
    const step = nextWarning(watcher.current, boxes, Date.now());
    watcher.current = step.state;
    if (step.speak) {
      warnRef.current(step.speak);
    }
  }, []);

  const onFrame = useCallback(
    (frame: Frame) => {
      "worklet";
      const current = model.model;
      const resizer = resizerState.resizer;
      if (current == null || resizer == null) {
        frame.dispose();
        return;
      }
      const now = Date.now();
      if (now - pace.at < 200) {
        frame.dispose();
        return;
      }
      pace.at = now;
      try {
        const resized = resizer.resize(frame);
        try {
          const buffer = resized.getPixelBuffer();
          const outputs = current.runSync([buffer]);
          let boxesBuf = outputs[0];
          let scoresBuf = outputs[1];
          if (boxesBuf != null && scoresBuf != null) {
            if (boxesBuf.byteLength > scoresBuf.byteLength) {
              const swap = boxesBuf;
              boxesBuf = scoresBuf;
              scoresBuf = swap;
            }
            runOnJS(accept)(boxesFromYolo(new Int8Array(boxesBuf), new Int8Array(scoresBuf)));
          }
        } finally {
          resized.dispose();
        }
      } catch {
        return;
      } finally {
        frame.dispose();
      }
    },
    [accept, model.model, pace, resizerState.resizer],
  );

  const frameOutput = useFrameOutput({
    targetResolution: { width: MODEL_INPUT, height: MODEL_INPUT },
    pixelFormat: "rgb",
    dropFramesWhileBusy: true,
    onFrame,
  });

  useEffect(() => {
    if (permission.hasPermission || asked.current) {
      return;
    }
    asked.current = true;
    void permission.requestPermission().then((ok) => {
      if (!ok) {
        unavailableRef.current();
      }
    });
  }, [permission]);

  useEffect(() => {
    if (model.state === "error" || resizerState.state === "error") {
      unavailableRef.current();
    }
  }, [model.state, resizerState.state]);

  useEffect(() => {
    if (model.state !== "loaded" || resizerState.state !== "ready" || !permission.hasPermission || announced.current) {
      return;
    }
    announced.current = true;
    readyRef.current(WATCH_START);
  }, [model.state, permission.hasPermission, resizerState.state]);

  if (!permission.hasPermission) {
    return null;
  }

  return (
    <Camera
      style={styles.preview}
      isActive={model.state === "loaded" && resizerState.state === "ready"}
      device="back"
      outputs={[frameOutput]}
    />
  );
}

const styles = StyleSheet.create({
  preview: {
    flex: 1,
    width: "100%",
  },
});
