# CookieGPT — private college tutor

## Deploy as a private website on Render

1. Upload the `cookiegpt` folder to a **private GitHub repository** (do not include API keys).
2. On Render, create a **Web Service** from that repository. Choose Node, build command `npm install`, start command `npm start`.
3. Add environment variables in Render's dashboard:
   - `OPENAI_API_KEY`: your OpenAI API key (paid API usage).
   - `COOKIEGPT_PASSWORD`: a strong, unique password (at least 12 characters) that you give to Cookie privately.
   - `SESSION_SECRET`: a separate, random string of 32+ characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - `NODE_ENV`: `production`.
   - Optional: `OPENAI_MODEL` (default `gpt-4.1-mini`).
4. Deploy. Render provides an HTTPS URL. Share the URL and password separately with Cookie.
5. Set an OpenAI API project spending budget and monitor usage.

## Run locally
Node.js 20+. Set `OPENAI_API_KEY`, `COOKIEGPT_PASSWORD`, and `SESSION_SECRET` in your terminal, then run `npm start` and open http://localhost:3000.

## Privacy and security notes
This is a **single-password, single-person** private site, not full identity verification. Anyone who learns the password can sign in. Rotate it if shared or compromised. Sessions expire after 7 days and are signed, HttpOnly, SameSite=Strict cookies; HTTPS deployment sets Secure. Login is rate-limited per IP in process memory. Logout clears the cookie.

Chat history stays in that browser's localStorage, so anyone with access to Cookie's unlocked browser profile may see it. Prompts are sent to OpenAI for AI responses. No server-side chat database. Do not paste sensitive personal data. Do not publicly publish your API key. This app does not include email-based password reset, MFA, persistent distributed rate limiting, or an account-management system. For stronger identity-only access, add a managed authentication provider.

CookieGPT's academic specialization uses a system prompt, not fine-tuning. It may make mistakes; verify facts and citations.
