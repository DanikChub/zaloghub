import { TelegramClient } from 'telegram';
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

    const client = new TelegramClient(new StringSession(session.trim()), env.tgApiId, env.tgApiHash, {
        connectionRetries: 5,
        floodSleepThreshold: 0,
        proxy: proxyEnabled ? {
            ip: process.env.TG_PROXY_HOST!.trim(),
            port,
            socksType: 5,
            username: process.env.TG_PROXY_USERNAME || undefined,
            password: process.env.TG_PROXY_PASSWORD || undefined,
        } : undefined,
    });
    client.setLogLevel('error' as Parameters<typeof client.setLogLevel>[0]);
    return client;
}
