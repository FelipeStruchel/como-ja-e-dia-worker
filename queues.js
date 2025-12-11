import { Queue } from "bullmq";
import { config } from "./config.js";

const connection = {
    url: config.redisUrl,
};

export const incomingQueue = new Queue(config.incomingQueueName, {
    connection,
});

export const sendQueueName = config.sendQueueName;
export const redisConnection = connection;
