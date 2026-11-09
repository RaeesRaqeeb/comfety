# Comfety

Android only. Expo SDK 58 and TypeScript. This slice is the home screen plus the mixed-sentence listen test: Listen, a live Scribe v2 transcript, Urdu with English as the secondary language, and background-audio filtering.

Do not put API keys in the app or in git. The listen server mints a single-use Scribe token from `ELEVENLABS_API_KEY` in `.env.local`. Do not deploy the worker, and do not run EAS, unless the task says to.
