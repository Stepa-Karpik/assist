# Knowledge Vault Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить локальный Obsidian-friendly knowledge vault с `user/` и `assist/`, настроить `vault root` через onboarding/settings, заменить старый knowledge browser на vault browser и добавить тихую markdown-запись с обязательными связями.

**Architecture:** Вся логика остаётся desktop-local. Новый subsystem делится на четыре части: machine-local `vault settings`, bootstrap/validation структуры, vault browser/read layer и background write layer с resolver/linker/registry. Для значимых изменений в `assist/skills` переиспользуется существующий local approval flow, а сервер и бот не меняются.

**Tech Stack:** Electron main/preload/renderer, TypeScript, Vitest, Node `fs/path`, markdown-файлы, Obsidian wiki-links.

---

## File Structure

### Existing files to modify

- `desktop/src/main/main.ts`
  - wiring stores, IPC handlers, knowledge background writer hooks
- `desktop/src/main/onboardingStateStore.ts`
  - onboarding state расширяется знанием о `vault root`
- `desktop/src/preload/index.ts`
  - expose vault IPC
- `desktop/src/renderer/window.d.ts`
  - type contracts for vault IPC
- `desktop/src/renderer/App.tsx`
  - onboarding flow and knowledge section wiring
- `desktop/src/renderer/pages/SettingsPage.tsx`
  - vault root config UI
- `desktop/src/renderer/pages/KnowledgePage.tsx`
  - migrate from legacy runtime browser to vault browser
- `desktop/src/main/knowledgeStore.ts`
  - either replace implementation or keep as legacy wrapper delegating to vault store

### New main-side files

- `desktop/src/main/vaultSettingsStore.ts`
  - load/save machine-local `vault root`
- `desktop/src/main/vaultSettingsStore.test.ts`
- `desktop/src/main/knowledgeVaultBootstrap.ts`
  - ensure `user/`, `assist/` and base registry files exist
- `desktop/src/main/knowledgeVaultBootstrap.test.ts`
- `desktop/src/main/knowledgeVaultStore.ts`
  - list tree and read notes from vault
- `desktop/src/main/knowledgeVaultStore.test.ts`
- `desktop/src/main/knowledgeTopicResolver.ts`
  - choose existing topic vs new file path
- `desktop/src/main/knowledgeTopicResolver.test.ts`
- `desktop/src/main/knowledgeLinker.ts`
  - build/update wiki-links and registry entries
- `desktop/src/main/knowledgeLinker.test.ts`
- `desktop/src/main/knowledgeWriter.ts`
  - write/update markdown notes in `user/` and `assist/`
- `desktop/src/main/knowledgeWriter.test.ts`
- `desktop/src/main/knowledgeIngestDecider.ts`
  - decide what to write from a conversation/result
- `desktop/src/main/knowledgeIngestDecider.test.ts`
- `desktop/src/main/knowledgeBackgroundWriter.ts`
  - orchestrate decider -> writer -> linker
- `desktop/src/main/knowledgeBackgroundWriter.test.ts`

### New renderer-side helpers if needed

- `desktop/src/renderer/pages/knowledgeTree.ts`
  - small tree/view-model helpers for vault browser
- `desktop/src/renderer/pages/knowledgeTree.test.ts`

## Task 1: Add Vault Settings and Bootstrap

**Files:**
- Create: `desktop/src/main/vaultSettingsStore.ts`
- Create: `desktop/src/main/vaultSettingsStore.test.ts`
- Create: `desktop/src/main/knowledgeVaultBootstrap.ts`
- Create: `desktop/src/main/knowledgeVaultBootstrap.test.ts`
- Modify: `desktop/src/main/onboardingStateStore.ts`
- Modify: `desktop/src/main/main.ts`

- [ ] **Step 1: Write failing tests for machine-local vault settings**

```ts
it("persists vault root under settings and returns null by default", () => {
  const store = new VaultSettingsStore({ settingsRoot });
  expect(store.getVaultRoot()).toBeNull();

  store.setVaultRoot("D:\\KarpikVault");
  expect(store.getVaultRoot()).toBe("D:\\KarpikVault");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- vaultSettingsStore`
