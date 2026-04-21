FROM node:18-bookworm AS base
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends redis-tools ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3002
CMD ["npm", "start"]
