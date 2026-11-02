import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Api } from 'telegram';
import { env } from './config/env.js';
import { createTelegramClient } from './telegram/createTelegramClient.js';

const handlers = [
    ['zalog-doveriya', 'Залог Доверия'],
    ['aktiv-kapital', 'Актив Капитал'],
    ['fin-expert', 'Финансовый Эксперт'],
    ['mosinvestfinance', 'Мос Инвест Финанс'],
    ['kredit-consult', 'Кредит Консалт'],
    ['air-if', 'Air IF'],
] as const;

const literal = (value: string) => "'" + value.replace(/'/g, "''") + "'";

async function run() {
    if (!process.stdin.isTTY) throw new Error('Запустите npm run sources:setup в интерактивном терминале.');
    if (!env.tgSession.trim()) throw new Error('Укажите TG_SESSION в parser/.env');
    const client = createTelegramClient(env.tgSession);
    const input = createInterface({ input: process.stdin, output: process.stdout });
    const timeout = setTimeout(() => {
        console.error('Подключение к Telegram заняло больше 60 секунд. Проверьте VPN/прокси.');
        process.exit(1);
    }, 60_000);

    try {
        console.log('Подключение и загрузка списка каналов…');
        if (!await client.connect() || !client.connected) throw new Error('Нет соединения с Telegram');
        if (!await client.checkAuthorization()) throw new Error('TG_SESSION недействительна');
        const dialogs = await client.getDialogs({});
        clearTimeout(timeout);
        const channels = dialogs.map(dialog => dialog.entity)
            .filter((entity): entity is Api.Channel => entity instanceof Api.Channel);

        channels.forEach((entity, index) => {
            console.log(`${index + 1}. ${entity.title} | ${entity.username ? '@' + entity.username : 'приватный'} | -100${entity.id}`);
        });
        console.log('\nДля каждого обработчика укажите номер из списка или @username / https://t.me/username.');
        console.log('Enter — пропустить. Не выбирайте произвольный канал: обработчик рассчитан на формат своего источника.');

        const statements: string[] = [];
        const selectedIds = new Set<string>();
        for (const [key, label] of handlers) {
            while (true) {
                const answer = (await input.question(`${label} (${key}): `)).trim();
                if (!answer) break;
                try {
                    let entity: Api.Channel;
                    if (/^\d+$/.test(answer)) {
                        const selected = channels[Number(answer) - 1];
                        if (!selected) throw new Error('Нет такого номера в списке');
                        entity = selected;
                    } else {
                        const username = answer.replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').replace(/\/$/, '');
                        if (!/^[a-zA-Z0-9_]+$/.test(username)) throw new Error('Укажите @username или номер из списка; приватный канал выбирайте из списка');
                        const resolved = await client.getEntity(username);
                        if (!(resolved instanceof Api.Channel)) throw new Error('Это не Telegram-канал');
                        entity = resolved;
                    }
                    const peerId = `-100${entity.id}`;
                    if (selectedIds.has(peerId)) throw new Error('Этот канал уже выбран для другого обработчика');
                    const url = entity.username ? `https://t.me/${entity.username}` : null;
                    statements.push(`INSERT INTO sources (name, type, key, "externalId", title, url, "isActive", "parseEnabled", "parseImages", "createdAt", "updatedAt")
VALUES (${literal(entity.title)}, 'telegram_channel', ${literal(key)}, ${literal(peerId)}, ${literal(entity.title)}, ${url ? literal(url) : 'NULL'}, true, true, true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, "externalId" = EXCLUDED."externalId", title = EXCLUDED.title, url = EXCLUDED.url, "isActive" = true, "parseEnabled" = true, "parseImages" = true, "updatedAt" = NOW();`);
                    selectedIds.add(peerId);
                    console.log(`Выбрано: ${key} → ${entity.title} → ${peerId}`);
                    break;
                } catch (error: any) {
                    if (typeof error?.seconds === 'number') throw error;
                    console.error(error?.message || 'Не удалось найти канал. Попробуйте ещё раз.');
                }
            }
        }
        if (!statements.length) throw new Error('Ни одного канала не выбрано; файл не создан');
        const path = resolve('sources-setup.sql');
        await writeFile(path, 'SET standard_conforming_strings = on;\nBEGIN;\n' + statements.join('\n\n') + '\nCOMMIT;\n', 'utf8');
        console.log(`\nГотово: ${statements.length} источников. SQL сохранён: ${path}`);
        console.log('На сервере из папки parser примените: sudo -u postgres psql -v ON_ERROR_STOP=1 -d zaloghub < sources-setup.sql');
        console.log('До применения SQL база не изменена.');
    } finally {
        clearTimeout(timeout);
        input.close();
        await client.disconnect();
    }
}

run().catch(error => {
    console.error('Настройка остановлена:', error?.message || 'Неизвестная ошибка');
    process.exit(1);
});
