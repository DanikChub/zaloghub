import { createTelegramClient } from './telegram/createTelegramClient.js';
import { env } from './config/env.js';
import { backfillAllSources } from './telegram/backfillAllSources.js';
import { getSources } from './integrations/api/getSources.js';
import { backfillSource } from './telegram/backfillSources.js';

function getArg(name: string): string | null {
    const prefix = `--${name}=`;
    const arg = process.argv.find((item) => item.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : null;
}

async function run() {
    const months = Number(getArg('months') ?? '2');
    const sourceIdArg = getArg('sourceId');
    const limit = Number(getArg('limit') ?? '50000');
    if (!Number.isInteger(months) || months < 1 || !Number.isInteger(limit) || limit < 1) {
        throw new Error('--months и --limit должны быть положительными целыми числами');
    }
    if (sourceIdArg !== null && (!Number.isInteger(Number(sourceIdArg)) || Number(sourceIdArg) < 1)) {
        throw new Error('--sourceId должен быть положительным внутренним ID источника');
    }
    if (!env.tgSession.trim()) {
        throw new Error('Укажите действующую TG_SESSION в parser/.env');
    }
    const client = createTelegramClient(env.tgSession);
    if (!await client.connect() || !client.connected) {
        throw new Error('Не удалось подключиться к Telegram');
    }
    if (!await client.checkAuthorization()) {
        throw new Error('TG_SESSION недействительна. Сначала выполните авторизацию.');
    }
    // StringSession does not persist channel access hashes. Load subscribed
    // channels into the entity cache before resolving their numeric IDs.
    await client.getDialogs({});

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);

    console.log('🚀 starting backfill...');
    console.log({ months, sourceIdArg, limit, fromDate: fromDate.toISOString() });

    if (sourceIdArg) {
        const sourceId = Number(sourceIdArg);
        const sources = await getSources();
        const source = sources.find((item) => item.id === sourceId);

        if (!source) {
            throw new Error(`Source not found for sourceId=${sourceId}`);
        }

        await backfillSource({
            client,
            source,
            fromDate,
            limit,
            delayMs: 150,
        });
    } else {
        await backfillAllSources({
            client,
            fromDate,
            perSourceLimit: limit,
            delayMs: 150,
        });
    }

    console.log('✅ backfill finished');
    process.exit(0);
}

run().catch((e) => {
    console.error('backfill failed', e);
    process.exit(1);
});
