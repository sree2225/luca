# Luca AI Tutor — Groq setup

1. Open a terminal inside `frontend`.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your Groq API key in `.env` as `GROQ_API_KEY=...`.
5. Terminal 1: `npm run server`
6. Terminal 2: `npm run dev`
7. Open the Vite URL.

The React app calls the local `/api/generate-notes` backend. The API key stays on the server and is not exposed to the browser.
