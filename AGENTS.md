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
- Vercel is configured for Next.js. pages/api/{walk,search}.js wraps the existing routing backend. Keep the walking endpoint named /api/walk: Vercel incorrectly launched pages/api/route.js as an App Router module, causing MODULE_NOT_FOUND in production. /api/route is a compatibility rewrite to /api/walk. GitHub Pages still uses index.html/src and calls Vercel's map API; it cannot serve the authenticated timetable app. Keep all environment files out of Git and public assets.
- Use only SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for user-scoped Supabase clients; server clients forward verified user sessions and remain subject to RLS. Secret/service-role keys are not used. All registered, non-banned Auth members may access only their own timetable rows. Eligibility is checked against auth.users, never editable user metadata. The former private.schedule_users table is retained only for rollback.
- Apply the timetable migrations, including class_route_favorites, before claiming live persistence. The user requested username/password signup without verification mail: Confirm email is disabled, usernames normalize to reserved accounts.knupass.invalid identifiers, and Supabase auto-confirms registration. Preserve owner isolation. Node.js 22+ is required; run npm ci, npm run check, npm test and npm run build.
- Daegu mobility: server/mobility.cjs, server/meals.cjs, src/mobility.js and src/mobility-utils.js. DAEGU_BUS_API_KEY is server-only. Keep real-time arrival timestamps and stale handling; never claim timetable data is real-time or incomplete walking connections are full door-to-door coverage. Setup and current upstream limitations: docs/mobility-setup.md.
- Photo imports use browser-local OCR and require review before one atomic owner-scoped save. Keep images and Everytime credentials out of server/storage. Preserve distinct actual/display finish times and require verified place coordinates for ambiguous buildings. See docs/timetable-photo-import.md and apply the timetable_import_details migration before deployment.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
