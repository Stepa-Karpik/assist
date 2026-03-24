import { useEffect, useMemo, useState } from "react";

type KnowledgeSection = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getKnowledgeState"]>
>[number];

type KnowledgeSelection = {
  sectionId: KnowledgeSection["id"];
  relativePath: string;
};

type KnowledgeEntryDetail = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["readKnowledgeEntry"]>
>;

function findFirstEntry(sections: KnowledgeSection[]): KnowledgeSelection | null {
  for (const section of sections) {
    const firstEntry = section.entries[0];

    if (firstEntry) {
      return {
        sectionId: section.id,
        relativePath: firstEntry.relativePath
      };
    }
  }

  return null;
}

function hasSelection(
  sections: KnowledgeSection[],
  selection: KnowledgeSelection | null
): boolean {
  if (selection === null) {
    return false;
  }

  return sections.some(
    (section) =>
      section.id === selection.sectionId &&
      section.entries.some((entry) => entry.relativePath === selection.relativePath)
  );
}

export function KnowledgePage() {
  const [sections, setSections] = useState<KnowledgeSection[]>([]);
  const [selection, setSelection] = useState<KnowledgeSelection | null>(null);
  const [preview, setPreview] = useState<KnowledgeEntryDetail>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadSections() {
      try {
        const nextSections = await (window.karpik?.getKnowledgeState?.() ?? Promise.resolve([]));

        if (!isSubscribed) {
          return;
        }

        setSections(nextSections);
        setSelection((currentSelection) => {
          if (hasSelection(nextSections, currentSelection)) {
            return currentSelection;
          }

          return findFirstEntry(nextSections);
        });
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить knowledge browser.");
        }
      }
    }

    void loadSections();

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
          (await window.karpik?.readKnowledgeEntry?.(selection)) ?? null;

        if (isSubscribed) {
          setPreview(nextPreview);
        }
      } catch {
        if (isSubscribed) {
          setError("Не удалось открыть knowledge entry.");
        }
      }
    }

    void loadPreview();

    return () => {
      isSubscribed = false;
    };
  }, [selection]);

  const hasEntries = useMemo(
    () => sections.some((section) => section.entries.length > 0),
    [sections]
  );

  return (
    <div className="page-shell">
      <p className="eyebrow">Knowledge / Review</p>
      <h2>Knowledge Browser</h2>
      <p className="muted-text">
        Read-only browser for master info, notes, knowledge files, and captured websites.
      </p>

      <div className="knowledge-layout">
        <aside className="knowledge-sidebar">
          {sections.map((section) => (
            <section key={section.id}>
              <p className="section-label">{section.label}</p>
              {section.entries.length === 0 ? (
                <p className="muted-text">Пока пусто.</p>
              ) : (
                <div className="task-list">
                  {section.entries.map((entry) => {
                    const isActive =
                      selection?.sectionId === section.id &&
                      selection.relativePath === entry.relativePath;

                    return (
                      <button
                        className={`task-card knowledge-entry-button${isActive ? " active" : ""}`}
                        key={`${section.id}:${entry.relativePath}`}
                        onClick={() =>
                          setSelection({
                            sectionId: section.id,
                            relativePath: entry.relativePath
                          })
                        }
                        type="button"
                      >
                        <strong>{entry.displayName}</strong>
                        {entry.relativePath !== entry.displayName ? (
                          <p className="muted-text">{entry.relativePath}</p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </aside>

        <section className="knowledge-preview">
          <p className="section-label">Preview</p>
          {!hasEntries ? (
            <p className="muted-text">В knowledge browser пока нет файлов.</p>
          ) : preview === null ? (
            <p className="muted-text">Выбери файл слева.</p>
          ) : (
            <>
              <strong>Selected file: {preview.relativePath}</strong>
              <pre className="knowledge-preview-text">{preview.content}</pre>
            </>
          )}
          {error ? <p className="task-error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}
