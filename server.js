import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";

// Optional PDF support. The package is listed in package.json and loaded only when a PDF is uploaded.
let pdfParser = null;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const materialsDir = path.join(__dirname, "server", "materials");
const materialsIndexPath = path.join(materialsDir, "index.json");
const curriculumPath = path.join(__dirname, "server", "curriculum.json");
const usersPath = path.join(__dirname, "server", "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

async function readUsers() {
  try { return JSON.parse(await fs.readFile(usersPath, "utf8")); } catch { return { users: [] }; }
}
async function writeUsers(data) { await fs.writeFile(usersPath, JSON.stringify(data, null, 2), "utf8"); }
async function ensureAdmin() {
  const email = clean(process.env.ADMIN_EMAIL, 200).toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) return;
  const db = await readUsers();
  const existing = db.users.find(u => u.email === email);
  if (!existing) {
    db.users.push({ id: crypto.randomUUID(), name: "Luca Admin", email, passwordHash: await bcrypt.hash(password, 12), role: "admin", createdAt: new Date().toISOString() });
    await writeUsers(db);
  }
}

function signToken(user) { return jwt.sign({ sub: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" }); }
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Authentication required." });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { return res.status(401).json({ error: "Session expired. Please login again." }); }
}
function adminOnly(req, res, next) { if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin access required." }); next(); }

await fs.mkdir(materialsDir, { recursive: true });
try { await fs.access(materialsIndexPath); } catch { await fs.writeFile(materialsIndexPath, JSON.stringify({ materials: [] }, null, 2)); }

const defaultCurriculum = {
  "1": [
    { id: "tamil", code: "LANG I", icon: "📖", color: "peach", name: "Tamil", lessons: ["தமிழ் இலக்கியம்", "சிற்றிலக்கியம்", "தமிழ் இலக்கணம்", "தமிழ்விடுதூது"] },
    { id: "english", code: "ENG I", icon: "📚", color: "blue", name: "English", lessons: ["Grammar", "Vocabulary", "Reading Skills", "Writing Skills", "Speaking Skills"] },
    { id: "bioinformatics", code: "DCC 1", icon: "🧬", color: "purple", name: "Introduction to Bioinformatics", lessons: ["Introduction to Bioinformatics", "Biological Databases", "NCBI Database", "Sequence Alignment", "BLAST", "Protein Databases"] },
    { id: "computer", code: "DCC 2", icon: "💻", color: "sky", name: "Fundamentals of Computer", lessons: ["Introduction to Computers", "Computer Hardware", "Computer Software", "Operating Systems", "Number Systems", "Programming Basics"] },
    { id: "cell", code: "MDC 1", icon: "🔬", color: "pink", name: "Introduction to Cell Biology and Biomolecules", lessons: ["Cell Theory", "Cell Structure", "Cell Organelles", "Carbohydrates", "Proteins", "Lipids", "Nucleic Acids"] },
    { id: "elective", code: "DSE 1", icon: "🧪", color: "green", name: "Biology Specific Elective – I", lessons: ["Biology Specific Elective – I"] },
    { id: "bio-lab", code: "DCC 1 (Lab)", icon: "🧫", color: "mint", name: "Introduction to Bioinformatics Practical II", lessons: ["NCBI Database Practical", "UniProt Protein Retrieval", "Sequence Alignment Practical", "BLAST Practical", "Protein Structure Retrieval"] },
    { id: "uhv", code: "VAC 1", icon: "🌱", color: "mint", name: "Universal Human Values", lessons: ["Introduction to Human Values", "Self Exploration", "Harmony in Relationships", "Values in Life"] },
    { id: "softskills", code: "SEC 1", icon: "🎯", color: "yellow", name: "Soft Skills", lessons: ["Communication Skills", "Listening Skills", "Body Language and Etiquettes", "Group Discussion and Interview Skills", "Presentation Skills", "Emotional Intelligence Skills", "Time Management Skills", "CV and Resume Writing"] }
  ],
  "2": [], "3": [], "4": [], "5": [], "6": []
};

const { Pool } = pg;
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const curriculumPool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.RENDER ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
    })
  : null;

async function initCurriculumStore() {
  if (!curriculumPool) {
    try { await fs.access(curriculumPath); }
    catch { await fs.writeFile(curriculumPath, JSON.stringify(defaultCurriculum, null, 2), "utf8"); }
    return;
  }
  await curriculumPool.query(`
    CREATE TABLE IF NOT EXISTS luca_curriculum (
      id INTEGER PRIMARY KEY,
      curriculum JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const existing = await curriculumPool.query("SELECT id FROM luca_curriculum WHERE id = 1");
  if (existing.rowCount === 0) {
    await curriculumPool.query(
      "INSERT INTO luca_curriculum (id, curriculum) VALUES (1, $1::jsonb)",
      [JSON.stringify(defaultCurriculum)]
    );
  }
}

async function readCurriculum() {
  if (curriculumPool) {
    const result = await curriculumPool.query("SELECT curriculum FROM luca_curriculum WHERE id = 1");
    if (result.rowCount) return result.rows[0].curriculum;
    return defaultCurriculum;
  }
  try { return JSON.parse(await fs.readFile(curriculumPath, "utf8")); }
  catch { await fs.writeFile(curriculumPath, JSON.stringify(defaultCurriculum, null, 2), "utf8"); return defaultCurriculum; }
}

async function writeCurriculum(data) {
  if (curriculumPool) {
    const result = await curriculumPool.query(
      "UPDATE luca_curriculum SET curriculum = $1::jsonb, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(data)]
    );
    if (result.rowCount === 0) {
      await curriculumPool.query(
        "INSERT INTO luca_curriculum (id, curriculum) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET curriculum = EXCLUDED.curriculum, updated_at = NOW()",
        [JSON.stringify(data)]
      );
    }
    return;
  }
  await fs.writeFile(curriculumPath, JSON.stringify(data, null, 2), "utf8");
}


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
await ensureAdmin();
await initCurriculumStore();
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

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = clean(req.body?.name, 100);
    const email = clean(req.body?.email, 200).toLowerCase();
    const password = String(req.body?.password || "");
    if (!name || !email || password.length < 8) return res.status(400).json({ error: "Name, valid email and password (minimum 8 characters) are required." });
    const db = await readUsers();
    if (db.users.some(u => u.email === email)) return res.status(409).json({ error: "An account with this email already exists." });
    const user = { id: crypto.randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 12), role: "student", createdAt: new Date().toISOString() };
    db.users.push(user); await writeUsers(db);
    res.status(201).json({ token: signToken(user), user: { id: user.id, name, email, role: user.role } });
  } catch (error) { res.status(500).json({ error: "Unable to create account." }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = clean(req.body?.email, 200).toLowerCase();
    const password = String(req.body?.password || "");

    // Production-safe admin login: verify the configured admin credentials
    // directly from environment variables so Vercel/serverless deployments
    // do not depend on a writable users.json file.
    const adminEmail = clean(process.env.ADMIN_EMAIL, 200).toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || "");
    if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
      const adminUser = {
        id: "admin",
        name: "Luca Admin",
        email: adminEmail,
        role: "admin",
      };
      return res.json({
        token: signToken(adminUser),
        user: adminUser,
      });
    }

    const db = await readUsers();
    const user = db.users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Unable to login." });
  }
});

app.get("/api/auth/me", auth, (req, res) => res.json({ user: { id: req.user.sub, name: req.user.name, email: req.user.email, role: req.user.role } }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Luca + Groq + Materials" }));

app.get("/api/curriculum", auth, async (_req, res) => {
  const curriculum = await readCurriculum();
  res.set("Cache-Control", "no-store");
  res.json({ curriculum });
});

app.put("/api/curriculum", auth, adminOnly, async (req, res) => {
  try {
    const input = req.body?.curriculum;
    if (!input || typeof input !== "object") return res.status(400).json({ error: "A curriculum object is required." });
    const output = {};
    for (let semester = 1; semester <= 6; semester += 1) {
      const list = Array.isArray(input[String(semester)]) ? input[String(semester)] : [];
      output[String(semester)] = list.map((subject, index) => {
        const lessons = Array.isArray(subject.lessons) ? subject.lessons.map((x) => clean(x, 200)).filter(Boolean) : [];
        const name = clean(subject.name, 200);
        if (!name || !lessons.length) throw new Error(`Semester ${semester}: every subject needs a name and at least one topic.`);
        return {
          id: clean(subject.id || `sem${semester}-subject-${index + 1}`, 100).replace(/[^a-zA-Z0-9_-]/g, "-"),
          code: clean(subject.code || `SUB ${index + 1}`, 50),
          icon: clean(subject.icon || "📚", 10),
          color: clean(subject.color || "purple", 30),
          name,
          lessons,
        };
      });
    }
    await writeCurriculum(output);
    res.json({ ok: true, curriculum: output });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to save curriculum." });
  }
});

app.get("/api/materials", auth, adminOnly, async (_req, res) => {
    res.set("Cache-Control", "no-store");
  const index = await readMaterialIndex();
  res.json({
    materials: (index.materials || []).map(({ id, filename, subject, unit, topic, mimeType, uploadedAt, chunks }) => ({
      id, filename, subject, unit, topic, mimeType, uploadedAt, chunkCount: chunks?.length || 0,
    })),
  });
});

app.post("/api/materials/upload", auth, adminOnly, async (req, res) => {
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

app.delete("/api/materials/:id", auth, adminOnly, async (req, res) => {
  const index = await readMaterialIndex();
  const before = index.materials?.length || 0;
  index.materials = (index.materials || []).filter((item) => item.id !== req.params.id);
  if (index.materials.length === before) return res.status(404).json({ error: "Material not found." });
  await writeMaterialIndex(index);
  res.json({ ok: true });
});

app.post("/api/generate-notes", auth, async (req, res) => {
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

app.post("/api/ask-luca", auth, async (req, res) => {
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
