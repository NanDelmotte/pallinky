FROM node:20-alpine AS builder
RUN apk add --no-cache curl
WORKDIR /app

COPY . .
RUN npm ci

ARG APP_VARIANT=production
ARG NEXT_PUBLIC_SUPABASE_URL=https://nfoshumnlfsjtfxkyqrq.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_tV5Yx4MiEokwXvjW15geJQ_9qcV_RI_
ARG SUPABASE_URL=https://nfoshumnlfsjtfxkyqrq.supabase.co
ARG SUPABASE_ANON_KEY=sb_publishable_tV5Yx4MiEokwXvjW15geJQ_9qcV_RI_
ENV APP_VARIANT=$APP_VARIANT
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
ENV NODE_ENV=production

RUN npm run build:$APP_VARIANT --workspace=@pallinky/web

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl wget \
  && wget -O /usr/local/bin/supercronic https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-amd64 \
  && chmod +x /usr/local/bin/supercronic

ARG APP_VARIANT=production
ARG NEXT_PUBLIC_SUPABASE_URL=https://nfoshumnlfsjtfxkyqrq.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_tV5Yx4MiEokwXvjW15geJQ_9qcV_RI_
ARG SUPABASE_URL=https://nfoshumnlfsjtfxkyqrq.supabase.co
ARG SUPABASE_ANON_KEY=sb_publishable_tV5Yx4MiEokwXvjW15geJQ_9qcV_RI_
ENV APP_VARIANT=$APP_VARIANT
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN cat > /app/start.sh <<'EOF'
#!/bin/sh
set -eu
echo "* * * * * curl -fsS -X POST http://127.0.0.1:3000/api/worker/push -H \"x-cron-secret: $CRON_SECRET\"" > /app/crontab
supercronic /app/crontab &
exec node apps/web/server.js
EOF
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]
