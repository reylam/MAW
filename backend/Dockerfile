# MAW backend image. Runs on any host that runs containers (Railway, Render, Fly.io, a VPS).
# Build context is the backend/ folder.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application code. scripts/scenarios.json is read at runtime by the simulation runner.
COPY src ./src
COPY scripts/scenarios.json ./scripts/scenarios.json

USER node
EXPOSE 5000

# Hosts inject PORT; fall back to 5000.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
