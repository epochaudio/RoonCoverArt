# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps

WORKDIR /app

# Git is only required while installing GitHub-based npm dependencies.
RUN apk add --no-cache git

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    ROON_PERSIST_PATH=/app/config.json
WORKDIR /app

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node config/default.json ./config/default.json

# Runtime data paths (usually bind-mounted by docker-compose)
RUN mkdir -p /app/images /app/config && \
    printf '{}\n' > /app/config.json && \
    chown -R node:node /app/images /app/config /app/config.json && \
    chmod 755 /app/images && \
    chmod 644 /app/config.json

USER node

EXPOSE 3666

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const http=require('http');const config=require('config');const port=process.env.PORT||(config.has('server.port')?config.get('server.port'):3666);const req=http.get({host:'127.0.0.1',port,path:'/api/pair'},res=>process.exit(res.statusCode<500?0:1));req.setTimeout(3000,()=>{req.destroy();process.exit(1)});req.on('error',()=>process.exit(1));"

CMD ["node", "src/server.js"]
