FROM node:22-alpine

WORKDIR /app

# Install dependencies only — source is mounted as a volume at runtime
COPY package*.json ./
RUN npm ci

# Generate Prisma client from schema
COPY prisma ./prisma
RUN npx prisma generate

# Remaining source files arrive via docker-compose volume mount (./server:/app)
# so no COPY . . or build step needed for development

EXPOSE 5000

# Default CMD — overridden by docker-compose command
CMD ["npm", "run", "dev"]
