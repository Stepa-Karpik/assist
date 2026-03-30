export const telegramBotHandle = "@Desktop_assist_bot";
const telegramBotUsername = "Desktop_assist_bot";

export function buildPairingStartPayload(code: string): string {
  return `pair_${code}`;
}

export function buildPairingStartLink(code: string): string {
  return `https://t.me/${telegramBotUsername}?start=${encodeURIComponent(buildPairingStartPayload(code))}`;
}

export function buildPairingFallbackCommand(code: string): string {
  return `/pair ${code}`;
}
