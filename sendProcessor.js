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
    const media = content.startsWith("http")
        ? await downloadMediaToMessageMedia(content)
        : MessageMedia.fromFilePath(content);
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
        for (const id of data.mentions) {
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
