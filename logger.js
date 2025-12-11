import { sendLogToIngest } from "./logIngestClient.js";

export function log(message, type = "info", meta = null) {
    const ts = new Date().toISOString();
    const tag =
        {
            info: "[INFO]",
            error: "[ERROR]",
            success: "[SUCCESS]",
            warn: "[WARN]",
        }[type] || "[INFO]";
    const line = `${ts} ${tag} ${message}`;
    console.log(line);
    sendLogToIngest({ source: "worker", level: type, message, meta }).catch(() => {});
}
