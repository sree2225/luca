# Luca – Persistent Materials Storage

This version stores uploaded study-material metadata and extracted text chunks in PostgreSQL whenever `DATABASE_URL` is configured. Render restarts/redeploys therefore do not delete the material index or the content used by Luca/Groq.

## Render setup

On the **Render backend service**, add:

- `DATABASE_URL` – use the Internal Database URL from your Render PostgreSQL database when the database and backend are in the same Render region.
- Keep your existing `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `GROQ_API_KEY`, and `GROQ_MODEL` variables.

Then redeploy the backend.

## Existing materials

On the first startup after connecting PostgreSQL, the server automatically migrates materials from the old `server/materials/index.json` into the `luca_materials` table if that table is empty. This is a one-time migration and is designed to prevent existing uploaded material content from being lost during the move.

## What is stored

For each uploaded material, PostgreSQL stores:

- filename
- subject
- unit
- topic
- MIME type
- upload time
- extracted text chunks used for material retrieval

The actual PDF binary is not currently stored in PostgreSQL; the extracted study content is what Luca uses for the 75% material-grounded notes and Ask Luca retrieval.
