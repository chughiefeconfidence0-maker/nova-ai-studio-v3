const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname)));

const ALLOWED_ORIGINS = [
  "https://chughiefeconfidence0-maker.github.io",
  "https://nova-ai-studio-v3.onrender.com"
];

app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: "Origin not allowed." });
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});
