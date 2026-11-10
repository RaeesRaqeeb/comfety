import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { boxesFromYolo, BOX_SCALE, BOX_ZERO, SCORE_SCALE, SCORE_ZERO } from "../listen/yolo.ts";
import { createWatcher, nextWarning } from "../listen/warning.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const photo = resolve(root, process.argv[2] ?? "listen/fixtures/standing-person.jpg");
const dir = mkdtempSync(`${tmpdir()}/watch-photo-`);
const infer = spawnSync(
  "uv",
  [
    "run",
    "--python",
    "3.12",
    "--with",
    "ai-edge-litert",
    "--with",
    "pillow",
    "python",
    resolve(root, "scripts/watch-infer.py"),
    photo,
    dir,
  ],
  { stdio: ["ignore", "inherit", "inherit"] },
);
if (infer.status !== 0) {
  process.exit(infer.status ?? 1);
}

const boxes = new Int8Array(readFileSync(`${dir}/boxes.i8`));
const scores = new Int8Array(readFileSync(`${dir}/scores.i8`));
const found = boxesFromYolo(boxes, scores);
const watched = [
  [0, "person"],
  [1, "bicycle"],
  [2, "car"],
  [3, "motorcycle"],
  [5, "bus"],
  [7, "truck"],
];
const ranked = [];
for (let index = 0; index < 8400; index += 1) {
  let best = 0;
  let label = "";
  for (const [classIndex, name] of watched) {
    const score = ((scores[classIndex * 8400 + index] ?? 0) - SCORE_ZERO) * SCORE_SCALE;
    if (score > best) {
      best = score;
      label = name;
    }
  }
  if (best < 0.35) {
    continue;
  }
  ranked.push({
    label,
    score: best,
    cx: ((boxes[index] ?? 0) - BOX_ZERO) * BOX_SCALE,
    cy: ((boxes[8400 + index] ?? 0) - BOX_ZERO) * BOX_SCALE,
    w: ((boxes[16800 + index] ?? 0) - BOX_ZERO) * BOX_SCALE,
    h: ((boxes[25200 + index] ?? 0) - BOX_ZERO) * BOX_SCALE,
  });
}
ranked.sort((a, b) => b.h - a.h);
console.log(`photo ${photo}`);
console.log("input uint8 NHWC RGB stretch 640, same tensor the phone model runs");
for (const box of ranked.slice(0, 8)) {
  console.log(
    `${box.label} score ${box.score.toFixed(3)} cx ${box.cx.toFixed(3)} cy ${box.cy.toFixed(3)} w ${box.w.toFixed(3)} h ${box.h.toFixed(3)}`,
  );
}
if (ranked.length === 0) {
  console.log("no watched class scored 0.35 or more");
} else {
  const strongest = ranked.reduce((best, box) => (box.score > best.score ? box : best));
  console.log(
    `highest score: ${strongest.label} ${strongest.score.toFixed(3)} cx ${strongest.cx.toFixed(3)} h ${strongest.h.toFixed(3)}`,
  );
}
let state = createWatcher();
let phrase = null;
for (let frame = 0; frame < 3; frame += 1) {
  const step = nextWarning(state, found, frame * 200);
  state = step.state;
  phrase = step.speak;
}
console.log(phrase ? `spoken after 3 frames: ${phrase}` : "spoken after 3 frames: nothing");
