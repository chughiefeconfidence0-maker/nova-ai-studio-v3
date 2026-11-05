const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);

const ALLOWED_ORIGINS = new Set([
  "https://chughiefeconfidence0-maker.github.io",
  "https://nova-ai-studio-v3.onrender.com"
]);

app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname), { dotfiles: "deny" }));

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute and try again." }
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Writing limit reached. Please wait a minute before trying again." }
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "Nova AI Studio V3.0" });
});

app.get("/api/config", authLimiter, (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Authentication is not configured yet." });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.json({ supabaseUrl, supabaseAnonKey });
});

async function requireUser(req, res, next) {
  if (!supabase) {
    return res.status(503).json({ error: "Authentication is not configured yet." });
  }
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Please sign in to use this feature." });
  }
  try {
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data.user) {
      return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
    }
    req.user = data.user;
    next();
  } catch (error) {
    console.error("Authentication check failed:", error.name);
    return res.status(503).json({ error: "Unable to verify your session. Please try again." });
  }
}

app.post("/api/write", writeLimiter, requireUser, async (req, res) => {
  const { prompt, type } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 8000) {
    return res.status(400).json({ error: "Enter a prompt of up to 8,000 characters." });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "The AI provider is not configured yet." });
  }
  try {
    const writingType = typeof type === "string" ? type.slice(0, 60) : "General writing";
    const googleResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "You are Nova AI Studio's professional writing assistant. Create a useful, clear and polished result.\n" +
                "Writing type: " + writingType + "\nUser request: " + prompt
            }]
          }]
        }),
        signal: AbortSignal.timeout(60000)
      }
    );
    if (!googleResponse.ok) {
      console.error("Gemini request failed:", googleResponse.status);
      return res.status(502).json({ error: "Gemini could not complete the request. Please try again." });
    }
    const data = await googleResponse.json();
    const generatedText = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("");
    if (!generatedText) {
      return res.status(502).json({ error: "Gemini returned no writing. Please try again." });
    }
    return res.json({ text: generatedText });
  } catch (error) {
    console.error("Writing request failed:", error.name);
    return res.status(500).json({ error: "Unable to generate writing right now. Please try again." });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "The request body must contain valid JSON." });
  }
  console.error("Request failed:", error.name || "UnknownError");
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Nova AI Studio server listening on " + port);
});
