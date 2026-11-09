# Comfety

Comfety is a phone held between two people. This slice is the Android home screen and the mixed-sentence listen test.

Talk is for someone who cannot speak. The phone would be held toward the other person. Guide is for someone who cannot see. Guide is not a cane, and it does not replace a sighted guide.

## What this slice does

One screen. Black background, white text, transcript-sized type.

- **Talk** and **Guide** are the two choices. Tap one to select it. The screen shows that choice and leaves it selected.
- The microphone sentence is on Talk: it hears the other person, or your question. Tapping Talk does not turn the microphone on. **Listen** does, and **Stop** turns it off.
- The camera sentence is on Guide: it looks only after you ask. Tapping does not turn the camera on. The same button says this is not a cane.
- The Urdu line سمجھ نہیں آئی is drawn in Noto Nastaliq Urdu, the font file shipped at `assets/fonts/NotoNastaliqUrdu.ttf` (SIL Open Font License, `assets/fonts/OFL.txt`). The line appears only after that file has loaded. If it fails, the screen says so and does not substitute another font.

## What this slice does not do

- It does not speak a reply.
- Listen transcribes with ElevenLabs Scribe v2 Realtime. Urdu is `language_code=ur`, English is the secondary language, and `filter_background_audio` is on. The phone never holds the ElevenLabs key. The worker mints a single-use token.
- It does not open the camera, describe a scene, read a label, or warn about obstacles.
- It does not give a dose. A later reading of a medicine label has to end with: "I can read the words. I cannot tell you how much to take."
- It has no accounts. API keys are not in the app or in git.
- There is no install link in the repo. Building the preview APK needs your Expo account.
- The worker is not deployed. It mints a Scribe token only. It does not forward speak, guide, or look requests.

## Run the app locally

Node.js 22.13 or newer.

```bash
npm install
npm start
```

`npm start` runs the Expo dev server on port 8421. With an Android emulator or a phone connected, `npm run android` opens it. That dev server is for local work. Expo Go is not the graded demo.

## Preview APK

An Expo account is required. Sign up at [expo.dev](https://expo.dev) if you do not have one. This repo does not contain the account, a token, or an install link.

Install EAS CLI:

```bash
npm install --global eas-cli
```

Log in, then build the Android preview APK:

```bash
eas login
eas build -p android --profile preview
```

The `preview` profile is Android only. `android.buildType` is `apk`, so the build runs `:app:assembleRelease`. The JavaScript bundle is inside the APK. It is not a development client, and the phone does not need Metro. When the build finishes, that command prints the install link. Install the APK from the link with the USB cable unplugged. The phone needs Android 8 or newer. The GPU resizer needs a newer phone, but the CPU path should still watch on Android 8.

## Worker stub

The worker holds the keys. `GET /health` is unchanged. `POST /v1/scribe-token` checks the demo secret, then asks ElevenLabs for a single-use `realtime_scribe` token. The response is `{ "token": "..." }`. `POST /v1/speak` checks the same secret, then sends the typed string unchanged to Eleven v4 Turbo (`eleven_v4_turbo`) and returns audio. It does not rewrite, translate, or set a language code. This slice uses four premade voices, labeled warm woman, warm man, clear woman, and clear man. The phone remembers the last choice. It never returns the API key.

```bash
npm test
npx tsc --noEmit -p worker/tsconfig.json
```

`npm test` calls the health route and the token route in-process. It does not deploy anything, and it does not call ElevenLabs.

`GET /health` returns:

```json
{ "ok": true, "env": ["ELEVENLABS_API_KEY", "XAI_API_KEY", "DEMO_SECRET"] }
```

Those three names are the worker's environment. Values are secrets. They are not in this repo. Do not deploy this worker.

`ELEVENLABS_API_KEY` is read from `.env.local` (gitignored). Add a long random `DEMO_SECRET` to that same file. Create `.env` at the repo root (also gitignored) with the same demo string:

```
EXPO_PUBLIC_DEMO_SECRET=
```

Restart `npm start` after writing `.env`. Metro only reads `EXPO_PUBLIC_DEMO_SECRET` at startup. Then, from the repo root:

```bash
npm run listen
```

That starts the token server on port 8791 and loads `.env.local`. The phone calls `http://<this-machine>:8791/v1/scribe-token`, `http://<this-machine>:8791/v1/speak`, and `http://<this-machine>:8791/v1/guide`. Put `XAI_API_KEY` in `.env.local` for Guide. Restart `npm run listen` after adding it.

Anything other than `GET /health`, `POST /v1/scribe-token`, `POST /v1/speak`, `POST /v1/guide`, and `POST /v1/look` returns 404. Responses never include secret values. The look route does not store the photo.

## Mixed-sentence test

On the phone, in Expo Go, open the dev server. Tap **Talk**, then **Listen**. Allow the microphone. Hold the phone toward the person and say: “Bhai yeh bill kitna hai, cash mein do.”

Pass means that one transcript line shows the Urdu words and the English word “cash”. Tap **Stop** when you are done.

Type a reply and tap **Speak**. The app stops listening, then plays that text exactly as typed. The row above the box is saved replies. Tap one to speak it. Tap **+** to save what is in the box. Hold a reply to change it, then tap **+**. Tap **×** to delete it. The phone keeps that list. The status says “Speaking” while the audio plays, then “Paused”. The browser preview on this machine can show the screen, but the microphone stream runs in Expo Go.

## Guide

Tap **Guide**, then **Talk**, and ask a question. The app answers in a few short sentences and speaks them with the voice you last chose. Then say “سمجھ نہیں آئی”. The next answer uses shorter words and one concrete example.

**What’s in front of me** opens the camera. Aim, then tap **Take photo**. It speaks what is in that photo. **Read this** works the same way and speaks the words it can see. **Check the ground** takes one photo of the ground while you stand still. It may say possible stairs, an open drain, a vehicle, or a person, and it says it is not sure. If it sees none of those, it says it can still miss them. It never says the way is clear. You can say those phrases after **Talk** as well. A medicine label ends with “I can read the words. I cannot tell you how much to take.” The camera stays off until you ask. **Watch obstacles** does not run in Expo Go. The app says it is not watching. The project includes a YOLO11n int8 model (Ultralytics weights, AGPL-3.0) for a preview APK built after this model landed. That build can warn about a close person or vehicle. It will not say one is close unless a real detection says so. An APK built before the model cannot watch. This is not a cane.

## With no network

The home screen, both choices, the permission sentences, and the Urdu line work with no network. Listening stops, and Speak does not play. The status says "No network."