Expected: FAIL because `VaultSettingsStore` does not exist.

- [ ] **Step 3: Write minimal vault settings store**

```ts
export class VaultSettingsStore {
  getVaultRoot(): string | null {}
  setVaultRoot(vaultRoot: string): string {}
}
```

- [ ] **Step 4: Add failing bootstrap tests for base structure**

```ts
it("creates user assist and registry skeleton under vault root", () => {
  ensureKnowledgeVault("D:\\KarpikVault");
  expect(existsSync("D:\\KarpikVault\\user")).toBe(true);
  expect(existsSync("D:\\KarpikVault\\assist\\docs\\registry\\Документации.md")).toBe(true);
});
```

- [ ] **Step 5: Run bootstrap tests to verify failure**

Run: `npm run test -- knowledgeVaultBootstrap`
Expected: FAIL because bootstrap function does not exist.

- [ ] **Step 6: Implement bootstrap and onboarding state extension**

```ts
export function ensureKnowledgeVault(vaultRoot: string) {
  mkdirSync(path.join(vaultRoot, "user"), { recursive: true });
  mkdirSync(path.join(vaultRoot, "assist", "docs", "registry"), { recursive: true });
}
```

- [ ] **Step 7: Wire stores into main process without touching renderer yet**

Run: `npm run test -- vaultSettingsStore knowledgeVaultBootstrap onboardingStateStore`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add desktop/src/main/vaultSettingsStore.ts desktop/src/main/vaultSettingsStore.test.ts desktop/src/main/knowledgeVaultBootstrap.ts desktop/src/main/knowledgeVaultBootstrap.test.ts desktop/src/main/onboardingStateStore.ts desktop/src/main/main.ts
git commit -m "feat: add vault root settings and bootstrap"
```

## Task 2: Add Vault Root to Onboarding and Settings

**Files:**
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing renderer test for first-run vault root requirement**

```tsx
it("requires vault root during first-run onboarding", async () => {
  renderApp();
  expect(await screen.findByLabelText("Путь к vault")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run onboarding test to verify it fails**

Run: `npm run test -- App onboarding`
Expected: FAIL because onboarding does not ask for vault root.

- [ ] **Step 3: Add IPC contract for get/set/validate vault root**

```ts
getVaultSettings: () => ipcRenderer.invoke("vault:get-settings"),
setVaultRoot: (vaultRoot: string) => ipcRenderer.invoke("vault:set-root", vaultRoot),
```

- [ ] **Step 4: Implement onboarding/settings UI**

```tsx
<label>
  Путь к vault
  <input value={vaultRootDraft} onChange={...} />
</label>
```

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- App SettingsPage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/main.ts desktop/src/preload/index.ts desktop/src/renderer/window.d.ts desktop/src/renderer/App.tsx desktop/src/renderer/pages/SettingsPage.tsx desktop/src/renderer/App.test.tsx
git commit -m "feat: add vault root onboarding and settings"
```

## Task 3: Replace Legacy Knowledge Browser with Vault Browser

**Files:**
- Create: `desktop/src/main/knowledgeVaultStore.ts`
- Create: `desktop/src/main/knowledgeVaultStore.test.ts`
- Modify: `desktop/src/main/knowledgeStore.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/renderer/pages/KnowledgePage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing test for listing `user/` and `assist/` trees**

```ts
it("lists top-level user and assist nodes from vault root", () => {
  const store = createKnowledgeVaultStore({ vaultRoot });
  expect(store.listRoots().map((node) => node.id)).toEqual(["user", "assist"]);
});
```

- [ ] **Step 2: Run store test to verify it fails**

Run: `npm run test -- knowledgeVaultStore`
Expected: FAIL because store does not exist.

- [ ] **Step 3: Implement read-only vault browser store**

```ts
export function createKnowledgeVaultStore({ vaultRoot }: { vaultRoot: string }) {
  return {
    listRoots() {},
    readNote(notePath: string) {}
  };
}
```

- [ ] **Step 4: Update renderer to use new tree model**

```tsx
<aside>{roots.map((root) => <button key={root.id}>{root.title}</button>)}</aside>
```

- [ ] **Step 5: Run focused browser tests**

Run: `npm run test -- knowledgeVaultStore App`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/knowledgeVaultStore.ts desktop/src/main/knowledgeVaultStore.test.ts desktop/src/main/knowledgeStore.ts desktop/src/main/main.ts desktop/src/renderer/pages/KnowledgePage.tsx desktop/src/renderer/App.test.tsx
git commit -m "feat: replace legacy knowledge browser with vault browser"
```

## Task 4: Implement Topic Resolution and Markdown Writing

**Files:**
- Create: `desktop/src/main/knowledgeTopicResolver.ts`
- Create: `desktop/src/main/knowledgeTopicResolver.test.ts`
- Create: `desktop/src/main/knowledgeWriter.ts`
- Create: `desktop/src/main/knowledgeWriter.test.ts`

- [ ] **Step 1: Write failing resolver tests for reuse vs new file**

```ts
it("reuses existing MCP note instead of creating duplicate", () => {
  const result = resolveTopicPath({
    vaultRoot,
    tree: "user",
    topicTrail: ["AI", "models", "MCP"],
    preferredLeaf: "MCP"
  });
  expect(result.mode).toBe("append");
});
```

- [ ] **Step 2: Run resolver tests**

Run: `npm run test -- knowledgeTopicResolver`
Expected: FAIL because resolver does not exist.

- [ ] **Step 3: Implement resolver with human-readable file names**

```ts
export function resolveTopicPath(input: ResolveTopicInput): ResolveTopicResult {
  // search existing topic directory first, create new subnote only when needed
}
```

- [ ] **Step 4: Write failing writer tests for append/update behavior**

```ts
it("appends new MCP section into existing note", () => {
  writeKnowledgeEntry(...);
  expect(readFileSync(note, "utf8")).toContain("## Подводные камни");
});
```

- [ ] **Step 5: Implement markdown writer**

```ts
export class KnowledgeWriter {
  writeUserTopic(input: UserTopicWriteInput) {}
  writeAssistTopic(input: AssistTopicWriteInput) {}
}
```

- [ ] **Step 6: Run focused tests**

Run: `npm run test -- knowledgeTopicResolver knowledgeWriter`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add desktop/src/main/knowledgeTopicResolver.ts desktop/src/main/knowledgeTopicResolver.test.ts desktop/src/main/knowledgeWriter.ts desktop/src/main/knowledgeWriter.test.ts
git commit -m "feat: add knowledge topic resolution and markdown writer"
```

## Task 5: Implement Linker and Registries

**Files:**
- Create: `desktop/src/main/knowledgeLinker.ts`
- Create: `desktop/src/main/knowledgeLinker.test.ts`
- Modify: `desktop/src/main/knowledgeWriter.ts`
- Test: `desktop/src/main/knowledgeWriter.test.ts`

- [ ] **Step 1: Write failing tests for wiki-links and registry updates**

```ts
it("updates trusted site registry and links source back to topic", () => {
  linker.linkSourceToTopic(...);
  expect(readFileSync(trustedSitesFile, "utf8")).toContain("[[habr.com]]");
  expect(readFileSync(sourceFile, "utf8")).toContain("[[MCP]]");
});
```

- [ ] **Step 2: Run linker tests**

Run: `npm run test -- knowledgeLinker`
Expected: FAIL because linker does not exist.

- [ ] **Step 3: Implement linker and registry manager**

```ts
export class KnowledgeLinker {
  ensureTopicLinks(...) {}
  updateTrustedWebsiteRegistry(...) {}
  updateDocumentationRegistry(...) {}
}
```

- [ ] **Step 4: Connect writer to linker**

Run: `npm run test -- knowledgeWriter knowledgeLinker`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/knowledgeLinker.ts desktop/src/main/knowledgeLinker.test.ts desktop/src/main/knowledgeWriter.ts desktop/src/main/knowledgeWriter.test.ts
git commit -m "feat: add knowledge linking and registries"
```

## Task 6: Add Ingest Decider and Background Writer

**Files:**
- Create: `desktop/src/main/knowledgeIngestDecider.ts`
- Create: `desktop/src/main/knowledgeIngestDecider.test.ts`
- Create: `desktop/src/main/knowledgeBackgroundWriter.ts`
- Create: `desktop/src/main/knowledgeBackgroundWriter.test.ts`
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/taskRuntime.ts`
- Modify: `desktop/src/main/main.ts`

- [ ] **Step 1: Write failing tests for conservative `user/` writes and richer `assist/` writes**

```ts
it("writes stable explanation to user and source summary to assist", () => {
  const decision = decideKnowledgeWrites({
    prompt: "добавь документацию по FastAPI",
    answer: "..."
  });
  expect(decision.userWrites).toHaveLength(1);
  expect(decision.assistWrites).toHaveLength(1);
});
```

- [ ] **Step 2: Run decider tests**

Run: `npm run test -- knowledgeIngestDecider`
Expected: FAIL because decider does not exist.

- [ ] **Step 3: Implement decider and background orchestration**

```ts
export function decideKnowledgeWrites(input: IngestInput): KnowledgeWritePlan {
  return { userWrites: [], assistWrites: [], skillApprovalDrafts: [] };
}
```

- [ ] **Step 4: Hook background writer after successful local/remote results**

```ts
await knowledgeBackgroundWriter.recordInteraction({
  origin: "local-chat",
  prompt,
  answer
});
```

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- knowledgeIngestDecider knowledgeBackgroundWriter localChatRuntime taskRuntime`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/knowledgeIngestDecider.ts desktop/src/main/knowledgeIngestDecider.test.ts desktop/src/main/knowledgeBackgroundWriter.ts desktop/src/main/knowledgeBackgroundWriter.test.ts desktop/src/main/localChatRuntime.ts desktop/src/main/taskRuntime.ts desktop/src/main/main.ts
git commit -m "feat: add background knowledge ingestion"
```

## Task 7: Reuse Local Approval for Significant Assist Skills

**Files:**
- Modify: `desktop/src/main/knowledgeIngestDecider.ts`
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
- Modify: `desktop/src/main/localApprovalStore.ts`
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
- Test: `desktop/src/main/knowledgeBackgroundWriter.test.ts`

- [ ] **Step 1: Write failing test for significant skill draft requiring approval**

```ts
it("creates local approval item before writing a significant assist skill", async () => {
  const result = await backgroundWriter.recordInteraction({
    prompt: "научись новому workflow",
    answer: "...",
    skillChangeSeverity: "significant"
  });
  expect(result.pendingApproval).toBe(true);
});
```

- [ ] **Step 2: Run approval-focused tests**

Run: `npm run test -- knowledgeBackgroundWriter localApprovalStore`
Expected: FAIL because skill approvals are not wired.

- [ ] **Step 3: Implement draft-to-approval integration**

```ts
if (plan.skillApprovalDrafts.length > 0) {
  await localApprovalStore.saveDraft("assist-skill-update", draft);
}
```

- [ ] **Step 4: Verify existing approval UI still works**

Run: `npm run test -- BlockedTasksPage knowledgeBackgroundWriter`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/knowledgeIngestDecider.ts desktop/src/main/knowledgeBackgroundWriter.ts desktop/src/main/localApprovalStore.ts desktop/src/renderer/pages/BlockedTasksPage.tsx desktop/src/main/knowledgeBackgroundWriter.test.ts
git commit -m "feat: route significant assist skills through local approval"
```

## Task 8: Final Regression and Documentation Touch-Up

**Files:**
- Modify: `docs/superpowers/specs/2026-03-24-knowledge-browser-design.md` (mark legacy or superseded if needed)
- Modify: `README.md` if vault path becomes user-visible behavior

- [ ] **Step 1: Run focused desktop knowledge suite**

Run: `npm run test -- knowledge vault onboarding SettingsPage`
Expected: PASS

- [ ] **Step 2: Run full desktop regression**

Run: `npm run test`
Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Update docs if UI behavior changed**

```md
- `Knowledge / Review` now reads from the configured Obsidian vault root
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-03-24-knowledge-browser-design.md README.md
git commit -m "docs: finalize knowledge vault foundation rollout"
```

