# Worker (WhatsApp + Fila)

Serviço que conecta ao WhatsApp, publica mensagens recebidas na fila de entrada e envia mensagens consumindo a fila de saída.

## Fluxo
- Recebe mensagem do WhatsApp → publica em `incoming-messages` (com histórico recente).
- Consome jobs de `send-messages` → envia texto/mídia, reply/mentions.
- Logs: console + ingest HTTP para backend (`LOG_INGEST_URL` + `LOG_INGEST_TOKEN`).

## Env principais (`.env`)
- `REDIS_URL=redis://...`
- `SEND_QUEUE_NAME=send-messages`
- `INCOMING_QUEUE_NAME=incoming-messages`
- `LOG_INGEST_URL=http://backend:3000/logs/ingest`
- `LOG_INGEST_TOKEN=<token compartilhado>`
- `GROUP_ID=<id do grupo>`
- `SESSION_PATH=.wwebjs_auth` (persistência da sessão WA)
- `USER_DATA_DIR=chrome-data`
- `TZ=America/Sao_Paulo`

## Rodando local
```bash
npm install
npm start
```
Escaneie o QR no log do worker na primeira execução.

## Docker
```bash
docker build -t worker .
docker run -d --env-file .env \
  -v worker-session:/app/.wwebjs_auth \
  -v worker-chrome:/app/chrome-data \
  worker
```
Lembre de anexar ao mesmo Redis/backend acessível.
