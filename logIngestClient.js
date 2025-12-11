import axios from "axios";
import { log } from "./logger.js";

const ingestUrl = process.env.LOG_INGEST_URL;
const ingestToken = process.env.LOG_INGEST_TOKEN;

export async function sendLogToIngest({ source = "worker", level = "info", message, meta }) {
    if (!ingestUrl || !ingestToken) return;
    try {
        await axios.post(
            ingestUrl,
            { source, level, message, meta },
            {
                headers: {
                    "x-log-token": ingestToken,
                },
                timeout: 5000,
            }
        );
    } catch (err) {
        log(`Falha ao enviar log para ingest: ${err.message}`, "warn");
    }
}
