import { useEffect, useMemo, useState } from "react";

type KnowledgeTreeNode = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getKnowledgeState"]>
>[number];

type KnowledgeSelection = {
  relativePath: string;
};

type KnowledgeEntryDetail = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["readKnowledgeEntry"]>
>;

function findFirstNote(nodes: KnowledgeTreeNode[]): KnowledgeSelection | null {
  for (const node of nodes) {
    if (node.kind === "note") {
      return {
        relativePath: node.relativePath
      };
    }

    const nestedSelection = findFirstNote(node.children);

    if (nestedSelection !== null) {
      return nestedSelection;
    }
  }

  return null;
}

function hasSelection(nodes: KnowledgeTreeNode[], selection: KnowledgeSelection | null): boolean {
  if (selection === null) {
    return false;
  }

  return nodes.some((node) => {
    if (node.relativePath === selection.relativePath) {
      return true;
    }

    return hasSelection(node.children, selection);
  });
}

function renderTreeNode(
  node: KnowledgeTreeNode,
  selection: KnowledgeSelection | null,
  onSelect: (selection: KnowledgeSelection) => void,
  depth = 0
) {
  if (node.kind === "directory") {
    return (
      <div className="knowledge-tree-node" key={node.id}>
        <p className="section-label" style={{ paddingLeft: `${depth * 14}px` }}>
          {node.title}
        </p>
        {node.children.length === 0 ? (
          <p className="muted-text" style={{ paddingLeft: `${depth * 14}px` }}>
            Пока пусто.
          </p>
        ) : (
          <div className="task-list">
            {node.children.map((childNode) =>
              renderTreeNode(childNode, selection, onSelect, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  }

  const isActive = selection?.relativePath === node.relativePath;

  return (
    <button
      className={`task-card knowledge-entry-button${isActive ? " active" : ""}`}
      key={node.id}
      onClick={() =>
        onSelect({
          relativePath: node.relativePath
        })
      }
      style={{ marginLeft: `${depth * 14}px` }}
      type="button"
    >
      <strong>{node.title}</strong>
      <p className="muted-text">{node.relativePath}</p>
    </button>
  );
}

export function KnowledgePage() {
  const [roots, setRoots] = useState<KnowledgeTreeNode[]>([]);
  const [selection, setSelection] = useState<KnowledgeSelection | null>(null);
  const [preview, setPreview] = useState<KnowledgeEntryDetail>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadRoots() {
      try {
        const nextRoots = await (window.karpik?.getKnowledgeState?.() ?? Promise.resolve([]));

        if (!isSubscribed) {
          return;
        }

        setRoots(nextRoots);
        setSelection((currentSelection) => {
          if (hasSelection(nextRoots, currentSelection)) {
            return currentSelection;
          }

          return findFirstNote(nextRoots);
        });
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить knowledge vault.");
        }
      }
    }

    void loadRoots();

    return () => {
      isSubscribed = false;
    };
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    async function loadPreview() {
      if (selection === null) {
        setPreview(null);
        return;
      }

      try {
        const nextPreview =
          (await window.karpik?.readKnowledgeEntry?.({
            relativePath: selection.relativePath
          })) ?? null;

        if (isSubscribed) {
          setPreview(nextPreview);
        }
      } catch {
        if (isSubscribed) {
          setError("Не удалось открыть knowledge note.");
        }
      }
    }

    void loadPreview();

    return () => {
      isSubscribed = false;
    };
  }, [selection]);

  const hasEntries = useMemo(() => findFirstNote(roots) !== null, [roots]);

  return (
    <div className="page-shell">
      <p className="eyebrow">Knowledge / Review</p>
      <h2>Knowledge Vault</h2>
      <p className="muted-text">
        Локальный Obsidian-friendly vault с деревом user/assist и markdown-связями.
      </p>

      <div className="knowledge-layout">
        <aside className="knowledge-sidebar">
          {roots.map((root) => renderTreeNode(root, selection, setSelection))}
        </aside>

        <section className="knowledge-preview">
          <p className="section-label">Preview</p>
          {!hasEntries ? (
            <p className="muted-text">В knowledge vault пока нет markdown-заметок.</p>
          ) : preview === null ? (
            <p className="muted-text">Выбери заметку слева.</p>
          ) : (
            <>
              <strong>{preview.title}</strong>
              <p className="muted-text">{preview.relativePath}</p>
              <pre className="knowledge-preview-text">{preview.content}</pre>
            </>
          )}
          {error ? <p className="task-error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}
