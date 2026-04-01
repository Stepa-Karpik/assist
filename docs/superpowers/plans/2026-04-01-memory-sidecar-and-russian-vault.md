# Memory Sidecar And Russian Vault Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve local long-term memory extraction and promotion so rich conversational self-description updates multiple Russian-only vault notes without affecting the chat reply path.

**Architecture:** Keep the assistant reply path unchanged and build richer memory extraction, promotion, and markdown writing entirely as a background sidecar. Normalize the visible markdown vault to Russian-only labels and split permanent profile/preferences from temporary observations.

**Tech Stack:** TypeScript, Electron main process, Vitest, local markdown vault writer, existing knowledge sidecar pipeline.

---

### Task 1: Cover the missing memory cases with failing tests

**Files:**
- Modify: `desktop/src/main/chatMemoryExtractor.test.ts`
- Modify: `desktop/src/main/knowledgeBackgroundWriter.test.ts`
- Modify: `desktop/src/main/knowledgeIngestDecider.test.ts`

- [ ] **Step 1: Write failing extractor tests for rich self-description**

Add tests that require extracting:
- education
- course/year
- personal project intent
- hobby `osu`
- career preference
- values
- calm life-period observation

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm run test -- chatMemoryExtractor knowledgeBackgroundWriter knowledgeIngestDecider`
Expected: failing tests for missing extraction and Russian formatting

- [ ] **Step 3: Write failing writer tests for Russian-only note content**

Add tests proving notes use Russian labels instead of mixed English/Russian keys.

- [ ] **Step 4: Run focused tests again**

Run: `npm run test -- chatMemoryExtractor knowledgeBackgroundWriter knowledgeIngestDecider`
Expected: failures remain, but now fully capture required behavior

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/chatMemoryExtractor.test.ts desktop/src/main/knowledgeBackgroundWriter.test.ts desktop/src/main/knowledgeIngestDecider.test.ts
git commit -m "test: cover rich memory extraction cases"
```

### Task 2: Expand memory extraction and classification

**Files:**
- Modify: `desktop/src/main/chatMemoryExtractor.ts`
- Modify: `desktop/src/main/memoryModel.ts`
- Modify: `desktop/src/main/chatPlan.ts`

- [ ] **Step 1: Extend extractor with new explicit fields**

Implement extraction for:
- university
- department / faculty
- course/year
- current activity
- hobbies
- goals
- values
- career preference
- life-period observations

- [ ] **Step 2: Normalize extracted categories**

Ensure candidates map cleanly into:
- `assist/profile`
- `assist/preferences`
- `assist/observations`

- [ ] **Step 3: Run focused extractor tests**

Run: `npm run test -- chatMemoryExtractor`
Expected: passing extractor tests

- [ ] **Step 4: Commit**

```bash
git add desktop/src/main/chatMemoryExtractor.ts desktop/src/main/memoryModel.ts desktop/src/main/chatPlan.ts
git commit -m "feat: expand conversational memory extraction"
```

### Task 3: Split permanent memory from observations in the writer

**Files:**
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
- Modify: `desktop/src/main/knowledgeWriter.ts`

- [ ] **Step 1: Replace mixed labels with Russian-only labels**

Map visible note entries to Russian labels only.

- [ ] **Step 2: Write to multiple structured files**

Route extracted writes to:
- `assist/profile/Личность.md`
- `assist/profile/Образование.md`
- `assist/profile/Деятельность.md`
- `assist/profile/Устройства и железо.md`
- `assist/preferences/...`
- `assist/observations/...`

- [ ] **Step 3: Keep writes idempotent**

Ensure repeated extractions append/update without duplicating entries.

- [ ] **Step 4: Run focused writer tests**

Run: `npm run test -- knowledgeBackgroundWriter`
Expected: passing writer tests with Russian-only output

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/knowledgeBackgroundWriter.ts desktop/src/main/knowledgeWriter.ts
git commit -m "feat: normalize vault writes to structured Russian notes"
```

### Task 4: Tighten the ingest decider for self-description conversations

**Files:**
- Modify: `desktop/src/main/knowledgeIngestDecider.ts`
- Modify: `desktop/src/main/localChatRuntime.ts`

- [ ] **Step 1: Expand knowledge-worthiness rules**

Treat rich self-description and explicit memory-oriented conversation as worth recording even without docs URLs.

- [ ] **Step 2: Preserve background-only behavior**

Do not let sidecar failures affect reply generation.

- [ ] **Step 3: Run focused integration tests**

Run: `npm run test -- knowledgeIngestDecider localChatRuntime`
Expected: passing tests

- [ ] **Step 4: Commit**

```bash
git add desktop/src/main/knowledgeIngestDecider.ts desktop/src/main/localChatRuntime.ts
git commit -m "feat: capture richer self-description in background memory"
```

### Task 5: Verify the whole desktop memory flow

**Files:**
- Modify as needed: `desktop/src/main/*.test.ts`
- Modify as needed: `desktop/src/renderer/pages/ChatsPage.test.tsx`

- [ ] **Step 1: Run full desktop tests**

Run: `npm run test`
Expected: all desktop tests pass

- [ ] **Step 2: Run desktop typecheck**

Run: `npm run typecheck`
Expected: pass

- [ ] **Step 3: If any regression appears, fix minimally and re-run**

Keep changes scoped to the memory sidecar and Russian vault output.

- [ ] **Step 4: Commit**

```bash
git add desktop
git commit -m "fix: stabilize rich conversational memory sidecar"
```

### Task 6: Prepare release artifacts

**Files:**
- Modify if needed: `desktop/package.json`
- Modify if needed: `desktop/package-lock.json`

- [ ] **Step 1: Bump desktop version if the desktop artifact changed**

Update version only if release packaging is required.

- [ ] **Step 2: Build installer**

Run: `npm run make`
Expected: new installer and squirrel artifacts

- [ ] **Step 3: Copy installer to desktop**

Source: `desktop/out/make/squirrel.windows/x64/KarpikSetup.exe`
Destination: `C:\Users\TBG\Desktop\KarpikSetup.exe`

- [ ] **Step 4: Commit version bump if applied**

```bash
git add desktop/package.json desktop/package-lock.json
git commit -m "chore: bump desktop version for memory sidecar release"
```
