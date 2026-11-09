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

The `preview` profile is Android only. `android.buildType` is `apk`, so the build runs `:app:assembleRelease`. The JavaScript bundle is inside the APK. It is not a development client, and the phone does not need Metro. When the build finishes, that command prints the install link. Install the APK from the link with the USB cable unplugged.

## Worker stub

The worker holds the keys. `GET /health` is unchanged. `POST /v1/scribe-token` checks the demo secret, then asks ElevenLabs for a single-use `realtime_scribe` token. The response is `{ "token": "..." }`. `POST /v1/speak` checks the same secret, then sends the typed string unchanged to Eleven v4 Turbo (`eleven_v4_turbo`) and returns audio. It does not rewrite, translate, or set a language code. This slice uses one stock voice. It never returns the API key.

```bash
npm test
npx tsc --noEmit -p worker/tsconfig.json
```

`npm test` calls the health route and the token route in-process. It does not deploy anything, and it does not call ElevenLabs.

`GET /health` returns:

```json
{ "ok": true, "env": ["ELEVENLABS_API_KEY", "GEMINI_API_KEY", "DEMO_SECRET"] }
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

That starts the token server on port 8791 and loads `.env.local`. The phone calls `http://<this-machine>:8791/v1/scribe-token` and `http://<this-machine>:8791/v1/speak`. `GEMINI_API_KEY` can stay empty for this test.

Anything other than `GET /health`, `POST /v1/scribe-token`, and `POST /v1/speak` returns 404. Responses never include secret values.

## Mixed-sentence test

On the phone, in Expo Go, open the dev server. Tap **Talk**, then **Listen**. Allow the microphone. Hold the phone toward the person and say: “Bhai yeh bill kitna hai, cash mein do.”

Pass means that one transcript line shows the Urdu words and the English word “cash”. Tap **Stop** when you are done.

Type a reply and tap **Speak**. The app stops listening, then plays that text exactly as typed. The status says “Speaking” while the audio plays, then “Paused”. The browser preview on this machine can show the screen, but the microphone stream runs in Expo Go.

## With no network

The home screen, both choices, the permission sentences, and the Urdu line work with no network. Listening stops, and Speak does not play. The status says "No network."
