"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Canvas } from "@/components/Canvas";
import {
  addNode,
  canRedo,
  canUndo,
  commit,
  deleteNode,
  moveNode,
  newDoc,
  newHistory,
  redo,
  resetPositions,
  setLabel,
  setTheme,
  setType,
  undo,
  type DiagramDoc,
  type History,
  type Offset,
} from "@/lib/document";
import { copyPngToClipboard, downloadPng, downloadSvg, slugifyFilename } from "@/lib/export";
import { layoutSpec } from "@/lib/layout";
import { applyOffsets } from "@/lib/layout/overrides";
import { SAMPLES } from "@/lib/samples";
import { splitSections } from "@/lib/sections";
import { IMPLEMENTED_TYPES, type DiagramSpec, type DiagramType } from "@/lib/spec";
import { getTheme, THEMES } from "@/lib/theme";
import styles from "./page.module.css";

interface ExtractResponse {
  spec: DiagramSpec;
  source: "model" | "heuristic";
  note: string | null;
  error?: string;
}

const TYPE_LABELS: Record<DiagramType, string> = {
  flowchart: "Flowchart",
  cycle: "Cycle",
  hierarchy: "Hierarchy",
  comparison: "Comparison",
  timeline: "Timeline",
  funnel: "Funnel",
  venn: "Venn",
  list: "List",
};

