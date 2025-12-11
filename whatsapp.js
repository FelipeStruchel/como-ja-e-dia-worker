import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import WhatsappWebPkg from "whatsapp-web.js";
import { config } from "./config.js";
import { log } from "./logger.js";

const { Client, LocalAuth } = WhatsappWebPkg;

function ensureDirs() {
    const sessionDir = join(process.cwd(), config.sessionPath);
    if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });
    const userDataDir = join(process.cwd(), config.userDataDir);
    if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true });
}

export async function createClient() {
    ensureDirs();

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: "whatsapp-worker",
            dataPath: join(process.cwd(), config.sessionPath),
        }),
        puppeteer: {
            headless: true,
            executablePath:
                process.env.CHROMIUM_PATH ||
                process.env.PUPPETEER_EXECUTABLE_PATH ||
                "/usr/bin/chromium-browser",
            args: [
                `--user-data-dir=${join(process.cwd(), config.userDataDir)}`,
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
        // eslint-disable-next-line no-console
        console.log(qr);
        log("----------------------------------------", "info");
    });

    client.on("ready", () => {
        log("Cliente WhatsApp conectado!", "success");
    });

    await client.initialize();
    return client;
}
