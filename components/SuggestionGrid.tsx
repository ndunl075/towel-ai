"use client";

import { useMemo, useState } from "react";

import type { DiagramType } from "@/lib/spec";
import type { Suggestion } from "@/lib/suggestions";
import type { Theme } from "@/lib/theme";
import { DiagramSvg } from "./DiagramSvg";
import styles from "./SuggestionGrid.module.css";

export interface SuggestionGridProps {
  suggestions: Suggestion[];
  theme: Theme;
  current: DiagramType;
  labels: Record<DiagramType, string>;
  onPick: (type: DiagramType) => void;
  /** How many tiles to show before the reveal. */
  collapsedCount?: number;
}

/**
 * The alternatives, drawn rather than named.
 *
 * Every tile is the real renderer on the real spec, at the size the sidebar
 * has room for - not an icon standing in for one. Picking one is free, because
 * it only changes which layout function runs over the spec we already hold.
 */
export function SuggestionGrid({
  suggestions,
  theme,
  current,
  labels,
  onPick,
  collapsedCount = 4,
}: SuggestionGridProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    if (expanded || suggestions.length <= collapsedCount) return suggestions;
    const head = suggestions.slice(0, collapsedCount);
    // The active type must always be on screen, even when it ranks poorly -
    // otherwise the control stops showing what is currently selected.
    if (head.some((s) => s.type === current)) return head;
    const active = suggestions.find((s) => s.type === current);
    return active ? [...head.slice(0, collapsedCount - 1), active] : head;
  }, [suggestions, expanded, collapsedCount, current]);

  const hidden = suggestions.length - visible.length;

  return (
    <>
      <div className={styles.grid}>
        {visible.map((suggestion) => {
          const active = suggestion.type === current;
          return (
            <button
              key={suggestion.type}
              type="button"
              className={`${styles.tile} ${active ? styles.tileActive : ""} ${
                suggestion.fits ? "" : styles.tileUnfit
              }`}
              aria-pressed={active}
              title={`${labels[suggestion.type]} - ${suggestion.reason}`}
              onClick={() => onPick(suggestion.type)}
            >
              <span className={styles.preview} style={{ background: theme.background }} aria-hidden>
                {/* Distinct prefix per tile: the arrow markers live in <defs>
                    and would otherwise collide across the diagrams on screen. */}
                <DiagramSvg
                  layout={suggestion.layout}
                  theme={theme}
                  idPrefix={`suggestion-${suggestion.type}`}
                />
              </span>
              <span className={styles.caption}>
                <span className={styles.name}>{labels[suggestion.type]}</span>
                <span className={styles.reason}>{suggestion.reason}</span>
              </span>
            </button>
          );
        })}
      </div>

      {(hidden > 0 || expanded) && (
        <button type="button" className={styles.more} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </>
  );
}
