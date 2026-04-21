import WhatsappWebPkg from "whatsapp-web.js";
import QrCodeTerminal from "qrcode-terminal";
import { log } from "./logger.js";
import { BackendSessionStore } from "./sessionStore.js";

const { Client, RemoteAuth } = WhatsappWebPkg;

export async function createClient() {
    const store = new BackendSessionStore();

    const client = new Client({
        authStrategy: new RemoteAuth({
            clientId: "whatsapp-worker",
            dataPath: "/tmp",
            store,
            backupSyncIntervalMs: 300_000,
        }),
        puppeteer: {
            headless: true,
            executablePath:
                process.env.CHROMIUM_PATH ||
                process.env.PUPPETEER_EXECUTABLE_PATH ||
                "/usr/bin/chromium-browser",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1280,720",
            ],
        },
        restartOnAuthFail: true,
    });

    client.on("qr", (qr) => {
        log("QR Code gerado! Escaneie com seu WhatsApp:", "info");
        log("----------------------------------------", "info");
        QrCodeTerminal.generate(qr, { small: true });
        log("----------------------------------------", "info");
    });

    client.on("loading_screen", (percent, message) => {
        log(`Carregando WhatsApp Web: ${percent}% — ${message}`, "info");
    });

    let readyReceived = false;

    client.on("authenticated", () => {
        log("Autenticado com sucesso!", "success");
    });

    client.on("auth_failure", (msg) => {
        log(`Falha na autenticação: ${msg}`, "error");
    });

    client.on("remote_session_saved", () => {
        log("Sessão salva no banco com sucesso.", "success");
    });

    client.on("ready", () => {
        readyReceived = true;
        log("Cliente WhatsApp pronto e conectado!", "success");
    });

    client.on("change_state", (state) => {
        log(`Estado da conexão mudou: ${state}`, "info");
    });

    client.on("disconnected", (reason) => {
        log(`Cliente desconectado. Motivo: ${reason}`, "warn");
    });

    log("Inicializando cliente WhatsApp...", "info");
    await client.initialize();
    return client;
}
