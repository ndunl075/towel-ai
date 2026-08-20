"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Offset } from "@/lib/document";
import type { Layout } from "@/lib/layout";
import type { DiagramSpec } from "@/lib/spec";
import type { Theme } from "@/lib/theme";
import { DiagramSvg } from "./DiagramSvg";
import styles from "./Canvas.module.css";

export interface CanvasProps {
  layout: Layout;
  spec: DiagramSpec;
  theme: Theme;
  zoom: number;
  offsets: Record<string, Offset>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Fired continuously while dragging; must not touch history. */
  onDragPreview: (offsets: Record<string, Offset>) => void;
  /** Fired once when the pointer is released; this is the undoable step. */
  onDragCommit: (offsets: Record<string, Offset>) => void;
  onEditLabel: (id: string, label: string) => void;
}

interface DragState {
  id: string;
  pointerId: number;
  originX: number;
  originY: number;
  base: Offset;
}

/**
 * The editing surface. Everything here mutates the document and re-renders
 * from it - there is no second source of truth for what is on screen.
 */
export function Canvas({
  layout,
  spec,
  theme,
  zoom,
  offsets,
  selected,
  onSelect,
  onDragPreview,
  onDragCommit,
  onEditLabel,
}: CanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // A re-extract replaces the spec underneath us; drop any open editor.
  useEffect(() => setEditing(null), [spec]);

  const beginDrag = useCallback(
    (id: string, event: React.PointerEvent<SVGGElement>) => {
      if (editing) return;
      event.stopPropagation();
      onSelect(id);
      dragRef.current = {
        id,
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        base: offsets[id] ?? { dx: 0, dy: 0 },
      };
      setDragging(true);
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    },
    [editing, offsets, onSelect],
  );

  const moveDrag = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      // Screen pixels are zoomed pixels; layout space is not.
      onDragPreview({
        ...offsets,
        [drag.id]: {
          dx: drag.base.dx + (event.clientX - drag.originX) / zoom,
          dy: drag.base.dy + (event.clientY - drag.originY) / zoom,
        },
      });
    },
    [offsets, onDragPreview, zoom],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      const dx = drag.base.dx + (event.clientX - drag.originX) / zoom;
      const dy = drag.base.dy + (event.clientY - drag.originY) / zoom;
      // A click is a drag of zero length; do not spend a history entry on it.
      if (Math.abs(dx - drag.base.dx) < 0.5 && Math.abs(dy - drag.base.dy) < 0.5) {
        onDragPreview(offsets);
        return;
      }
      onDragCommit({ ...offsets, [drag.id]: { dx, dy } });
    },
    [offsets, onDragCommit, onDragPreview, zoom],
  );

  const startEditing = useCallback(
    (id: string) => {
      const node = spec.nodes.find((n) => n.id === id);
      if (!node) return;
      setEditing({ id, value: node.label });
    },
    [spec],
  );

  const commitEditing = useCallback(() => {
    if (!editing) return;
    onEditLabel(editing.id, editing.value);
    setEditing(null);
  }, [editing, onEditLabel]);

  const editingBox = editing ? layout.nodes.find((n) => n.id === editing.id) : null;

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      style={{
        transform: `scale(${zoom})`,
        width: layout.width,
        height: layout.height,
        cursor: dragging ? "grabbing" : undefined,
      }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <DiagramSvg
        layout={layout}
        theme={theme}
        selected={selected}
        interactive
        onNodePointerDown={beginDrag}
        onNodeDoubleClick={(id) => startEditing(id)}
        onBackgroundPointerDown={() => onSelect(null)}
      />

      {editing && editingBox && (
        <textarea
          ref={inputRef}
          className={styles.inlineEditor}
          value={editing.value}
          style={{
            left: editingBox.x + 6,
            top: editingBox.y + 6,
            width: editingBox.w - 12,
            height: editingBox.h - 12,
            fontFamily: theme.font.family,
            fontSize: theme.font.label,
            lineHeight: theme.font.lineHeight,
            color: theme.ink,
            background: theme.background,
            borderColor: theme.accents[editingBox.accent % theme.accents.length].stroke,
          }}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={commitEditing}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitEditing();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEditing(null);
            }
            e.stopPropagation();
          }}
        />
      )}
    </div>
  );
}
