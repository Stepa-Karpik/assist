# Continuation Chat Reuse Slice

1. Add RED coverage proving repeated continuation creation for one Telegram chat
   returns the same local chat record.
2. Reuse the existing continuation chat in `LocalChatStore`.
3. Refresh `updatedAt` and metadata without losing messages.
4. Run focused store tests, then full desktop verification.
