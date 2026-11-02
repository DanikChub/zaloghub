import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createTelegramClient } from './telegram/createTelegramClient.js';

async function main() {
    if (!process.stdin.isTTY) {
        throw new Error('Запустите npm run auth в интерактивном SSH-терминале.');
    }
    const envPath = resolve('.env');
    // Fail before requesting a login code if the configuration file is missing.
    await readFile(envPath, 'utf8');
    let muted = false;
    const output = new Writable({
        write(chunk, _encoding, callback) {
            if (!muted) process.stdout.write(chunk);
            callback();
        },
    });
    const prompt = createInterface({ input: process.stdin, output, terminal: true });
    const ask = async (label: string, secret = false) => {
        process.stdout.write(label);
        muted = secret;
        try {
            const answer = await prompt.question('');
            if (!answer.trim()) throw new Error('Ввод пустой. Авторизация остановлена.');
            return secret ? answer : answer.trim();
        } finally {
            muted = false;
            if (secret) process.stdout.write('\n');
        }
    };
    // A fresh login deliberately ignores a stale TG_SESSION.
    const client = createTelegramClient('');
    try {
        await client.start({
            phoneNumber: () => ask('Телефон в международном формате (+7…): '),
            phoneCode: (viaApp) => ask(viaApp ? 'Код из приложения Telegram: ' : 'Код Telegram: ', true),
            password: () => ask('Пароль двухэтапной аутентификации Telegram: ', true),
            onError: (error) => { throw error; },
        });
        if (!await client.checkAuthorization()) throw new Error('Telegram не подтвердил авторизацию.');
        const session = client.session.save();
        if (typeof session !== 'string' || !session) throw new Error('Не удалось сохранить сессию.');
        const current = await readFile(envPath, 'utf8');
        const updated = current.replace(/^\s*(?:export\s+)?TG_SESSION\s*=.*$/gm, '').trimEnd()
            + `\nTG_SESSION=${session}\n`;
        const tempPath = `${envPath}.auth-${process.pid}.tmp`;
        try {
            await writeFile(tempPath, updated, { mode: 0o600, flag: 'wx' });
            await rename(tempPath, envPath);
        } finally {
            await rm(tempPath, { force: true });
        }
        console.log('Вход выполнен. Новая TG_SESSION сохранена в parser/.env. Запустите npm start.');
    } finally {
        prompt.close();
        await client.disconnect();
    }
}

main().catch((error) => {
    if (typeof error?.seconds === 'number') {
        console.error(`Telegram требует подождать ${error.seconds} секунд. Повторите npm run auth после этой паузы.`);
    } else {
        console.error('Авторизация остановлена:', error?.message || 'Неизвестная ошибка');
    }
    process.exit(1);
});
