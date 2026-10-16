# syntax=docker/dockerfile:1
# Multi-stage build producing a minimal Next.js standalone image.
# NEXT_PUBLIC_* vars are inlined at build time: pass them as --build-arg
# (one image per environment). Server-only secrets are runtime env vars.

FROM node:22-slim AS base

# ---- deps: install node_modules from the lockfile -------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the app --------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time public env (required: the build crashes without the Supabase pair)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL
ARG NEXT_PUBLIC_PRIVACY_CONTACT_PERSON
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL=$NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL \
    NEXT_PUBLIC_PRIVACY_CONTACT_PERSON=$NEXT_PUBLIC_PRIVACY_CONTACT_PERSON \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner: minimal production image ------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Runtime env (set by the platform or compose): GEMINI_API_KEY,
# GEMINI_MODEL, FEEDBACK_SERVER_KEY
CMD ["node", "server.js"]
