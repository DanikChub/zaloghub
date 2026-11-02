import { ConnectionTCPObfuscated } from 'telegram/network/index.js';

// GramJS 2.26 hardcodes port 80 in TelegramClient.connect() when useWSS=false,
// ignoring the session's port. Override it at the transport boundary.
export class TelegramConnection extends ConnectionTCPObfuscated {
    constructor(options: ConstructorParameters<typeof ConnectionTCPObfuscated>[0]) {
        super({ ...options, port: 443 });
    }
}
