# Bot

This folder contains the aiogram Telegram bot for `Karpik`.

Responsibilities:

- Telegram ingress
- pairing flow
- user-facing challenge prompts
- delivery of statuses, failures, and attachments

The bot must remain deployable separately from the desktop app.

Docker deployment notes:

- the base server stack does not require the bot
- Telegram ingress is enabled with
  `docker compose --profile telegram up -d --build`
- `KARPIK_TELEGRAM_TOKEN` must be set before enabling the `telegram` profile

