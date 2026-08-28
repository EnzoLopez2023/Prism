# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24-slim AS build

ARG PRISM_BUILD_VERSION=0.0.0-docker
ARG PRISM_BUILD_COMMIT=unknown
ARG PRISM_BUILD_TIME

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install dependencies (native addons like better-sqlite3 need compilation)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
ENV PRISM_BUILD_VERSION=${PRISM_BUILD_VERSION} \
    PRISM_BUILD_COMMIT=${PRISM_BUILD_COMMIT} \
    PRISM_BUILD_TIME=${PRISM_BUILD_TIME}
RUN npm run build

# Prune to production dependencies
RUN npm ci --omit=dev

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd --gid 1001 prism && useradd --uid 1001 --gid prism --shell /bin/false prism

# Re-declare build ARGs so they carry into this stage
ARG PRISM_BUILD_VERSION
ARG PRISM_BUILD_COMMIT
ARG PRISM_BUILD_TIME

WORKDIR /app

# Copy built artifacts
COPY --from=build --chown=prism:prism /build/build ./build
COPY --from=build --chown=prism:prism /build/dist ./dist
COPY --from=build --chown=prism:prism /build/node_modules ./node_modules
COPY --from=build --chown=prism:prism /build/package.json ./package.json

# Ensure /home/data exists for Azure App Service persistent storage mount
RUN mkdir -p /home/data && chown prism:prism /home/data

# Build identity environment (baked at build time, overridable)
ENV PRISM_BUILD_VERSION=${PRISM_BUILD_VERSION} \
    PRISM_BUILD_COMMIT=${PRISM_BUILD_COMMIT} \
    PRISM_BUILD_TIME=${PRISM_BUILD_TIME} \
    NODE_ENV=production \
    PORT=3000

EXPOSE 3000

USER prism

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/server/bootstrap.js"]
