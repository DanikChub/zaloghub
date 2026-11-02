import { TelegramClient } from 'telegram';
import { TelegramConnection } from './TelegramConnection.js';
import { StringSession } from 'telegram/sessions/index.js';
import { env } from '../config/env.js';

export function createTelegramClient(session: string) {
    if (!Number.isInteger(env.tgApiId) || env.tgApiId <= 0 || !env.tgApiHash.trim()) {
        throw new Error('Укажите TG_API_ID и TG_API_HASH в parser/.env');
    }

    const proxyEnabled = process.env.TG_PROXY_ENABLED === 'true';
    const proxyType = process.env.TG_PROXY_TYPE?.trim().toLowerCase() || 'socks5';
    const secret = process.env.TG_PROXY_SECRET?.trim() || '';
    const port = Number(process.env.TG_PROXY_PORT);
    if (proxyEnabled && !['socks5', 'mtproto'].includes(proxyType)) {
        throw new Error('TG_PROXY_TYPE должен быть socks5 или mtproto');
    }
    if (proxyEnabled && (!process.env.TG_PROXY_HOST?.trim() || !Number.isInteger(port) || port < 1 || port > 65535)) {
        throw new Error('Проверьте TG_PROXY_HOST и TG_PROXY_PORT в parser/.env');
    }
    if (proxyEnabled && proxyType === 'mtproto') {
        const decoded = Buffer.from(secret, /^[0-9a-f]+$/i.test(secret) ? 'hex' : 'base64');
        if (decoded.length !== 16 && !(decoded.length === 17 && decoded[0] === 0xdd)) {
            throw new Error('TG_PROXY_SECRET: нужен обычный MTProto Secret на 16 байт (hex или base64). Fake-TLS secret не поддерживается этой версией GramJS.');
        }
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
        proxy: !proxyEnabled ? undefined : proxyType === 'mtproto' ? {
            ip: process.env.TG_PROXY_HOST!.trim(),
            port,
            MTProxy: true,
            secret,
        } : {
            ip: process.env.TG_PROXY_HOST!.trim(),
            port,
            socksType: 5,
            timeout: 20,
            username: process.env.TG_PROXY_USERNAME || undefined,
            password: process.env.TG_PROXY_PASSWORD || undefined,
        },
    });
    client.setLogLevel('error' as Parameters<typeof client.setLogLevel>[0]);
    return client;
}
