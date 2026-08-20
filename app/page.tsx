"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { DiagramSvg } from "@/components/DiagramSvg";
import { copyPngToClipboard, downloadPng, downloadSvg, slugifyFilename } from "@/lib/export";
import { layoutSpec } from "@/lib/layout";
import { SAMPLES } from "@/lib/samples";
import { IMPLEMENTED_TYPES, type DiagramSpec, type DiagramType } from "@/lib/spec";
import { paperTheme } from "@/lib/theme";
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
  list: "List",
  timeline: "Timeline",
  funnel: "Funnel",
  venn: "Venn",
};

export default function Home() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [spec, setSpec] = useState<DiagramSpec | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  const theme = paperTheme;
  const layout = useMemo(() => (spec ? layoutSpec(spec, theme) : null), [spec, theme]);

  const generate = useCallback(
    async (typeHint?: DiagramType) => {
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
          body: JSON.stringify({ text, typeHint }),
        });
        const data = (await response.json()) as ExtractResponse;
        if (!response.ok) throw new Error(data.error ?? "Extraction failed");
        setSpec(data.spec);
        setStatus(data.note ?? `Extracted with ${data.source === "model" ? "the model" : "the heuristic extractor"}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [text],
  );

  /**
   * Switching type re-lays out the spec we already have - no second model call.
   * This is the escape hatch for a misclassified diagram.
   */
  const switchType = useCallback(
    (type: DiagramType) => {
      setSpec((current) => (current ? { ...current, type } : current));
    },
    [],
  );

  const getSvg = () => svgRef.current?.querySelector("svg") as SVGSVGElement | null;

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const onExportPng = async () => {
    const svg = getSvg();
    if (!svg || !spec) return;
    await downloadPng(svg, `${slugifyFilename(spec.title)}.png`);
    flash("PNG downloaded");
  };

  const onExportSvg = () => {
    const svg = getSvg();
    if (!svg || !spec) return;
    downloadSvg(svg, `${slugifyFilename(spec.title)}.svg`);
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
          onClick={() => generate()}
          disabled={loading}
          type="button"
        >
          {loading ? "Extracting..." : "Generate diagram"}
        </button>

        {error && <p className={styles.error}>{error}</p>}
        {!error && status && <p className={styles.status}>{status}</p>}

        {spec && (
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
                  className={`${styles.chip} ${spec.type === type ? styles.chipActive : ""}`}
                  onClick={() => switchType(type)}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            {layout?.degradedFrom && (
              <p className={styles.hint}>
                No layout for <code>{layout.degradedFrom}</code> yet - showing it as a
                list.
              </p>
            )}
          </section>
        )}

        {spec && (
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
        )}
      </aside>

      <section className={styles.canvasWrap}>
        <div className={styles.canvasBar}>
          <span className={styles.meta}>
            {spec
              ? `${TYPE_LABELS[spec.type]} · ${spec.nodes.length} nodes · ${spec.edges.length} edges`
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

        <div className={styles.canvas}>
          {layout ? (
            <div
              ref={svgRef}
              className={styles.stage}
              style={{ transform: `scale(${zoom})` }}
            >
              <DiagramSvg layout={layout} theme={theme} />
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
