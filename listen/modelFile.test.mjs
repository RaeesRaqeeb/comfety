import assert from "node:assert/strict";
import { readableModelFile } from "./modelFile.ts";

const cache = "file:///data/user/0/app.comfety/cache/ExponentAsset-abc.tflite";

assert.equal(readableModelFile(cache), cache);
assert.equal(
  readableModelFile("http://10.0.2.2:8081/assets/models/yolo11n-int8.tflite?platform=android&hash=abc"),
  "http://10.0.2.2:8081/assets/models/yolo11n-int8.tflite?platform=android&hash=abc",
);
assert.equal(readableModelFile("https://example.com/yolo11n-int8.tflite"), "https://example.com/yolo11n-int8.tflite");
assert.equal(readableModelFile("models_yolo11nint8"), null);
assert.equal(readableModelFile("asset:/models_yolo11nint8.tflite"), null);
assert.equal(readableModelFile("file:///android_asset/raw/models_yolo11nint8.tflite"), null);
assert.equal(readableModelFile("file:///android_res/raw/models_yolo11nint8.tflite"), null);
assert.equal(readableModelFile(null), null);
assert.equal(readableModelFile(undefined), null);
assert.equal(readableModelFile(""), null);

console.log("model file ok");
