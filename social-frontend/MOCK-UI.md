# Offline UI testing

Set `NEXT_PUBLIC_MOCK_UI=true` in `.env.local`, then restart development or rebuild and restart the production preview. Next.js embeds public environment flags at build time.

Sign in with **admin@gmail.com** / **Test@123**. This is a public demo credential, not a backend account. The demo user has workspace and platform-admin access. A visible banner identifies mock mode.

Dashboard, accounts, posts, calendar, Studio, brand profile, templates, media, analytics, settings, billing and admin screens use synthetic data. Supported edits and publishing/scheduling update in-memory demo records only. Refresh resets fixtures. Text generation and images are predetermined examples, not real AI output.

## Media uploads and stock samples

The media picker supports local image and video uploads in mock mode. Choose or drop a JPEG, PNG, or WebP image up to **8 MiB**, or an MP4 or WebM video up to **50 MiB**. Image files can also be pasted into the upload dropzone; pasted URLs and text are not uploaded. Empty and unsupported files are rejected. Uploaded files become in-memory demo media assets with local previews, not backend uploads; refresh removes them.

Stock search provides a bundled local sample image, not a real Pexels photograph. Only image samples are included; stock video searches return no results. Importing the sample adds an in-memory demo asset without downloading from a provider. Pexels attribution and license links are informational only, not evidence that the sample came from Pexels. Stock search and import make no real provider requests.

**Videos are draft-only**: local video uploads can be selected and previewed for drafts, but video publishing and scheduling are not supported. Video generation remains disabled.

Real stock search and import require **`PEXELS_API_KEY` on the backend server only**. Never put this secret in a `NEXT_PUBLIC_*` variable or browser code. No provider key is needed for offline samples.

Mock media previews permit local `/mock-ui/` samples, same-origin blob URLs, and supported image/video data URLs only while mock mode is enabled. Real-mode media previews require HTTPS. Attribution links require HTTPS in either mode.

OAuth, video generation, registration, password emails and checkout are intentionally disabled and display an explanatory error. No external provider or backend request is made by the API client in mock mode. Unsupported API operations fail closed rather than falling through to the backend.

Mock and real authentication use separate browser storage keys. Turning mock mode off does not create or grant privileges to a real account. Set `NEXT_PUBLIC_MOCK_UI=false` (or remove the flag), rebuild and restart before real backend testing or production deployment. Never deploy a demo build as the real product.