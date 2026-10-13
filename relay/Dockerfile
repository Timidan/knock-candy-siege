FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit && mkdir /state && chown node:node /state
COPY relay.mjs ./
USER node
CMD ["node", "relay.mjs"]
