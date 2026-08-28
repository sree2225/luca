import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Optional PDF support. The package is listed in package.json and loaded only when a PDF is uploaded.
let pdfParser = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const materialsDir = path.join(__dirname, "server", "materials");
const materialsIndexPath = path.join(materialsDir, "index.json");

await fs.mkdir(materialsDir, { recursive: true });
try { await fs.access(materialsIndexPath); } catch { await fs.writeFile(materialsIndexPath, JSON.stringify({ materials: [] }, null, 2)); }

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const notesSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    overview: { type: "string" },
    detailedExplanation: { type: "string" },
    keyConcepts: { type: "array", items: { type: "string" } },
    importantTerms: { type: "array", items: { type: "string" } },
    examples: { type: "array", items: { type: "string" } },
    examPoints: { type: "array", items: { type: "string" } },
    shortQuestions: { type: "array", items: { type: "string" } },
    longQuestions: { type: "array", items: { type: "string" } },
    quickRevision: { type: "array", items: { type: "string" } },
    materialSources: { type: "array", items: { type: "string" } },
    sourceSummary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          subheading: { type: "string" },
          explanation: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["heading", "subheading", "explanation", "bullets"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "title", "overview", "detailedExplanation", "keyConcepts", "importantTerms",
    "examples", "examPoints", "shortQuestions", "longQuestions", "quickRevision",
    "materialSources", "sourceSummary", "sections",
  ],
  additionalProperties: false,
};

const clean = (value, max = 300) => String(value ?? "").trim().slice(0, max);
const tokenize = (value) => clean(value, 1000).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((x) => x.length > 2);

async function readMaterialIndex() {
  try {
    return JSON.parse(await fs.readFile(materialsIndexPath, "utf8"));
  } catch {
    return { materials: [] };
  }
}

async function writeMaterialIndex(index) {
  await fs.writeFile(materialsIndexPath, JSON.stringify(index, null, 2), "utf8");
}

function chunkText(text, size = 1800, overlap = 250) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf("\n", end), normalized.lastIndexOf(". ", end));
      if (boundary > start + size * 0.65) end = boundary + 1;
    }
    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

function scoreChunk(chunk, subject, topic) {
  const text = chunk.text.toLowerCase();
  const subjectTokens = tokenize(subject);
  const topicTokens = tokenize(topic);
  let score = 0;
  for (const token of subjectTokens) if (text.includes(token)) score += 1;
  for (const token of topicTokens) if (text.includes(token)) score += 4;
  if (text.includes(String(topic).toLowerCase())) score += 12;
  if (chunk.topic.toLowerCase() === String(topic).toLowerCase()) score += 20;
  return score;
}

function retrieveMaterials(subject, topic, limit = 6) {
  return readMaterialIndex().then((index) => {
    const all = (index.materials || []).flatMap((material) =>
      (material.chunks || []).map((text, chunkIndex) => ({
        id: `${material.id}-${chunkIndex}`,
        filename: material.filename,
        subject: material.subject,
        unit: material.unit,
        topic: material.topic,
        text,
      }))
    );
    return all
      .map((chunk) => ({ ...chunk, score: scoreChunk(chunk, subject, topic) }))
      .filter((chunk) => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  });
}

function formatMaterialContext(chunks) {
  if (!chunks.length) return "NO MATCHING UPLOADED MATERIAL WAS FOUND FOR THIS TOPIC.";
  return chunks.map((chunk, index) =>
    `[SOURCE ${index + 1}] ${chunk.filename} | ${chunk.unit || ""} | ${chunk.topic}\n${chunk.text}`
  ).join("\n\n");
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Luca + Groq + Materials" }));

app.get("/api/materials", async (_req, res) => {
  const index = await readMaterialIndex();
  res.json({
    materials: (index.materials || []).map(({ id, filename, subject, unit, topic, mimeType, uploadedAt, chunks }) => ({
      id, filename, subject, unit, topic, mimeType, uploadedAt, chunkCount: chunks?.length || 0,
    })),
  });
});

app.post("/api/materials/upload", async (req, res) => {
  try {
    const { filename, mimeType, subject, unit = "", topic, contentBase64 } = req.body || {};
    if (!filename || !subject || !topic || !contentBase64) {
      return res.status(400).json({ error: "filename, subject, topic and contentBase64 are required." });
    }

    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._ -]/g, "_");
    const buffer = Buffer.from(String(contentBase64).replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!buffer.length) return res.status(400).json({ error: "The uploaded file is empty." });
    if (buffer.length > 12 * 1024 * 1024) return res.status(413).json({ error: "Please keep each material under 12 MB." });

    let text = "";
    const isPdf = mimeType === "application/pdf" || safeName.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      try {
        if (!pdfParser) {
          const module = await import("pdf-parse");
          pdfParser = module.default || module;
        }
        const parsed = await pdfParser(buffer);
        text = parsed.text || "";
      } catch (error) {
        return res.status(422).json({ error: `PDF text extraction failed. Run npm install so pdf-parse is installed. ${error.message}` });
      }
    } else {
      text = buffer.toString("utf8");
    }

    const chunks = chunkText(text);
    if (!chunks.length) return res.status(422).json({ error: "No readable text was found in this material." });

    const index = await readMaterialIndex();
    const material = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename: safeName,
      subject: clean(subject, 200),
      unit: clean(unit, 100),
      topic: clean(topic, 200),
      mimeType: clean(mimeType, 100),
      uploadedAt: new Date().toISOString(),
      chunks,
    };
    index.materials = [material, ...(index.materials || [])];
    await writeMaterialIndex(index);

    res.json({ ok: true, material: { ...material, chunks: undefined, chunkCount: chunks.length } });
  } catch (error) {
    console.error("Material upload error:", error);
    res.status(500).json({ error: error.message || "Unable to store material." });
  }
});

