import { TelegramClient } from 'telegram';
import { TelegramConnection } from './TelegramConnection.js';
import { StringSession } from 'telegram/sessions/index.js';
import { env } from '../config/env.js';

export function createTelegramClient(session: string) {
    if (!Number.isInteger(env.tgApiId) || env.tgApiId <= 0 || !env.tgApiHash.trim()) {
        throw new Error('Укажите TG_API_ID и TG_API_HASH в parser/.env');
    }

    const proxyEnabled = process.env.TG_PROXY_ENABLED === 'true';
    const port = Number(process.env.TG_PROXY_PORT);
    if (proxyEnabled && (!process.env.TG_PROXY_HOST?.trim() || !Number.isInteger(port) || port < 1 || port > 65535)) {
        throw new Error('Проверьте TG_PROXY_HOST и TG_PROXY_PORT в parser/.env');
    }

    const telegramSession = new StringSession(session.trim());
    if (!session.trim()) {
        // GramJS defaults to DC 4 on port 80. Use Telegram's TCP port 443
        // for initial authorization through SOCKS5 (this is not HTTPS/WSS).
        telegramSession.setDC(4, '149.154.167.91', 443);
    }

    const client = new TelegramClient(telegramSession, env.tgApiId, env.tgApiHash, {
        connection: TelegramConnection,
        useWSS: false,
        connectionRetries: 5,
        floodSleepThreshold: 0,
        proxy: proxyEnabled ? {
            ip: process.env.TG_PROXY_HOST!.trim(),
            port,
            socksType: 5,
            timeout: 20,
            username: process.env.TG_PROXY_USERNAME || undefined,
            password: process.env.TG_PROXY_PASSWORD || undefined,
        } : undefined,
    });
    client.setLogLevel('error' as Parameters<typeof client.setLogLevel>[0]);
    return client;
}
