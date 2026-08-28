# Luca authentication

- Passwords are hashed with bcrypt before storage.
- Login/register happens on the backend.
- Sessions use signed JWTs and expire after 7 days.
- Notes, Ask Luca, and all Materials endpoints require authentication.
- Material upload/list/delete require the admin role on the backend.
- The admin account is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first server start.
- Set a long random `JWT_SECRET` in production and never commit `.env` or `server/users.json`.
- For production deployments with ephemeral filesystems, move users/material metadata to a managed database/object store.
