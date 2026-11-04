# Nova AI Studio — Version 3.0

This is the Version 3.0 starter project. It is kept separate from earlier versions.

## Included
- Responsive Nova AI Studio interface
- Sign-in / registration interface (not yet connected to real authentication)
- AI Writing Engine interface
- Express backend endpoint starter at `/api/write`
- `.gitignore` excludes `.env` files

## Security
Do not commit real API keys, passwords, or `.env` files. Add `GEMINI_API_KEY` only in the backend hosting provider's environment-variable settings.

## Run locally
1. Install Node.js.
2. In this folder, run `npm install`.
3. Set `GEMINI_API_KEY` in your environment.
4. Run `npm start`.
5. Open `http://localhost:3000`.

The AI provider request and real account authentication are intentionally not implemented yet. They will be added and tested in later steps.
