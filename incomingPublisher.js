import { log } from "./logger.js";
import { incomingQueue } from "./queues.js";

export async function publishIncoming(msg) {
    try {
        if (!msg || typeof msg.getChat !== "function") return;

        const chat = await msg.getChat();
        const rawParticipants =
            chat?.participants ||
            chat?.groupMetadata?.participants ||
            chat?.groupMetadata?.members ||
            [];
        const participants = (rawParticipants || [])
            .map((p) => {
                if (typeof p === "string") return p;
                if (p?._serialized) return p._serialized;
                if (p?.id?._serialized) return p.id._serialized;
                if (p?.id) return p.id;
                return null;
            })
            .filter(Boolean);
        let recentMessages = [];
        try {
            const fetched = await chat.fetchMessages({ limit: 50 });
            recentMessages = (fetched || [])
                .map((m) => ({
                    id: m.id?._serialized || m.id,
                    from: m.from,
                    author: m.author || null,
                    body: m.body || "",
                    timestamp: m.timestamp ? m.timestamp * 1000 : Date.now(),
                    fromMe: !!m.fromMe,
                    type: m.type || "chat",
                }))
                .filter((m) => m.body);
        } catch (_) {
            // ignore fetch errors
        }

        const payload = {
            id: msg.id?._serialized || msg.id,
            from: msg.from,
            author: msg.author || null,
            body: msg.body || "",
            timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
            fromMe: !!msg.fromMe,
            isGroup:
                !!msg.isGroupMsg ||
                !!(chat && chat.isGroup) ||
                !!((msg.from || "").endsWith("@g.us")),
            participants,
            recentMessages,
        };
        await incomingQueue.add("incoming", payload, {
            removeOnComplete: true,
            removeOnFail: 50,
        });
    } catch (err) {
        log(`Falha ao enfileirar mensagem recebida: ${err.message}`, "error");
    }
}
