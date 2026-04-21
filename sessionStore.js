import axios from "axios";
import { promises as fs } from "fs";
import { log } from "./logger.js";

const baseUrl = (process.env.BACKEND_URL || "http://backend:3000").replace(/\/+$/, "");

export class BackendSessionStore {
    async sessionExists({ session }) {
        try {
            await axios.head(`${baseUrl}/whatsapp-session/${encodeURIComponent(session)}`);
            return true;
        } catch {
            return false;
        }
    }

    async save({ session }) {
        const zipPath = `${session}.zip`;
        let data;
        try {
            data = await fs.readFile(zipPath);
        } catch (err) {
            if (err.code === "ENOENT") {
                log(`Zip da sessão não encontrado em ${zipPath} — provável race condition, ignorando`, "warn");
                return;
            }
            throw err;
        }
        await axios.put(`${baseUrl}/whatsapp-session/${encodeURIComponent(session)}`, data, {
            headers: { "Content-Type": "application/octet-stream" },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });
        log(`Sessão ${session} salva no banco (${(data.length / 1024).toFixed(1)} KB)`, "success");
    }

    async extract({ session, path: zipPath }) {
        const resp = await axios.get(
            `${baseUrl}/whatsapp-session/${encodeURIComponent(session)}`,
            { responseType: "arraybuffer" }
        );
        await fs.writeFile(zipPath, Buffer.from(resp.data));
        log(`Sessão ${session} restaurada do banco`, "success");
    }

    async delete({ session }) {
        try {
            await axios.delete(`${baseUrl}/whatsapp-session/${encodeURIComponent(session)}`);
            log(`Sessão ${session} removida do banco`, "info");
        } catch (_) {}
    }
}
