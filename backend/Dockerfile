# ---- stage 1: install production dependencies only ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- stage 2: small runtime image ----
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
