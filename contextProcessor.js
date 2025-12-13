import axios from "axios";
import { log } from "./logger.js";
import { redisConnection } from "./queues.js";
import { config } from "./config.js";
import { Worker } from "bullmq";

async function fetchContext({ client, groupId }) {
    const chat = await client.getChatById(groupId);
    const participants =
        chat?.participants ||
        chat?.groupMetadata?.participants ||
        chat?.groupMetadata?.members ||
        [];

    let contactsIndex = new Map();
    try {
        const contacts = await client.getContacts();
        contactsIndex = new Map(
            contacts.map((c) => [c.id?._serialized || c.id || c.number || "", c])
        );
    } catch (err) {
        log(`context: nao foi possivel carregar lista de contatos: ${err.message}`, "warn");
    }

    const idUser = (jid) => {
        if (!jid) return "";
        const parts = jid.toString().split("@")[0];
        return parts || "";
    };

    const bestDisplayName = (contact, jid) => {
        const candidates = [
            contact?.verifiedName,
            contact?.formattedName,
            contact?.pushname,
            contact?.name,
            contact?.shortName,
            contact?.number,
            contact?.id?.user,
            idUser(jid),
        ];
        return candidates.find((c) => c && c.trim()) || "";
    };

    const bestNameFromParticipant = (p) => {
        const candidates = [
            p?.notifyName,
            p?.name,
            p?.pushname,
            p?.shortName,
            p?.id?.user,
        ];
        return candidates.find((c) => c && c.trim()) || "";
    };

    const members = [];
    for (const p of participants) {
        try {
            const jid =
                (typeof p === "string" && p) ||
                p?._serialized ||
                p?.id?._serialized ||
                p?.id;
            if (!jid) continue;

            let contact = null;
            try {
                contact = contactsIndex.get(jid) || contactsIndex.get(idUser(jid));
                if (!contact) contact = await client.getContactById(jid);
            } catch (_) {
                log(`context: nao foi possivel obter contato para ${jid}`, "warn");
            }

            let profilePicUrl = "";
            try {
                profilePicUrl =
                    (await client.getProfilePicUrl(jid)) ||
                    (contact ? await contact.getProfilePicUrl() : "");
            } catch (_) {}

            const name =
                contact?.name ||
                contact?.verifiedName ||
                contact?.formattedName ||
                contact?.pushname ||
                contact?.shortName ||
                contact?.number ||
                contact?.id?.user ||
                bestNameFromParticipant(p) ||
                idUser(jid);
            const pushname =
                contact?.pushname ||
                contact?.name ||
                contact?.formattedName ||
                contact?.shortName ||
                contact?.number ||
                contact?.id?.user ||
                bestNameFromParticipant(p) ||
                "";
            const number = contact?.number || contact?.id?.user || p?.id?.user || idUser(jid);

            members.push({
                id: jid,
                name,
                pushname,
                displayName: bestDisplayName(contact, jid) || bestNameFromParticipant(p),
                number,
                isAdmin: !!(p?.isAdmin || p?.isSuperAdmin),
                profilePicUrl: profilePicUrl || "",
            });
        } catch (err) {
            log(`context: erro ao coletar participante: ${err.message}`, "error");
        }
    }

    const payload = {
        groupId,
        subject: chat?.name || "",
        description: chat?.description || "",
        members,
    };

    const ingestUrl =
        (config.backendPublicUrl || process.env.BACKEND_PUBLIC_URL || "http://backend:3000") +
        "/context/ingest";
    const token = process.env.CONTEXT_INGEST_TOKEN || process.env.LOG_INGEST_TOKEN || "";

    await axios.post(ingestUrl, payload, {
        headers: {
            "x-context-token": token,
        },
    });
    log(`context: enviado para ingest ${members.length} membros do grupo ${groupId}`, "info");
}

export function startContextWorker(client) {
    const worker = new Worker(
        config.groupContextQueueName,
        async (job) => {
            const { groupId } = job.data || {};
            if (!groupId) return;
            await fetchContext({ client, groupId });
        },
        { connection: redisConnection }
    );

    worker.on("failed", (job, err) => {
        log(`Job de contexto ${job?.id} falhou: ${err?.message}`, "error");
    });

    return worker;
}
