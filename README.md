# Comfety

Comfety is a phone held between two people. This slice is the Android home screen only.

Talk is for someone who cannot speak. The phone would be held toward the other person. Guide is for someone who cannot see. Guide is not a cane, and it does not replace a sighted guide.

## What this slice does

One screen. Black background, white text, transcript-sized type.

- **Talk** and **Guide** are the two choices. Tap one to select it. The screen shows that choice and leaves it selected.
- The microphone sentence is on Talk: it hears the other person, or your question. Tapping does not turn the microphone on.
- The camera sentence is on Guide: it looks only after you ask. Tapping does not turn the camera on. The same button says this is not a cane.
- The Urdu line سمجھ نہیں آئی is drawn in Noto Nastaliq Urdu, the font file shipped at `assets/fonts/NotoNastaliqUrdu.ttf` (SIL Open Font License, `assets/fonts/OFL.txt`). The line appears only after that file has loaded. If it fails, the screen says so and does not substitute another font.

## What this slice does not do

- It does not listen, transcribe, or speak.
- It does not open the camera, describe a scene, read a label, or warn about obstacles.
- It does not give a dose. A later reading of a medicine label has to end with: "I can read the words. I cannot tell you how much to take."
- It has no accounts, no API keys, and no calls to ElevenLabs, Gemini, or any other vendor.
- There is no installable APK. EAS is not part of this slice.
- The worker is not deployed. It does not mint a speech token or forward speak, guide, or look requests.

## Run the app locally

Node.js 22.13 or newer.

```bash
npm install
npm start
```

`npm start` runs the Expo dev server on port 8421. With an Android emulator or a phone connected, `npm run android` opens it. This slice boots from that dev server. A later build is a release APK with the bundle inside it. Expo Go is not the graded demo.

## Worker stub

The worker is the empty shape of the key proxy. The only route is `GET /health`.

```bash
npm test
npx tsc --noEmit -p worker/tsconfig.json
```

`npm test` calls the health route in-process. It does not deploy anything.

To boot the worker on your machine, from `worker/`:

```bash
npx wrangler dev --port 8791
```

`GET /health` returns:

```json
{ "ok": true, "env": ["ELEVENLABS_API_KEY", "GEMINI_API_KEY", "DEMO_SECRET"] }
```

Those three names are the worker's environment. Values are secrets. They are not in this repo. There is no `.env`. Do not deploy this worker.

Anything other than `GET /health` returns 404. The response never includes secret values.

## With no network

The home screen, both choices, the permission sentences, and the Urdu line work with no network. Nothing else is implemented.
