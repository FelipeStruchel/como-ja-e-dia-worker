import "dotenv/config";
import { Worker } from "bullmq";
import { log } from "./logger.js";
import { redisConnection, sendQueueName } from "./queues.js";
import { createClient } from "./whatsapp.js";
import { publishIncoming } from "./incomingPublisher.js";
import { processSendJob } from "./sendProcessor.js";
import { startContextWorker } from "./contextProcessor.js";

async function main() {
    const client = await createClient();

    client.on("message", async (msg) => {
        await publishIncoming(msg);
    });

    startContextWorker(client);

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
