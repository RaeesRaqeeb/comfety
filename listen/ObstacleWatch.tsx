import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { Asset } from "expo-asset";
import { loadTensorflowModel, type TensorflowModel } from "react-native-fast-tflite";
import { Camera, useCameraPermission, useFrameOutput } from "react-native-vision-camera";
import type { Frame } from "react-native-vision-camera";
import { useResizer } from "react-native-vision-camera-resizer";
import { runOnJS } from "react-native-worklets";
import { readableModelFile } from "./modelFile";
import { createWatcher, nextWarning, type Box } from "./warning";
import { boxesFromYolo, MODEL_INPUT, stretchRgb, type RgbOrder } from "./yolo";

const WATCHER_MODEL = require("../assets/models/yolo11n-int8.tflite");

function useWatcherModel(): { model: TensorflowModel | undefined; state: "loading" | "loaded" | "error" } {
  const [model, setModel] = useState<TensorflowModel | undefined>(undefined);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [asset] = await Asset.loadAsync(WATCHER_MODEL);
        const url = readableModelFile(asset.localUri) ?? readableModelFile(asset.uri);
        if (url == null) {
          throw new Error("Watcher model file is not readable.");
        }
        const loaded = await loadTensorflowModel({ url }, []);
        if (!cancelled) {
          setModel(loaded);
          setState("loaded");
        }
      } catch {
        if (!cancelled) {
          setState("error");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { model, state };
}

export const WATCH_START = "Watching. I can miss things. This is not a cane.";

export type ObstacleWatchProps = {
  onWarning: (phrase: string) => void;
  onReady: (phrase: string) => void;
  onCameraDenied: () => void;
  onModelError: () => void;
};

function rgbFromFrame(frame: Frame): ArrayBuffer | null {
  "worklet";
  if (frame.isPlanar || !frame.hasPixelBuffer) {
    return null;
  }
  const width = Math.trunc(frame.width);
  const height = Math.trunc(frame.height);
  const bytesPerRow = Math.trunc(frame.bytesPerRow);
  if (width < 1 || height < 1) {
    return null;
  }
  let channels = 0;
  let order: RgbOrder = "rgb";
  const pixelFormat = frame.pixelFormat;
  if (pixelFormat === "rgb-bgra-8-bit") {
    channels = 4;
    order = "bgra";
  } else if (pixelFormat === "rgb-rgba-8-bit") {
    channels = 4;
    order = "rgba";
  } else if (pixelFormat === "rgb-rgb-8-bit") {
    channels = bytesPerRow >= width * 4 ? 4 : 3;
    order = "rgb";
  } else {
    return null;
  }
  if (bytesPerRow < width * channels) {
    return null;
  }
  const pixels = new Uint8Array(frame.getPixelBuffer());
  const last = (height - 1) * bytesPerRow + (width - 1) * channels + 2;
  if (pixels.length <= last) {
    return null;
  }
  return stretchRgb(pixels, width, height, bytesPerRow, channels, order).buffer as ArrayBuffer;
}

export function ObstacleWatch({ onWarning, onReady, onCameraDenied, onModelError }: ObstacleWatchProps) {
  const permission = useCameraPermission();
  const model = useWatcherModel();
  const resizerState = useResizer({
    width: MODEL_INPUT,
    height: MODEL_INPUT,
    channelOrder: "rgb",
    dataType: "uint8",
    scaleMode: "stretch",
    pixelLayout: "interleaved",
  });
  const cpuFallback = resizerState.state === "error";
  const framesReady = resizerState.state === "ready" || cpuFallback;
  const watcher = useRef(createWatcher());
  const pace = useRef({ at: 0 }).current;
  const asked = useRef(false);
  const announced = useRef(false);
  const mounted = useRef(true);
  const warnRef = useRef(onWarning);
  const readyRef = useRef(onReady);
  const deniedRef = useRef(onCameraDenied);
  const modelErrorRef = useRef(onModelError);
  warnRef.current = onWarning;
  readyRef.current = onReady;
  deniedRef.current = onCameraDenied;
  modelErrorRef.current = onModelError;

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
      if (current == null || (resizer == null && !cpuFallback)) {
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
        let input: ArrayBuffer | null = null;
        if (resizer != null) {
          const resized = resizer.resize(frame);
          try {
            input = resized.getPixelBuffer();
          } finally {
            resized.dispose();
          }
        } else {
          input = rgbFromFrame(frame);
        }
        if (input == null) {
          return;
        }
        const outputs = current.runSync([input]);
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
      } catch {
        return;
      } finally {
        frame.dispose();
      }
    },
    [accept, cpuFallback, model.model, pace, resizerState.resizer],
  );

  const frameOutput = useFrameOutput({
    targetResolution: { width: MODEL_INPUT, height: MODEL_INPUT },
    pixelFormat: "rgb",
    dropFramesWhileBusy: true,
    onFrame,
  });

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (permission.hasPermission || asked.current) {
      return;
    }
    asked.current = true;
    void permission.requestPermission().then((ok) => {
      if (!ok && mounted.current) {
        deniedRef.current();
      }
    });
  }, [permission]);

  useEffect(() => {
    if (model.state === "error") {
      modelErrorRef.current();
    }
  }, [model.state]);

  useEffect(() => {
    if (model.state !== "loaded" || !framesReady || !permission.hasPermission || announced.current) {
      return;
    }
    announced.current = true;
    readyRef.current(WATCH_START);
  }, [framesReady, model.state, permission.hasPermission]);

  if (!permission.hasPermission) {
    return null;
  }

  return (
    <Camera
      style={styles.preview}
      isActive={model.state === "loaded" && framesReady}
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
