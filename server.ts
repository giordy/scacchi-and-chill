import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));

// Server-side Gemini initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// API route to fetch Lichess user data (for correspondence rating)
app.get("/api/lichess-user/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Lichess returned HTTP ${response.status}` });
    }

    const data = await response.json();
    const correspondenceRating = data.perfs?.correspondence?.rating ?? null;
    const classicalRating = data.perfs?.classical?.rating ?? null;
    const rapidRating = data.perfs?.rapid?.rating ?? null;

    res.json({
      username: data.username,
      correspondence: correspondenceRating,
      classical: classicalRating,
      rapid: rapidRating,
      title: data.title ?? null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user from Lichess" });
  }
});

app.post("/api/generate-review", async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Parametro prompt mancante." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Chiave GEMINI_API_KEY non presente sul server. Puoi usare subito il pulsante '📋 Copia Prompt Completo' per generare la recensione su Claude o ChatGPT!",
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: systemInstruction
        ? {
            systemInstruction,
            temperature: 0.8,
          }
        : {
            temperature: 0.8,
          },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API error:", error?.message || error);
    const msg = error?.message || "";
    const isKeyIssue = msg.includes("API key") || msg.includes("API_KEY");
    res.status(500).json({
      error: isKeyIssue
        ? "Chiave API Gemini non valida nell'ambiente. Puoi utilizzare immediatamente il pulsante '📋 Copia Prompt Completo' per incollarlo su Claude o ChatGPT con tutti i dati già pronti!"
        : (msg || "Errore durante la generazione della recensione con Gemini."),
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