export default function Home() {
  const [text, setText] = useState(SAMPLES[0].text);
  /**
   * One history per section, keyed by the section's content-addressed id.
   * Regenerating a section replaces its entry and touches nothing else - that
   * is the whole point of splitting the document up.
   */
  const [docs, setDocs] = useState<Record<string, History>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pinned, setPinned] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, Offset> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [lastThemeId, setLastThemeId] = useState(THEMES[0].id);
  const stageRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => splitSections(text), [text]);

  // Editing the text re-splits it, so a pinned id can go stale; fall back to
  // the first section rather than showing nothing.
  const active = useMemo(
    () => sections.find((s) => s.id === pinned) ?? sections[0] ?? null,
    [sections, pinned],
  );

  const history = active ? (docs[active.id] ?? null) : null;
  const doc = history?.present ?? null;
  const theme = getTheme(doc?.themeId);
  const status = active ? (notes[active.id] ?? null) : null;
  const loading = busy !== null;

  // Offsets in flight during a drag are not in the document yet.
  const offsets = preview ?? doc?.offsets ?? {};

  const layout = useMemo(() => {
    if (!doc) return null;
    return applyOffsets(layoutSpec(doc.spec, theme), offsets);
  }, [doc, theme, offsets]);

  const select = useCallback((id: string) => {
    setPinned(id);
    setPreview(null);
    setSelected(null);
    setError(null);
  }, []);

  /** Every undoable change funnels through here, scoped to the active section. */
  const apply = useCallback(
    (fn: (doc: DiagramDoc) => DiagramDoc) => {
      setPreview(null);
      if (!active) return;
      setDocs((current) => {
        const existing = current[active.id];
        if (!existing) return current;
        const next = commit(existing, fn(existing.present));
        if (next === existing) return current;
        return { ...current, [active.id]: next };
      });
    },
    [active],
  );

  /** Undo/redo and any other whole-history move, scoped the same way. */
  const step = useCallback(
    (fn: (history: History) => History) => {
      setPreview(null);
      if (!active) return;
      setDocs((current) => {
        const existing = current[active.id];
        if (!existing) return current;
        const next = fn(existing);
        if (next === existing) return current;
        return { ...current, [active.id]: next };
      });
    },
    [active],
  );

  /**
   * Extraction for exactly one section. `typeHint` pins the type through the
   * model rather than re-laying out what it already returned, which is the
   * stronger fix when the text was misread rather than mislaid out.
   */
  const generate = useCallback(
    async (sectionId: string, typeHint?: DiagramType) => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;
      if (!section.text.trim()) {
        setError("Paste some text first.");
        return;
      }

      setPinned(sectionId);
      setBusy(sectionId);
      setError(null);
      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: section.text, typeHint }),
        });
        const data = (await response.json()) as ExtractResponse;
        if (!response.ok) throw new Error(data.error ?? "Extraction failed");

        // A fresh extraction starts a new document for this section; the old
        // edit history belonged to a different diagram.
        setDocs((current) => ({
          ...current,
          [sectionId]: newHistory(
            newDoc(data.spec, current[sectionId]?.present.themeId ?? lastThemeId),
          ),
        }));
        setNotes((current) => ({
          ...current,
          [sectionId]:
            data.note ??
            `Extracted with ${data.source === "model" ? "the model" : "the heuristic extractor"}.`,
        }));
        setPreview(null);
        setSelected(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
    },
    [sections, lastThemeId],
  );

  // Keyboard: undo/redo and delete, the three shortcuts an editor must have.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        step(event.shiftKey ? redo : undo);
        return;
      }
      if ((event.key === "Backspace" || event.key === "Delete") && selected) {
        event.preventDefault();
        const id = selected;
        setSelected(null);
        apply((current) => deleteNode(current, id));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, step, selected]);

  const getSvg = () => stageRef.current?.querySelector("svg") as SVGSVGElement | null;

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  // A titled spec names itself; otherwise an author-written heading is the best
  // name a multi-section export can carry.
  const exportName = () =>
    slugifyFilename(doc?.spec.title ?? (active?.explicitHeading ? active.heading : null));

  const onExportPng = async () => {
    const svg = getSvg();
    if (!svg || !doc) return;
    await downloadPng(svg, `${exportName()}.png`);
    flash("PNG downloaded");
  };

  const onExportSvg = () => {
    const svg = getSvg();
    if (!svg || !doc) return;
    downloadSvg(svg, `${exportName()}.svg`);
    flash("SVG downloaded");
  };

  const onCopy = async () => {
    const svg = getSvg();
    if (!svg) return;
    const ok = await copyPngToClipboard(svg);
    flash(ok ? "Copied to clipboard" : "Clipboard blocked - use Download PNG");
  };

  const multi = sections.length > 1;
  const generatedCount = sections.filter((s) => docs[s.id]).length;

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <header className={styles.brand}>
          <span className={styles.mark} aria-hidden />
          <div>
            <h1>Napkin Clone</h1>
            <p>Paste text, get a diagram.</p>
          </div>
        </header>

        <div className={styles.samples}>
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => {
                setText(sample.text);
                setPinned(null);
                setError(null);
              }}
              className={styles.chip}
              type="button"
            >
              {sample.label}
            </button>
          ))}
        </div>

        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a process, a comparison, a set of steps..."
          spellCheck={false}
        />

        <button
          className={`primary ${styles.generate}`}
          onClick={() => active && generate(active.id)}
          disabled={loading || !active}
          type="button"
        >
          {busy ? "Extracting..." : generateLabel(multi, Boolean(history))}
        </button>

        {error && <p className={styles.error}>{error}</p>}
        {!error && status && <p className={styles.status}>{status}</p>}

        {multi && (
          <section className={styles.section}>
            <h2>
              Sections · {generatedCount}/{sections.length}
            </h2>
            <p className={styles.hint}>
              Headings split the text into sections, each its own diagram. Regenerate one
              and the rest are left alone.
            </p>
            <div className={styles.sections}>
              {sections.map((section) => {
                const isActive = active?.id === section.id;
                const made = Boolean(docs[section.id]);
                return (
                  <div
                    key={section.id}
                    className={`${styles.sectionRow} ${isActive ? styles.sectionRowActive : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.sectionPick}
                      onClick={() => select(section.id)}
                      aria-pressed={isActive}
                      title={section.text.slice(0, 240)}
                    >
                      <span className={`${styles.dot} ${made ? styles.dotOn : ""}`} aria-hidden />
                      <span className={styles.sectionName}>{section.heading}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.sectionGo}
                      disabled={loading}
                      onClick={() => generate(section.id)}
                    >
                      {busy === section.id ? "…" : made ? "Redo" : "Make"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {doc && layout && history && (
          <>
            <section className={styles.section}>
              <h2>Diagram type</h2>
              <p className={styles.hint}>
                Misread the text? Switch the type - it re-lays out the same spec, no second
                model call.
              </p>
              <div className={styles.types}>
                {IMPLEMENTED_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`${styles.chip} ${doc.spec.type === type ? styles.chipActive : ""}`}
                    onClick={() => apply((current) => setType(current, type))}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              {layout.degradedFrom && (
                <p className={styles.hint}>
                  This spec does not fit <code>{layout.degradedFrom}</code> - showing the
                  closest layout that works.
                </p>
              )}
              <button
                type="button"
                disabled={loading || !active}
                onClick={() => active && generate(active.id, doc.spec.type)}
              >
                Re-extract as {TYPE_LABELS[doc.spec.type]}
              </button>
              <p className={styles.hint}>
                Spends a model call, but re-reads the text for this shape instead of bending
                the nodes it already picked.
              </p>
            </section>

            <section className={styles.section}>
              <h2>Theme</h2>
              <div className={styles.themes}>
                {THEMES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.name}
                    aria-label={option.name}
                    aria-pressed={doc.themeId === option.id}
                    className={`${styles.swatch} ${doc.themeId === option.id ? styles.swatchActive : ""}`}
                    style={{ background: option.background }}
                    onClick={() => {
                      // Remembered so the next section generated matches this one.
                      setLastThemeId(option.id);
                      apply((current) => setTheme(current, option.id));
                    }}
                  >
                    <span style={{ background: option.accents[0].stroke }} />
                    <span style={{ background: option.accents[1].stroke }} />
                    <span style={{ background: option.accents[2].stroke }} />
                  </button>
                ))}
              </div>
              <p className={styles.hint}>{theme.name}</p>
            </section>

            <section className={styles.section}>
              <h2>Edit</h2>
              <p className={styles.hint}>
                Drag to move, double-click to rename, Backspace to delete. Cmd/Ctrl+Z undoes
                anything, theme switches included.
              </p>
              <div className={styles.exports}>
                <button type="button" disabled={!canUndo(history)} onClick={() => step(undo)}>
                  Undo
                </button>
                <button type="button" disabled={!canRedo(history)} onClick={() => step(redo)}>
                  Redo
                </button>
              </div>
              <div className={styles.exports}>
                <button type="button" onClick={() => apply((c) => addNode(c, selected))}>
                  Add node
                </button>
                <button
                  type="button"
                  disabled={Object.keys(doc.offsets).length === 0}
                  onClick={() => apply(resetPositions)}
                >
                  Reset layout
                </button>
              </div>
            </section>

            <section className={styles.section}>
              <h2>Export</h2>
              <div className={styles.exports}>
                <button type="button" onClick={onExportPng}>
                  PNG
                </button>
                <button type="button" onClick={onExportSvg}>
                  SVG
                </button>
                <button type="button" onClick={onCopy}>
                  Copy
                </button>
              </div>
            </section>
          </>
        )}
      </aside>

      <section className={styles.canvasWrap}>
        <div className={styles.canvasBar}>
          <span className={styles.meta}>
            {doc
              ? `${multi && active ? `${active.heading} · ` : ""}${TYPE_LABELS[doc.spec.type]} · ${doc.spec.nodes.length} nodes · ${doc.spec.edges.length} edges`
              : "No diagram yet"}
          </span>
          <div className={styles.zoom}>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}>
              -
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>
              +
            </button>
            <button type="button" onClick={() => setZoom(1)}>
              Reset
            </button>
          </div>
        </div>

        <div
          className={styles.canvas}
          style={{ backgroundColor: theme.background, backgroundImage: gridImage(theme.grid) }}
        >
          {doc && layout ? (
            <div ref={stageRef}>
              <Canvas
                layout={layout}
                spec={doc.spec}
                theme={theme}
                zoom={zoom}
                offsets={offsets}
                selected={selected}
                onSelect={setSelected}
                onDragPreview={setPreview}
                onDragCommit={(next) => {
                  const entries = Object.entries(next);
                  step((current) => {
                    let updated = current.present;
                    for (const [id, offset] of entries) updated = moveNode(updated, id, offset);
                    return commit(current, updated);
                  });
                }}
                onEditLabel={(id, label) => apply((current) => setLabel(current, id, label))}
              />
            </div>
          ) : (
            <div className={styles.empty}>
              <p>
                {multi
                  ? "Pick a section on the left, then hit Generate."
                  : "Pick a sample or paste your own text, then hit Generate."}
              </p>
            </div>
          )}
        </div>

        {toast && <div className={styles.toast}>{toast}</div>}
      </section>
    </main>
  );
}

function generateLabel(multi: boolean, made: boolean): string {
  const what = multi ? "this section" : "diagram";
  return `${made ? "Regenerate" : "Generate"} ${what}`;
}

function gridImage(color: string | null): string | undefined {
  return color ? `radial-gradient(${color} 1px, transparent 1px)` : "none";
}
