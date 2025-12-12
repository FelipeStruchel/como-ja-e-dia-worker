import { Queue } from "bullmq";
import { config } from "./config.js";

const connection = {
    host: config.redisHost,
    port: config.redisPort,
};

export const incomingQueue = new Queue(config.incomingQueueName, {
    connection,
});

export const groupContextQueue = new Queue(config.groupContextQueueName, {
    connection,
});

export const sendQueueName = config.sendQueueName;
export const redisConnection = connection;
