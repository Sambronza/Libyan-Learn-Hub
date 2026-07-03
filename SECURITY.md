# Security Notes & Rotation Checklist

## ⚠️ Secrets that must be rotated

The following secrets have been exposed (weak values, committed files, or shared in chats)
and should be rotated as soon as possible:

1. **JWT_SECRET** — currently a weak guessable value. Anyone who guesses it can forge
   admin tokens. Generate a strong value:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```
   Update it in **Render → Environment** and the local `artifacts/api-server/.env`
   at the same time. Note: rotating logs out all users (JWTs become invalid).

2. **SESSION_SECRET** — same procedure as JWT_SECRET.

3. **Cloudinary API secret** — rotate from the Cloudinary console
   (Settings → Access Keys → Regenerate), then update env values.

4. **Brevo SMTP key** — regenerate from the Brevo dashboard (SMTP & API → SMTP keys).

5. **LiveKit API key/secret** — regenerate from cloud.livekit.io project settings.

6. **Neon database password** — reset the role password from the Neon console,
   then update `DATABASE_URL` everywhere.

## Rules going forward

- Never commit `.env` files (already gitignored) or paste secrets into chats/issues.
- Keep prod secrets only in Render/Vercel/EAS environment settings.
- The payment provider secrets (`VISA_*`) must go straight into Render env when the
  processor delivers them — never into the repo.

## Housekeeping

Root-level throwaway files are now gitignored (`test_*`, `scratch_*`, `19th_of_June.zip`,
`database_backup*.json`, etc.). Delete them locally when convenient — they are not
needed by the application.
