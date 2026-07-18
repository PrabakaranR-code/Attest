# Attest — stateless verified web capture engine.
# linux/amd64 + linux/arm64 friendly (Playwright ships Chromium for both).
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
    ATTEST_KEY_DIR=/data/keys \
    PORT=8080 \
    HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY .list-cache ./.list-cache
RUN groupadd -r attest && useradd -r -g attest -m attest \
    && mkdir -p /data/keys \
    && chown -R attest:attest /data /app /opt/pw-browsers
USER attest
VOLUME /data
EXPOSE 8080
CMD ["node", "dist/server.js"]
