import { Queue } from "bullmq";
import { config } from "./config.js";

export const incomingQueue = new Queue(config.incomingQueueName, {
    connection: { url: config.redisUrl },
});

export const sendQueueName = config.sendQueueName;
export const redisConnection = { url: config.redisUrl };
