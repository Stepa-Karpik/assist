type FetchLike = typeof fetch;

type DeepSeekChatResponderOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: FetchLike;
};

type DeepSeekReplyOptions = {
  ownerProfileContext?: string | null;
};

export function createDeepSeekChatResponder({
  apiKey,
  model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  fetchImpl = globalThis.fetch
}: DeepSeekChatResponderOptions) {
  return {
    async reply(text: string, options: DeepSeekReplyOptions = {}): Promise<string> {
      const systemPromptBase =
        "Ты Karpik, краткий русскоязычный desktop-ассистент. Отвечай по-русски, без упоминания DeepSeek.";
      const ownerProfileContext = options.ownerProfileContext?.trim();
      const systemPrompt =
        ownerProfileContext && ownerProfileContext.length > 0
          ? `${systemPromptBase}\n\nКонтекст владельца устройства:\n${ownerProfileContext}`
          : systemPromptBase;

      try {
        const response = await fetchImpl("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: text
              }
            ],
            temperature: 0.3
          })
        });

        if (!response.ok) {
          throw new Error(`DeepSeek request failed: ${response.status}`);
        }

        const payload = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };
        const content = payload.choices?.[0]?.message?.content?.trim();
        if (!content) {
          throw new Error("DeepSeek returned an empty reply");
        }

        return content;
      } catch {
        return "Сейчас не получилось обработать обычный вопрос. Попробуйте ещё раз или уточните запрос.";
      }
    }
  };
}
