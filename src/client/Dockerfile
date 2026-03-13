FROM node:22-alpine

WORKDIR /app

ARG APP_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .

RUN if [ "$APP_ENV" = "production" ]; then npm run build; else echo "Skipping production build for APP_ENV=$APP_ENV"; fi

EXPOSE 3000

# Use `npm run dev` as the default so the container works correctly when
# APP_ENV=development and no build artefact exists.  The docker-compose
# `command` override also sets `npm run dev` explicitly, making this the
# consistent entry-point for both invocation paths.
CMD ["npm", "run", "dev"]
