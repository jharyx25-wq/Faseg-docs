# FASEG DOCS

A French-language academic resource platform for FASEG students and professors in Benin, with searchable course documents and university announcements.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/faseg-docs run dev` — run the FASEG DOCS web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/faseg-docs/` — French-language student library and teacher dashboard
- `artifacts/api-server/src/routes/` — document, announcement, teacher-session, and dashboard APIs
- `lib/db/src/schema/` — PostgreSQL tables for document metadata and announcements
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated hooks
- Uploaded PDF and image files — persistent Replit App Storage; PostgreSQL stores metadata and object paths

## Architecture decisions

- Course files live in App Storage, while searchable document metadata and announcements live in PostgreSQL.
- The teacher dashboard uses a shared teacher password stored as a server-side secret; sessions use a signed, HTTP-only cookie.
- Students access files through a document record and a server download route, not by exposing storage credentials or bucket paths.

## Product

- Students can search and filter course files by subject, academic level, and semester; browse academic announcements and schedules; download materials; and share links through WhatsApp.
- Professors can sign in to publish, edit, and remove course materials and academic announcements.

## User preferences

- The interface language is French.
- Use a professional university look with dark navy blue, white, and gold, responsive on Android phones and computers.

## Gotchas

- Only teacher routes may generate upload URLs or mutate published documents and announcements.
- Keep the shared teacher password and session signing secret in Replit Secrets; never place either in browser code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
