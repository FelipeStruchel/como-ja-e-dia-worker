import "dotenv/config";
import { Worker } from "bullmq";
import { config } from "./config.js";
import { log } from "./logger.js";
import { redisConnection, sendQueueName } from "./queues.js";
import { createClient } from "./whatsapp.js";
import { publishIncoming } from "./incomingPublisher.js";
import { processSendJob } from "./sendProcessor.js";

async function main() {
    const client = await createClient();

    // Info: qual Redis estamos usando
    log(`Redis URL: ${process.env.REDIS_URL || "(default redis://localhost:6379)"}`, "info");

    client.on("message", async (msg) => {
        await publishIncoming(msg);
    });

    const sendWorker = new Worker(
        sendQueueName,
        async (job) => processSendJob({ client, job }),
        { connection: redisConnection }
    );

    sendWorker.on("failed", (job, err) => {
        log(`Job ${job?.id} falhou: ${err?.message}`, "error");
    });

    sendWorker.on("completed", (job) => {
        log(`Job ${job?.id} concluído`, "info");
    });
}

main().catch((err) => {
    log(`Erro fatal no worker: ${err.message}`, "error");
    process.exit(1);
});
