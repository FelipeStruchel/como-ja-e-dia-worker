FROM node:18-bookworm AS base
WORKDIR /app

# Chrome deps + redis-tools (para teste eventual)
RUN apt-get update && \
    apt-get install -y --no-install-recommends chromium redis-tools ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3002
CMD ["npm", "start"]
