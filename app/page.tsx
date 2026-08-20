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
  const [history, setHistory] = useState<History | null>(null);
  const [preview, setPreview] = useState<Record<string, Offset> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const doc = history?.present ?? null;
  const theme = getTheme(doc?.themeId);

  // Offsets in flight during a drag are not in the document yet.
  const offsets = preview ?? doc?.offsets ?? {};

  const layout = useMemo(() => {
    if (!doc) return null;
    return applyOffsets(layoutSpec(doc.spec, theme), offsets);
  }, [doc, theme, offsets]);

  /** Every undoable change funnels through here. */
  const apply = useCallback((fn: (doc: DiagramDoc) => DiagramDoc) => {
    setPreview(null);
    setHistory((current) => (current ? commit(current, fn(current.present)) : current));
  }, []);

  const generate = useCallback(async () => {
    if (!text.trim()) {
      setError("Paste some text first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as ExtractResponse;
      if (!response.ok) throw new Error(data.error ?? "Extraction failed");
      // A fresh extraction starts a new document; the old edit history belonged
      // to a different diagram.
      setHistory(newHistory(newDoc(data.spec, doc?.themeId ?? THEMES[0].id)));
      setPreview(null);
      setSelected(null);
      setStatus(
        data.note ??
          `Extracted with ${data.source === "model" ? "the model" : "the heuristic extractor"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [text, doc]);

  // Keyboard: undo/redo and delete, the three shortcuts an editor must have.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setPreview(null);
        setHistory((current) =>
          current ? (event.shiftKey ? redo(current) : undo(current)) : current,
        );
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
  }, [apply, selected]);

  const getSvg = () => stageRef.current?.querySelector("svg") as SVGSVGElement | null;

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const onExportPng = async () => {
    const svg = getSvg();
    if (!svg || !doc) return;
    await downloadPng(svg, `${slugifyFilename(doc.spec.title)}.png`);
    flash("PNG downloaded");
  };

  const onExportSvg = () => {
    const svg = getSvg();
    if (!svg || !doc) return;
    downloadSvg(svg, `${slugifyFilename(doc.spec.title)}.svg`);
    flash("SVG downloaded");
  };

  const onCopy = async () => {
    const svg = getSvg();
    if (!svg) return;
    const ok = await copyPngToClipboard(svg);
    flash(ok ? "Copied to clipboard" : "Clipboard blocked - use Download PNG");
  };

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
              onClick={() => setText(sample.text)}
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
          onClick={generate}
          disabled={loading}
          type="button"
        >
          {loading ? "Extracting..." : "Generate diagram"}
        </button>

        {error && <p className={styles.error}>{error}</p>}
        {!error && status && <p className={styles.status}>{status}</p>}

        {doc && layout && (
          <>
            <section className={styles.section}>
              <h2>Diagram type</h2>
              <p className={styles.hint}>
                Misread the text? Switch the type - it re-lays out the same spec, no
                second model call.
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
                    onClick={() => apply((current) => setTheme(current, option.id))}
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
                Drag to move, double-click to rename, Backspace to delete. Cmd/Ctrl+Z
                undoes anything, theme switches included.
              </p>
              <div className={styles.exports}>
                <button
                  type="button"
                  disabled={!canUndo(history!)}
                  onClick={() => {
                    setPreview(null);
                    setHistory((current) => (current ? undo(current) : current));
                  }}
                >
                  Undo
                </button>
                <button
                  type="button"
                  disabled={!canRedo(history!)}
                  onClick={() => {
                    setPreview(null);
                    setHistory((current) => (current ? redo(current) : current));
                  }}
                >
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
              ? `${TYPE_LABELS[doc.spec.type]} · ${doc.spec.nodes.length} nodes · ${doc.spec.edges.length} edges`
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
                  setPreview(null);
                  setHistory((current) => {
                    if (!current) return current;
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
              <p>Pick a sample or paste your own text, then hit Generate.</p>
            </div>
          )}
        </div>

        {toast && <div className={styles.toast}>{toast}</div>}
      </section>
    </main>
  );
}

function gridImage(color: string | null): string | undefined {
  return color ? `radial-gradient(${color} 1px, transparent 1px)` : "none";
}
