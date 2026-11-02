import { telegramSourceByChannelId } from '../registry/sourceRegistry.js';
import { RawMessage } from '../types/raw-message.js';

export function buildSourceUrl(raw: RawMessage): string | null {
    if (raw.sourceType === 'telegram') {
        const channelId = raw.sourceChannelId;
        const messageId = raw.externalMessageId;
        console.warn('channelId', channelId);
        console.warn('messageId', messageId);
        if (!channelId || !messageId) return null;

        // если канал есть в реестре
        const source = telegramSourceByChannelId[channelId];

        // всегда используем формат /c/ (универсально)
        const cleanId = channelId.replace('-100', '');

        return `https://t.me/c/${cleanId}/${messageId}`;
    }

    return null;
}
