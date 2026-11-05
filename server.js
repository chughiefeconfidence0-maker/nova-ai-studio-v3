const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname)));

const FRONTEND_ORIGIN =
  "https://chughiefeconfidence0-maker.github.io";

app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;

  if (origin && origin !== FRONTEND_ORIGIN) {
    return res.status(403).json({ error: "Origin not allowed." });
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Nova AI Studio V3.0"
  });
});

app.post("/api/write", async (req, res) => {
  const { prompt, type } = req.body || {};

  if (
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.length > 8000
  ) {
    return res.status(400).json({
      error: "Enter a prompt of up to 8,000 characters."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "AI provider is not configured."
    });
  }

  try {
    const writingType =
      typeof type === "string" ? type.slice(0, 60) : "General writing";

    const googleResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text:
                "You are Nova AI Studio's professional writing assistant. " +
                "Create a useful, clear and polished result.\n" +
                "Writing type: " + writingType + "\n" +
                "User request: " + prompt
            }]
          }]
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    if (!googleResponse.ok) {
      console.error("Gemini request failed:", googleResponse.status);
      return res.status(502).json({
        error: "Gemini could not complete the request. Please try again."
      });
    }

    const data = await googleResponse.json();

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("");

    if (!text) {
      return res.status(502).json({
        error: "Gemini returned no writing. Please try again."
      });
    }

    return res.json({ text });

  } catch (error) {
    console.error("Writing request failed:", error.name);
    return res.status(500).json({
      error: "Unable to generate writing right now. Please try again."
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Nova AI Studio server listening on " + port);
});
    
