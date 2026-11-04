// Nova AI Studio v3 — secure backend starter.
// Set GEMINI_API_KEY in your hosting provider's environment settings.
// Never put the key in index.html, app.js, or a public repository.
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname)));

app.post("/api/write", async (req, res) => {
  const { prompt, type } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "A writing prompt is required." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "AI provider is not configured." });
  }

  try {
    // The API key is read only on the server. Add the provider request here
    // during the next integration step; do not expose the key to the browser.
    return res.status(503).json({
      error: "The secure server is prepared, but the Gemini request will be added in the next integration step."
    });
  } catch (error) {
    console.error("Writing request failed.");
    return res.status(500).json({ error: "Unable to generate a draft right now." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Nova AI Studio server listening on ${port}`));
