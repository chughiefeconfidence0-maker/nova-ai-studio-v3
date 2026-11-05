# Nova AI Studio — Version 4.0

Nova AI Studio V4.0 continues the responsive AI writing workspace with Supabase email/password authentication, a protected Gemini writing endpoint, and the refreshed premium interface. Version 3.0 remains preserved in the mainline history; this version is maintained on the `version-4.0` branch.

## Security model
- Visitors start at the sign-in/register screen.
- Supabase manages account creation, password handling, email confirmation, and sessions.
- The browser sends its Supabase access token as a Bearer token.
- The Express backend verifies that token with Supabase before allowing access to /api/write.
- The AI endpoint has a per-IP request limit and validates prompt size.
- Gemini credentials remain in Render environment variables and are never sent to the browser.
- CORS is an additional browser control, not a replacement for authentication.

## Required environment variables
Set these in the Render service's Environment settings. Never commit real values:
- SUPABASE_URL
- SUPABASE_ANON_KEY (or the Supabase publishable/anon key)
- GEMINI_API_KEY

The frontend obtains the public Supabase URL/key from /api/config. The public anon/publishable key is designed for browser use; database security must still be enforced with appropriate Row Level Security policies. The service-role key must never be used in the browser or committed.

## Supabase setup
1. Enable Email authentication.
2. In Authentication → URL Configuration, add the Render site URL and the GitHub Pages URL to the allowed redirect URLs if both are used.
3. Copy the project URL and anon/publishable key into Render environment variables.

## Run locally
1. Install Node.js.
2. Run npm install.
3. Set the environment variables above in your local environment.
4. Run npm start.
5. Open http://localhost:3000.

## Deployment and security review
This branch is saved as Version 4.0; it is not automatically deployed or runtime-verified. Before inviting real users, test registration, email confirmation, sign-in, sign-out, and real AI writing. Review HTTPS, session handling, API-key secrecy and rotation if exposed, input validation, rate limits, database permissions and Row Level Security, backups, monitoring, logging, dependency vulnerabilities, and abuse controls.
