import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

export const config = {
    redisUrl: process.env.REDIS_URL || "redis://redis:6379",
    sendQueueName: process.env.SEND_QUEUE_NAME || "send-messages",
    incomingQueueName: process.env.INCOMING_QUEUE_NAME || "incoming-messages",
    groupId:
        process.env.GROUP_ID ||
        process.env.ALLOWED_PING_GROUP ||
        "120363339314665620@g.us",
    sessionPath: process.env.SESSION_PATH || ".wwebjs_auth",
    userDataDir: process.env.USER_DATA_DIR || "chrome-data",
    baseDir: __dirname,
};
