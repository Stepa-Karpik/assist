# Remote Task Chat Mirroring Slice

1. Add RED coverage for idempotent remote-task mirroring into a continuation
   chat.
2. Extend local chat messages with optional remote-task metadata used for
   dedupe.
3. Add a local chat store API to mirror a remote task update into the linked
   continuation chat.
4. Extract snapshot-diff logic into a dedicated helper used by `main.ts`.
5. Run full desktop verification after wiring the mirror path.
