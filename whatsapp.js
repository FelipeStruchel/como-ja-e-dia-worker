import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import WhatsappWebPkg from "whatsapp-web.js";
import QrCodeTerminal from "qrcode-terminal";
import { promises as fs } from "fs";
import { config } from "./config.js";
import { log } from "./logger.js";

const { Client, LocalAuth } = WhatsappWebPkg;

function ensureDirs() {
    const sessionDir = join(process.cwd(), config.sessionPath);
    if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });
    const userDataDir = join(process.cwd(), config.userDataDir);
    if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true });
}

async function clearChromeLocks() {
    const targets = [
        join(process.cwd(), config.userDataDir),
        join(process.cwd(), config.userDataDir, "Default"),
        join(process.cwd(), config.sessionPath, "Default"),
    ];
    for (const base of targets) {
        for (const fname of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
            try {
                const f = join(base, fname);
                await fs.rm(f, { force: true });
                log(`Lock removido: ${f}`, "info");
            } catch (_) {}
        }
    }
}

export async function createClient() {
    ensureDirs();
    await clearChromeLocks();

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
        QrCodeTerminal.generate(qr, { small: true });
        log("----------------------------------------", "info");
    });

    client.on("loading_screen", (percent, message) => {
        log(`Carregando WhatsApp Web: ${percent}% — ${message}`, "info");
    });

    let readyReceived = false;

    client.on("authenticated", () => {
        log("Autenticado com sucesso! Sessão salva localmente.", "success");

        if (client.pupPage) {
            client.pupPage.on("error", (err) => {
                log(`Chrome page error: ${err.message}`, "error");
            });
            client.pupPage.on("pageerror", (err) => {
                log(`Chrome JS pageerror: ${err.message}`, "error");
            });
            client.pupPage.on("crash", () => {
                log("Chrome page CRASHED após autenticação!", "error");
            });
        } else {
            log("pupPage não disponível após authenticated (pode indicar múltiplas instâncias)", "warn");
        }

        setTimeout(() => {
            if (!readyReceived) {
                log("TIMEOUT: evento ready não disparou em 90s após authenticated — Chrome pode estar travado ou crashado", "error");
            }
        }, 90_000);
    });

    client.on("auth_failure", (msg) => {
        log(`Falha na autenticação: ${msg}`, "error");
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

    log("Inicializando cliente WhatsApp (abrindo Chrome)...", "info");
    await client.initialize();
    return client;
}
