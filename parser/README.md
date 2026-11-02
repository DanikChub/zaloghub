# Telegram parser

Run commands from this directory so dotenv loads `parser/.env`.

## First login or expired session

1. Set your own `TG_API_ID` and `TG_API_HASH` in `.env` (from https://my.telegram.org).
2. Configure `TG_PROXY_ENABLED`, `TG_PROXY_HOST`, `TG_PROXY_PORT`, and optional
   `TG_PROXY_USERNAME` / `TG_PROXY_PASSWORD` for SOCKS5 if needed.
3. Run `npm ci` and `npm run auth` in an interactive terminal.
4. Enter your phone number, Telegram login code, and 2FA password if requested.
   The command uses the configured proxy and replaces `TG_SESSION` in `.env`
   after successful authorization, preserving other settings. It ignores the old
   session during login. Codes, passwords, and the new session are not printed.
5. Run `npm run build && npm start`.

If Telegram returns FLOOD_WAIT, wait the reported number of seconds before
running authorization again. The command stops on authentication errors rather
than requesting codes repeatedly. Do not run multiple login commands at once.

Normal `npm start` uses the saved session and never requests login codes. If it
is missing or no longer authorized, run `npm run auth` again. Keep `.env` private.
API access requires `SERVER_URL` and `PARSER_TOKEN`; channel sources must exist
in the API database for monitoring to start.
