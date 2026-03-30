type FetchLike = typeof fetch;

type DeepSeekChatResponderOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: FetchLike;
};

type DeepSeekReplyOptions = {
  ownerProfileContext?: string | null;
  knowledgeContext?: string | null;
};

export function createDeepSeekChatResponder({
  apiKey,
  model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  fetchImpl = globalThis.fetch
}: DeepSeekChatResponderOptions) {
  return {
    async reply(text: string, options: DeepSeekReplyOptions = {}): Promise<string> {
      const systemPromptBase =
        "Ты Karpik, естественный русскоязычный персональный ассистент. Отвечай по-русски, спокойно и по делу, без роботизированных формулировок и без упоминания DeepSeek. Когда это уместно, заверши ответ одним коротким следующим полезным шагом.";
      const ownerProfileContext = options.ownerProfileContext?.trim();
      const knowledgeContext = options.knowledgeContext?.trim();
      const systemPrompt =
        [
          systemPromptBase,
          ownerProfileContext && ownerProfileContext.length > 0
            ? `Контекст владельца устройства:\n${ownerProfileContext}`
            : null,
          knowledgeContext && knowledgeContext.length > 0
            ? `Релевантные заметки из локальной базы знаний:\n${knowledgeContext}`
            : null
        ]
          .filter(Boolean)
          .join("\n\n");

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
        return "Не смог сразу нормально ответить. Попробуй уточнить запрос, и я разберу его по шагам.";
      }
    }
  };
}
