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
        log("Autenticado com sucesso! Aguardando carregamento do WhatsApp Web...", "success");

        const page = client.pupPage;
        if (page) {
            page.on("error", (err) => log(`Chrome page error: ${err.message}`, "error"));
            page.on("pageerror", (err) => log(`Chrome JS pageerror: ${err.message}`, "error"));
            page.on("crash", () => log("Chrome page CRASHED após autenticação!", "error"));
            page.on("console", (msg) => {
                if (msg.type() === "error") log(`Chrome console error: ${msg.text()}`, "warn");
            });

            setTimeout(async () => {
                try {
                    const url = page.url();
                    const title = await page.title();
                    const bodySnippet = await page.evaluate(() =>
                        document.body?.innerText?.slice(0, 300)?.replace(/\n/g, " ") || "(vazio)"
                    );
                    log(`[diagnóstico] URL: ${url} | título: ${title}`, "info");
                    log(`[diagnóstico] corpo: ${bodySnippet}`, "info");
                } catch (err) {
                    log(`[diagnóstico] erro ao inspecionar página: ${err.message}`, "warn");
                }
            }, 10_000);
        }
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

    const READY_TIMEOUT_MS = 3 * 60 * 1000;
    const readyPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout: evento ready não disparou em ${READY_TIMEOUT_MS / 1000}s — Chrome pode ter travado`));
        }, READY_TIMEOUT_MS);

        client.once("ready", () => { clearTimeout(timer); resolve(); });
        client.once("auth_failure", (msg) => { clearTimeout(timer); reject(new Error(`auth_failure: ${msg}`)); });
    });

    await client.initialize();
    await readyPromise;

    return client;
}