app.delete("/api/materials/:id", async (req, res) => {
  const index = await readMaterialIndex();
  const before = index.materials?.length || 0;
  index.materials = (index.materials || []).filter((item) => item.id !== req.params.id);
  if (index.materials.length === before) return res.status(404).json({ error: "Material not found." });
  await writeMaterialIndex(index);
  res.json({ ok: true });
});

app.post("/api/generate-notes", async (req, res) => {
  try {
    const { subject, topic, mood } = req.body;
    if (!subject || !topic) return res.status(400).json({ error: "Subject and topic are required." });

    const materialChunks = await retrieveMaterials(subject, topic, 6);
    const materialContext = formatMaterialContext(materialChunks);
    const sourceNames = [...new Set(materialChunks.map((item) => item.filename))];
    const moodInstruction = mood === "😵"
      ? "The student is confused. Use especially clear, step-by-step explanations."
      : mood === "🔥"
        ? "The student is in exam mode. Prioritize definitions, important points and exam questions."
        : "The student is comfortable. Balance explanation, examples and exam preparation.";

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      temperature: 0.25,
      max_completion_tokens: 5000,
      messages: [
        {
          role: "system",
          content: `You are Luca, a friendly but academically accurate college AI tutor for a B.Sc. Bioinformatics AI/DS student.

SOURCE POLICY — VERY IMPORTANT:
- Use the retrieved college study material as the main academic source: approximately 75% of the educational substance should be grounded in it.
- Use up to approximately 25% AI enrichment only to clarify, simplify, connect concepts, add a useful example/application, or improve exam presentation.
- Never contradict the provided material.
- Never invent a college-specific fact, definition, syllabus item, or claim that is not supported by the material.
- Do not mix unrelated subjects/topics.
- If the material is insufficient, say so instead of pretending it was in the material.
- Keep the selected subject and topic central.

OUTPUT STYLE:
- Neat headings and subheadings, not giant paragraphs.
- Clear college-level language.
- Preserve important terminology.
- Include definitions, mechanisms/processes, examples, applications and exam points where relevant.
- ${moodInstruction}

Retrieved study material:
${materialContext}`,
        },
        {
          role: "user",
          content: `Create detailed study notes for:
Subject: ${subject}
Topic: ${topic}

Requirements:
- Overview
- Detailed explanation
- Key concepts
- Important terms
- Examples and applications
- Examination points
- 5 short questions
- 3 long questions
- Quick revision
- 3–6 structured sections
- Return only the requested JSON structure.
- materialSources must contain only the filenames actually used.
- sourceSummary must briefly explain that the notes are grounded in uploaded material with limited AI enrichment.`,
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "luca_notes", strict: true, schema: notesSchema } },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned an empty response.");
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Luca Groq error:", error);
    res.status(500).json({ error: error?.message || "Unable to generate AI notes." });
  }
});

app.post("/api/ask-luca", async (req, res) => {
  try {
    const { messages = [], subject = "", topic = "" } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "A conversation message is required." });

    const safeMessages = messages.slice(-20).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "").slice(0, 6000),
    }));
    const materialChunks = await retrieveMaterials(subject, topic, 5);
    const materialContext = formatMaterialContext(materialChunks);

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `You are Luca, a friendly college AI tutor for a B.Sc. Bioinformatics AI/DS student.
Current subject: ${subject || "not specified"}.
Current topic: ${topic || "not specified"}.

Use this topic's uploaded study material as the main source (about 75%). You may add about 25% AI enrichment for clarification, examples, analogies and applications.
Do not contradict or replace the study material. Do not mix unrelated topics. If the material does not contain enough information, clearly say that the point is an AI clarification rather than pretending it came from the notes.
Continue the conversation naturally and remember earlier messages supplied below.
Use headings, subheadings, bullets, numbered steps and tables when useful. If the student asks for Tanglish, answer in Tanglish. For exam questions, give structured exam-ready answers.

Retrieved material:
${materialContext}`,
        },
        ...safeMessages,
      ],
    });

    const answer = completion.choices?.[0]?.message?.content;
    if (!answer) throw new Error("Groq returned an empty response.");
    res.json({ answer, materialSources: [...new Set(materialChunks.map((item) => item.filename))] });
  } catch (error) {
    console.error("Luca chat error:", error);
    res.status(500).json({ error: error?.message || "Unable to answer with Luca AI." });
  }
});

app.listen(PORT, () => console.log(`🧸 Luca AI server running at http://localhost:${PORT}`));
