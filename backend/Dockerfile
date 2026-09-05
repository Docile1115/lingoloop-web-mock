FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server.mjs policy.mjs gemini.mjs notifications.mjs auth-rate-limit.mjs conversation-read.mjs avatar.mjs room.mjs ./

ENV NODE_ENV=production
ENV PORT=8080

USER node

EXPOSE 8080

CMD ["node", "server.mjs"]
