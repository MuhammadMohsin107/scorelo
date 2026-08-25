# Scorelo

Store optimization dashboard for Shopify merchants. The project contains a React frontend with realistic mock data and an Express/Drizzle/PostgreSQL backend foundation.

## Project Status

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, and React Router 7.
- Available areas: Dashboard, SEO, Content, Speed, CRO, AI Discovery, Fix Center, Integrations, Reports, Settings, and Notifications.
- Frontend data is currently mock/local state and is not connected to backend feature APIs.
- Backend currently exposes database-aware health checking only. Authentication, authorization, and CRUD APIs are not implemented.
- Frontend build and TypeScript diagnostics currently pass.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL when running the backend

## Repository Layout

```text
scorelo2/
	frontend/                 React app and production server
		src/components/         Shared UI components
		src/data/               Mock data and repositories
		src/layouts/            Application shell
		src/pages/              Route-level screens
		server.cjs              Static SPA server for Node hosting
	backend/                  Express + Drizzle API foundation
		src/server.ts           API entry point
		src/routes/health.ts    Database-aware health endpoint
		src/db/schema.ts        PostgreSQL schema
		drizzle/                SQL migrations
	SEO_IMPLEMENTATION_GUIDE.js
	skills-lock.json
```

## Frontend Setup

```powershell
Set-Location "M:\projects\scorelo2\frontend"
npm ci
npm run dev
```

Vite normally serves the app at `http://localhost:5173`.

```powershell
npm run dev       # Start Vite
npm run build     # Type-check and create frontend/dist
npm run preview   # Preview the build
npm run start     # Serve frontend/dist with server.cjs
```

The custom server reads `PORT` and defaults to port `3002`.

## Backend Setup

Create `backend/.env`:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

Then run:

```powershell
Set-Location "M:\projects\scorelo2\backend"
npm ci
npm run db:migrate
npm run dev
```

Backend commands:

```powershell
npm run dev          # Start API with watch mode
npm run start        # Start API once
npm run typecheck    # Run TypeScript checks
npm run db:generate  # Generate a Drizzle migration
npm run db:migrate   # Apply migrations
```

Health endpoint: `GET http://localhost:5000/api/health`. It returns `200` when PostgreSQL is reachable and `503` otherwise.

## Frontend Routes

| Area         | Routes                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard    | `/`                                                                                                                                                                                    |
| SEO overview | `/seo`                                                                                                                                                                                 |
| SEO details  | `/seo/title-tags`, `/seo/meta-descriptions`, `/seo/schema`, `/seo/image-alt-text`, `/seo/canonicals`, `/seo/handles-redirects`, `/seo/sitemap`, `/seo/internal-links`                  |
| Content      | `/content`, `/content/product-descriptions`, `/content/collection-descriptions`, `/content/metafields`, `/content/dup-templated`, `/content/blog-freshness`, `/content/media-richness` |
| Speed        | `/speed`, `/speed/cwv`, `/speed/image-weight`, `/speed/app-bloat`, `/speed/theme-weight`                                                                                               |
| CRO          | `/cro`, `/cro/:subPillar`                                                                                                                                                              |
| AI Discovery | `/ai-discovery`, `/ai-discovery/agents-md`, `/ai-discovery/agentic-attrs`, `/ai-discovery/answerable-qa`, `/ai-discovery/feed`                                                         |
| Operations   | `/fix-center`, `/integrations`, `/reports`, `/settings`, `/settings/:section`, `/notifications`                                                                                        |

## Main Features

- Store score and pillar health overview
- Eight SEO sub-pillar analyses with findings, evidence, filters, and recommendations
- Content, Speed, CRO, and AI Discovery sub-pillar dashboards
- Fix Center with finding search, filtering, review states, and detail drawers
- Integration connection-state workflow simulation
- Reports with period controls, comparisons, and CSV export
- Browser-local page settings
- Responsive sidebar navigation and application shell

## Deployment

### Static Hosting

```powershell
Set-Location "M:\projects\scorelo2\frontend"
npm ci
npm run build
```

Upload the contents of `frontend/dist` to the domain document root. Apache hosting needs SPA fallback so frontend routes serve `index.html`:

```apache
<IfModule mod_rewrite.c>
	RewriteEngine On
	RewriteBase /
	RewriteCond %{REQUEST_FILENAME} -f [OR]
	RewriteCond %{REQUEST_FILENAME} -d
	RewriteRule ^ - [L]
	RewriteRule ^ index.html [L]
</IfModule>
```

### cPanel Node.js App

Upload `server.cjs`, `package.json`, `package-lock.json`, and `dist/` into the application root. Use Node.js 20 or newer, Production mode, and `server.cjs` as the startup file.

```bash
cd ~/scorelo-frontend
npm ci --omit=dev
```

Restart the cPanel app after installation. Do not set a fixed `PORT`; cPanel provides it. Do not build on a server where dev dependencies were omitted. Do not configure the same domain as both a static document root and a Node.js proxy.

## Data and Persistence

Frontend mock data is under `frontend/src/data`. The UI simulates network latency and some workflows with React state or `localStorage`.

The backend schema includes users, stores, audits, audit scores, findings, and integrations. The next product step is to add authenticated API routes and replace mock repositories with API calls. Reports and recommendations should remain derived from persisted audits and findings.

## Known Limitations

- No authentication, authorization, sessions, or multi-tenant isolation.
- Feature APIs and frontend API integration are not implemented.
- Fixes, integration changes, and finding statuses are not persisted to PostgreSQL.
- No automated test suite or frontend test script.
- Deep-link refresh behavior and a catch-all not-found route need hardening before production.
- Some visible workflow controls are simulations rather than connected operations.

## Verification

```powershell
Set-Location "M:\projects\scorelo2\frontend"
npm ci
npm run build

Set-Location "M:\projects\scorelo2\backend"
npm ci
npm run typecheck
```

Manually verify `/`, `/seo`, `/seo/schema`, `/settings`, `/reports`, responsive layouts, navigation, filters, drawers, CSV export, and deep-route refresh.

## License

No license file is currently included.
"# scorelo"
