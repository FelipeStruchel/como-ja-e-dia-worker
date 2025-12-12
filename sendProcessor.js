import axios from "axios";
import mime from "mime-types";
import WhatsappWebPkg from "whatsapp-web.js";
import { config } from "./config.js";
import { log } from "./logger.js";

const { MessageMedia } = WhatsappWebPkg;

async function downloadMediaToMessageMedia(url) {
    const resp = await axios.get(url, { responseType: "arraybuffer" });
    const contentType =
        resp.headers["content-type"] || mime.lookup(url) || "application/octet-stream";
    const base64 = Buffer.from(resp.data, "binary").toString("base64");
    return new MessageMedia(contentType, base64, "file");
}

async function buildMessage(jobData) {
    const { type, content, caption } = jobData;
    if (type === "text") {
        return { payload: content };
    }
    let source = content || "";
    if (source.startsWith("http")) {
        // URL completa
        const media = await downloadMediaToMessageMedia(source);
        const opts = caption ? { caption } : {};
        return { payload: media, opts };
    }
    // Se vier relativo, prefixa BACKEND_PUBLIC_URL se existir
    if (source.startsWith("/") && process.env.BACKEND_PUBLIC_URL) {
        const base = process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, "");
        const url = `${base}${source}`;
        const media = await downloadMediaToMessageMedia(url);
        const opts = caption ? { caption } : {};
        return { payload: media, opts };
    }
    // Caso contrário, tenta como caminho de arquivo (strip query se tiver)
    const localPath = source.split("?")[0];
    const media = MessageMedia.fromFilePath(localPath);
    const opts = caption ? { caption } : {};
    return { payload: media, opts };
}

export async function processSendJob({ client, job }) {
    const data = job.data || {};
    const groupId = data.groupId || config.groupId;
    if (!groupId) throw new Error("groupId ausente no job");

    if (!client.pupPage) throw new Error("WhatsApp não está pronto");

    const { payload, opts = {} } = await buildMessage(data);
    if (data.replyTo) opts.quotedMessageId = data.replyTo;
    if (Array.isArray(data.mentions) && data.mentions.length) {
        const contacts = [];
        for (const raw of data.mentions) {
            console.log(raw);
            let id = null;
            if (typeof raw === "string") id = raw;
            else if (raw?._serialized) id = raw._serialized;
            else if (raw?.id?._serialized) id = raw.id._serialized;
            else if (raw?.id) id = raw.id;
            if (!id) continue;
            try {
                const c = await client.getContactById(id);
                if (c) contacts.push(c);
            } catch (_) {}
        }
        if (contacts.length) opts.mentions = contacts;
    }
    await client.sendMessage(groupId, payload, opts);
    log(`Job ${job.id} enviado para ${groupId}`, "success");
}
