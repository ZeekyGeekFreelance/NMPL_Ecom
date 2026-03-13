FROM node:22-alpine

WORKDIR /app

# Install dependencies only — source is mounted as a volume at runtime
COPY package*.json ./
RUN npm ci

# Copy prisma schema so the Prisma client can be generated at image-build time.
COPY prisma ./prisma
RUN npx prisma generate

# Copy load-env.js and other server-side scripts required at runtime.
# This is critical for production builds where source is NOT volume-mounted:
# scripts/load-env.js must be present for nodemon (and ts-node) to pre-load
# environment variables before any TypeScript module is evaluated.
COPY scripts ./scripts

# Remaining source files arrive via docker-compose volume mount (./server:/app)
# in development, so no COPY . . is needed here.
# For production, the Dockerfile.production image handles the full COPY + tsc build.

EXPOSE 5000

# Default CMD — overridden by docker-compose command in development.
CMD ["npm", "run", "dev"]
