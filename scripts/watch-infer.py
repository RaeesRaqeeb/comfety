"""Run the watcher TFLite model on one photo.

The pixels are nearest-neighbor stretched to 640x640 uint8 RGB, the same
layout the phone feeds the model. Box decoding stays in scripts/watch-photo.mjs
so the printed gate is the app's boxesFromYolo.
"""

import sys
from pathlib import Path

import numpy as np
from ai_edge_litert.interpreter import Interpreter
from PIL import Image

SIZE = 640


def stretch_rgb(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    pixels = np.asarray(image)
    height, width = pixels.shape[:2]
    ys = np.minimum((np.arange(SIZE) * height) // SIZE, height - 1)
    xs = np.minimum((np.arange(SIZE) * width) // SIZE, width - 1)
    return np.ascontiguousarray(pixels[ys][:, xs], dtype=np.uint8)


def main() -> None:
    photo = Path(sys.argv[1])
    out = Path(sys.argv[2])
    model = Path(__file__).resolve().parents[1] / "assets" / "models" / "yolo11n-int8.tflite"
    interpreter = Interpreter(model_path=str(model))
    interpreter.allocate_tensors()
    details = interpreter.get_input_details()[0]
    tensor = stretch_rgb(photo)[None]
    if tuple(details["shape"]) != tuple(tensor.shape) or details["dtype"] != tensor.dtype:
        raise SystemExit(
            f"model input is {details['dtype']} {tuple(details['shape'])}, photo tensor is {tensor.dtype} {tensor.shape}"
        )
    interpreter.set_tensor(details["index"], tensor)
    interpreter.invoke()
    boxes = None
    scores = None
    for output in interpreter.get_output_details():
        values = interpreter.get_tensor(output["index"])
        if values.size == 4 * 8400:
            boxes = np.ascontiguousarray(values.reshape(4, 8400), dtype=np.int8)
        elif values.size == 80 * 8400:
            scores = np.ascontiguousarray(values.reshape(80, 8400), dtype=np.int8)
    if boxes is None or scores is None:
        raise SystemExit("model outputs were not boxes [1,4,8400] and scores [1,80,8400]")
    boxes.tofile(out / "boxes.i8")
    scores.tofile(out / "scores.i8")


if __name__ == "__main__":
    main()
