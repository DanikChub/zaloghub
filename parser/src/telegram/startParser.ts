import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { getSources } from '../integrations/api/getSources.js';
import {
    handleTelegramMessage,
    handleTelegramMessageGroup,
} from './handleTelegramMessage.js';
import { ParserSourceConfig } from '../core/types/source-config.js';
import { env } from '../config/env.js';

type ActiveSource = {
    source: ParserSourceConfig;
    handler: (event: any) => Promise<void>;
    eventBuilder: NewMessage;
};

type BufferedAlbum = {
    timer: NodeJS.Timeout;
    messages: any[];
    source: ParserSourceConfig;
};

const activeSources = new Map<number, ActiveSource>();
const albumBuffer = new Map<string, BufferedAlbum>();

const ALBUM_FLUSH_DELAY_MS = 1200;

function getAlbumKey(sourceId: number, groupedId: any): string {
    return `${sourceId}:${groupedId.toString()}`;
}

async function flushAlbum(client: TelegramClient, key: string) {
    const buffered = albumBuffer.get(key);
    if (!buffered) return;

    albumBuffer.delete(key);

    buffered.messages.sort((a, b) => a.id - b.id);

    await handleTelegramMessageGroup(
        client,
        buffered.messages,
        buffered.source,
    );
}

function clearSourceAlbums(sourceId: number) {
    for (const [key, buffered] of albumBuffer.entries()) {
        if (buffered.source.id !== sourceId) continue;

        clearTimeout(buffered.timer);
        albumBuffer.delete(key);
    }
}

async function handleLiveMessage(
    client: TelegramClient,
    msg: any,
    source: ParserSourceConfig,
) {
    if (!msg?.message && !msg?.media) return;

    if (!msg.groupedId) {
        await handleTelegramMessage(client, msg, source);
        return;
    }

    const key = getAlbumKey(source.id, msg.groupedId);
    const existing = albumBuffer.get(key);

    if (existing) {
        existing.messages.push(msg);

        clearTimeout(existing.timer);

        existing.timer = setTimeout(() => {
            flushAlbum(client, key).catch((error) => {
                console.error('flushAlbum failed', {
                    sourceId: source.id,
                    groupedId: msg.groupedId?.toString?.(),
                    error,
                });
            });
        }, ALBUM_FLUSH_DELAY_MS);

        return;
    }

    const timer = setTimeout(() => {
        flushAlbum(client, key).catch((error) => {
            console.error('flushAlbum failed', {
                sourceId: source.id,
                groupedId: msg.groupedId?.toString?.(),
                error,
            });
        });
    }, ALBUM_FLUSH_DELAY_MS);

    albumBuffer.set(key, {
        timer,
        messages: [msg],
        source,
    });
}

async function addSource(client: TelegramClient, source: ParserSourceConfig) {
    if (!source.channelId) return;
    if (activeSources.has(source.id)) return;

    const entityRef = String(source.channelId).startsWith('-100')
        ? String(source.channelId)
        : `-100${source.channelId}`;

    await client.getEntity(entityRef);

    const handler = async (event: any) => {
        await handleLiveMessage(client, event.message, source);
    };

    const eventBuilder = new NewMessage({ chats: [entityRef] });
    client.addEventHandler(handler, eventBuilder);

    activeSources.set(source.id, {
        source,
        handler,
        eventBuilder,
    });

    console.log('listener added:', {
        sourceId: source.id,
        title: source.title,
        entityRef,
        parseImages: source.parseImages,
    });
}

function removeSource(client: TelegramClient, sourceId: number) {
    const active = activeSources.get(sourceId);
    if (!active) return;

    client.removeEventHandler(active.handler, active.eventBuilder);
    activeSources.delete(sourceId);
    clearSourceAlbums(sourceId);

    console.log('listener removed:', sourceId);
}

async function syncSources(client: TelegramClient) {
    const sources = await getSources();
    const nextIds = new Set<number>();

    for (const source of sources) {
        nextIds.add(source.id);

        if (!source.isActive || !source.parseEnabled || !source.channelId) {
            removeSource(client, source.id);
            continue;
        }

        if (!activeSources.has(source.id)) {
            await addSource(client, source);
        }
    }

    for (const sourceId of activeSources.keys()) {
        if (!nextIds.has(sourceId)) {
            removeSource(client, sourceId);
        }
    }
}

export async function startParser() {

    const clientOptions: any = {
        connectionRetries: 5,
    };

    if (process.env.TG_PROXY_ENABLED === 'true') {
        clientOptions.proxy = {
            ip: process.env.TG_PROXY_HOST!,
            port: Number(process.env.TG_PROXY_PORT),
            socksType: 5,
            username: process.env.TG_PROXY_USERNAME,
            password: process.env.TG_PROXY_PASSWORD,
        };
    }

    const client = new TelegramClient(
        new StringSession(env.tgSession),
        Number(env.tgApiId),
        env.tgApiHash,
        clientOptions,
    );

    await client.start({
        phoneNumber: async () => '',
        password: async () => '',
        phoneCode: async () => '',
        onError: (err) => console.error(err),
    });

    console.log('telegram parser started');

    await syncSources(client);

    setInterval(async () => {
        try {
            await syncSources(client);
        } catch (error) {
            console.error('syncSources failed', error);
        }
    }, 30_000);
}
