# Comfety

Android only. Expo SDK 58 and TypeScript. This slice is the home screen, the mixed-sentence listen test, and Speak for a typed reply. Listen uses Scribe v2 Realtime, Urdu with English as the secondary language, and background-audio filtering. Speak sends the typed string unchanged to Eleven v4 Turbo and plays it in the last chosen premade voice. Saved replies use that same path and stay on the phone. Guide talk answers with Grok, then speaks that answer. A lost phrase such as سمجھ نہیں آئی asks for shorter words and one example. What’s in front of me and Read this each take one photo, then speak. A medicine label ends with the no-dosage line. The camera stays off until you ask. The recognizer stays off while that audio plays.

Do not put API keys in the app or in git. The listen server reads `ELEVENLABS_API_KEY` from `.env.local`. Do not deploy the worker, and do not run EAS, unless the task says to.
