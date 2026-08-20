"use client";

import { useMemo, useState } from "react";

import { ICONS, ICON_VIEWBOX, type Icon } from "@/lib/icons";
import styles from "./IconPicker.module.css";

export interface IconPickerProps {
  /** Icon currently on the selected node, auto-matched or chosen. */
  value: string | null;
  /** True when `value` came from the matcher rather than from the user. */
  auto: boolean;
  onPick: (id: string | null) => void;
  onReset: () => void;
}

/**
 * The browsable half of the icon library.
 *
 * The matcher handles the common case, so this only has to cover the times it
 * guessed wrong or picked nothing. Search is over labels and keywords together
 * - people look for "customer" as readily as "person".
 */
export function IconPicker({ value, auto, onPick, onReset }: IconPickerProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICONS;
    return ICONS.filter(
      (icon) =>
        icon.label.toLowerCase().includes(q) ||
        icon.id.includes(q) ||
        icon.keywords.some((k) => k.includes(q)),
    );
  }, [query]);

  return (
    <div className={styles.wrap}>
      <input
        className={styles.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search icons"
        spellCheck={false}
      />

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.none} ${value === null ? styles.noneActive : ""}`}
          onClick={() => onPick(null)}
        >
          No icon
        </button>
        {!auto && (
          <button type="button" className={styles.none} onClick={onReset}>
            Auto
          </button>
        )}
      </div>

      {auto && value && <p className={styles.note}>Matched automatically.</p>}

      <div className={styles.grid}>
        {results.map((icon) => (
          <button
            key={icon.id}
            type="button"
            title={icon.label}
            aria-label={icon.label}
            aria-pressed={value === icon.id}
            className={`${styles.cell} ${value === icon.id ? styles.cellActive : ""}`}
            onClick={() => onPick(icon.id)}
          >
            <IconGlyph icon={icon} />
          </button>
        ))}
        {results.length === 0 && <p className={styles.note}>Nothing matches “{query}”.</p>}
      </div>
    </div>
  );
}

export function IconGlyph({ icon, size = 18 }: { icon: Icon; size?: number }) {
  return (
    <svg
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {icon.shapes.map((shape, i) => {
        if (shape.k === "path") return <path key={i} d={shape.d} />;
        if (shape.k === "circle") return <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} />;
        if (shape.k === "line") {
          return <line key={i} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} />;
        }
        return (
          <rect
            key={i}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            rx={shape.r ?? 1.5}
          />
        );
      })}
    </svg>
  );
}
