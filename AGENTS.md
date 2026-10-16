<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev`. Verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

Full project rules, schema reference and conventions: `CLAUDE.md` (it also
`@include`s this file). The rules you must never break:

- Never use the Supabase service role key anywhere in this app.
- Never run SQL against the database yourself. Schema changes go in
  `supabase/migrations/<YYYYMMDDHHMM>_<name>.sql` and are run manually in the
  Supabase SQL Editor.
- Every new table enables RLS and ships its policies in the same migration.
  RLS is the security layer; hiding UI is only convenience.
- Client components use `createClient()` from `@/utils/supabase/client`;
  server components, route handlers and actions use `await createClient()`
  from `@/utils/supabase/server`.
- Next.js 16 middleware is `proxy.ts` in the project root, not `middleware.ts`.
- Secrets live in `.env` (git-ignored); the template is `.env.example`.
- Verify with `npm test` (vitest), `npx tsc --noEmit` and `npx eslint .`.
