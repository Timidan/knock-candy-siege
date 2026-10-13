FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit
COPY relay.mjs ./
USER node
CMD ["node", "relay.mjs"]
