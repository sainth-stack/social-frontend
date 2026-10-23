# OpsBrain Social

Single repo for the whole social-media product.

| Folder | What | Stack | Run |
| --- | --- | --- | --- |
| `social-frontend/` | Web app | Next.js (port 3001) | `cd social-frontend && npm install && npm run dev` |
| `social-backend/` | API + workers | FastAPI / Celery | see `social-backend/README.md` |
| `social-landing/` | Marketing landing page | TanStack Start / Vite | `cd social-landing && bun install && bun run dev` |

Each folder has its own dependencies, `.env` and lockfile; nothing is shared between them.
