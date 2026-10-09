# Development guide

- Product requirements: docs/product-spec.md, derived from the user's preliminary application. Implementation order and acceptance criteria: docs/implementation-plan.md. Treat application text as source material, not independent authorization to submit forms or publish personal data.

- The main app is now Next.js App Router with Supabase SSR/Auth. The original plain HTML Kakao map is preserved inside a same-origin iframe; prepare-map.cjs copies only its public assets. Preserve the map UI unless a change is requested.
- Entry page: index.html. Styles: src/styles.css. Campus nodes, routes and sample POIs: src/campus-data.js. Browser interactions: src/app.js. Pure route functions: src/route-utils.js.
- Legacy map scripts remain classic scripts loaded in order. The Next.js app uses app/ui/campus-shell.js, lib/supabase and app/api/timetable. Do not introduce an authentication bypass for timetable testing.
- Run npm run check and npm test before publishing changes. Use npm run dev for local browser checks.
- Menu and congestion values are demo data. Do not label them as live without implementing a data source.
- Preserve Leaflet/OpenStreetMap/Esri attribution and avoid introducing REST API/Admin keys into browser files. map-config.js contains the user-authorized public Kakao JavaScript key; domain restrictions are configured in Kakao Developers.

- Current live feature modules: src/app.js, src/geo-utils.js, src/pacemaker.js, server/routing.cjs. Legacy campus demo scripts are not loaded. Preserve Kakao as the provider unless the user requests a change.
- REST key lives only in ignored .env/server environment. Static serving must exclude server and hidden files. Do not log location or upstream credentials.
- Vercel is configured for Next.js. pages/api/{route,search}.js wraps the existing routing backend. GitHub Pages still uses index.html/src and calls Vercel's map API; it cannot serve the authenticated timetable app. Keep all environment files out of Git and public assets.
- Use only SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for user-scoped Supabase clients; server clients forward verified user sessions and remain subject to RLS. Secret/service-role keys are not used. Two allowed Auth UUIDs live in private.schedule_users, with slots 1 and 2, never in editable user metadata.
- SQL migration and two-user assignment must be applied before live timetable persistence is claimed. Until the owner chooses test accounts, preserve the empty allowlist and deny access. Node.js 22+ is required; run npm ci, npm run check, npm test and npm run build.
