# Offline UI testing

Set `NEXT_PUBLIC_MOCK_UI=true` in `.env.local`, then restart development or rebuild and restart the production preview. Next.js embeds public environment flags at build time.

Sign in with **admin@gmail.com** / **Test@123**. This is a public demo credential, not a backend account. The demo user has workspace and platform-admin access. A visible banner identifies mock mode.

Dashboard, accounts, posts, calendar, Studio, brand profile, templates, media, analytics, settings, billing and admin screens use synthetic data. Supported edits and publishing/scheduling update in-memory demo records only. Refresh resets fixtures. Text generation and images are predetermined examples, not real AI output.

OAuth, file uploads, video generation, registration, password emails and checkout are intentionally disabled and display an explanatory error. No external provider or backend request is made by the API client in mock mode. Unsupported API operations fail closed rather than falling through to the backend.

Mock and real authentication use separate browser storage keys. Turning mock mode off does not create or grant privileges to a real account. Set `NEXT_PUBLIC_MOCK_UI=false` (or remove the flag), rebuild and restart before real backend testing or production deployment. Never deploy a demo build as the real product.