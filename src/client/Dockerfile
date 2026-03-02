FROM node:22-alpine

WORKDIR /app

ARG APP_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .

RUN if [ "$APP_ENV" = "production" ]; then npm run build; else echo "Skipping production build for APP_ENV=$APP_ENV"; fi

EXPOSE 3000

CMD ["npm", "start"]
