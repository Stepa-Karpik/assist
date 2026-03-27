import type { ActivityLogEntry, ActivityLogStore } from "./activityLogStore";
import type { LocalChatDetail, LocalChatRecord, LocalChatStore } from "./localChatStore";

export type QuickAccessState = {
  targetChat: LocalChatRecord | null;
  localChatCount: number;
  recentActivity: ActivityLogEntry[];
  recentChats: LocalChatRecord[];
};

export type QuickAccessSubmitResult = {
  chat: LocalChatRecord;
  detail: LocalChatDetail;
};

type QuickAccessRuntimeOptions = {
  chatStore: LocalChatStore;
  activityLogStore: ActivityLogStore;
  sendMessage: (payload: { chatId: string; text: string }) => Promise<LocalChatDetail>;
  recentActivityLimit?: number;
};

function resolveTargetChat(chatStore: LocalChatStore, targetChatId?: string): LocalChatRecord {
  const chats = chatStore.list();

  if (targetChatId) {
    const requestedChat = chats.find((candidate) => candidate.chatId === targetChatId);

    if (requestedChat) {
      return requestedChat;
    }
  }

  return chats[0] ?? chatStore.createDesktopChat();
}

export function createQuickAccessRuntime({
  chatStore,
  activityLogStore,
  sendMessage,
  recentActivityLimit = 5
}: QuickAccessRuntimeOptions) {
  return {
    getState(): QuickAccessState {
      const chats = chatStore.list();

      return {
        targetChat: chats[0] ?? null,
        localChatCount: chats.length,
        recentActivity: activityLogStore.list().slice(0, recentActivityLimit),
        recentChats: chats.slice(0, recentActivityLimit)
      };
    },

    async submitRequest({ chatId, text }: { chatId?: string; text: string }): Promise<QuickAccessSubmitResult> {
      const chat = resolveTargetChat(chatStore, chatId);
      const detail = await sendMessage({
        chatId: chat.chatId,
        text
      });
      const nextChat = chatStore.list().find((candidate) => candidate.chatId === detail.chatId) ?? chat;

      return {
        chat: nextChat,
        detail
      };
    }
  };
}
