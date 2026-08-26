import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
    "title",
    "overview",
    "detailedExplanation",
    "keyConcepts",
    "importantTerms",
    "examples",
    "examPoints",
    "shortQuestions",
    "longQuestions",
    "quickRevision",
    "sections",
  ],
  additionalProperties: false,
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Luca + Groq" });
});

app.post("/api/generate-notes", async (req, res) => {
  try {
    const { subject, topic, mood } = req.body;

    if (!subject || !topic) {
      return res.status(400).json({
        error: "Subject and topic are required.",
      });
    }

    const moodInstruction =
      mood === "😵"
        ? "The student is confused. Use especially clear, step-by-step explanations."
        : mood === "🔥"
          ? "The student is in exam mode. Prioritize definitions, important points and exam questions."
          : "The student is comfortable. Balance explanation, examples and exam preparation.";

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `You are Luca, a friendly but academically accurate college AI tutor for a B.Sc. Bioinformatics student. Generate notes specifically for the requested subject and topic. Never use a generic template. The content must change meaningfully when the topic changes. ${moodInstruction}`,
        },
        {
          role: "user",
          content: `Create detailed study notes for:\nSubject: ${subject}\nTopic: ${topic}\n\nRequirements:\n- Explain the actual topic, not just how to study it.\n- Use accurate academic terminology.\n- Keep the language understandable for a college student.\n- Include definitions, mechanisms/processes where relevant, examples and applications where relevant.\n- Make examination points useful for semester preparation.\n- Give 5 short-answer questions and 5 descriptive/long-answer questions.\n- Give 6 to 10 quick-revision points.\n- Do not invent syllabus-specific claims that are not necessary.\n- Use headings and subheadings throughout the explanation; avoid one huge paragraph.
- Create 4 to 7 logical sections for the topic. Each section should have a clear heading, optional subheading, a focused explanation, and useful bullet points.
- Make the notes feel like well-organized college textbook notes, not a generic AI paragraph.
- Return only the requested JSON structure.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "luca_notes",
          strict: true,
          schema: notesSchema,
        },
      },
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Groq returned an empty response.");
    }

    const notes = JSON.parse(content);
    res.json(notes);
  } catch (error) {
    console.error("Luca Groq error:", error);
    res.status(500).json({
      error: error?.message || "Unable to generate AI notes.",
    });
  }
});


app.post("/api/ask-luca", async (req, res) => {
  try {
    const { messages = [], subject = "", topic = "" } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "A conversation message is required." });
    }

    const safeMessages = messages.slice(-20).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "").slice(0, 6000),
    }));

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      temperature: 0.45,
      messages: [
        {
          role: "system",
          content: `You are Luca, a friendly college AI tutor for a B.Sc. Bioinformatics AI/DS student. ${subject ? `Current subject: ${subject}.` : ""} ${topic ? `Current topic: ${topic}.` : ""}

Rules:
- Continue the conversation naturally. Remember earlier messages in the supplied conversation.
- Answer the student's actual question, not a generic study tip.
- Use clear headings, subheadings, bullets, numbered steps, tables when useful, and short paragraphs.
- If the student asks for Tanglish, respond in Tanglish. Otherwise use clear English.
- Explain difficult terminology immediately in simple words.
- For exam questions, give structured exam-ready answers and mention suitable mark-level depth.
- If the student asks for a quiz, ask one question at a time and wait for their answer.
- Do not claim to have access to information that was not provided.
- Be encouraging but academically accurate.`
        },
        ...safeMessages,
      ],
    });

    const answer = completion.choices?.[0]?.message?.content;
    if (!answer) throw new Error("Groq returned an empty response.");
    res.json({ answer });
  } catch (error) {
    console.error("Luca chat error:", error);
    res.status(500).json({ error: error?.message || "Unable to answer with Luca AI." });
  }
});

app.listen(PORT, () => {
  console.log(`🧸 Luca AI server running at http://localhost:${PORT}`);
});
