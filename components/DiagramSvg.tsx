import type { Layout, RenderEdge, RenderGroup, RenderNode } from "@/lib/layout";
import { accentFor, type Theme } from "@/lib/theme";
import { measureText } from "@/lib/text";

export interface DiagramSvgProps {
  layout: Layout;
  theme: Theme;
  /** Ids currently selected in the editor. */
  selected?: string | null;
  onNodePointerDown?: (id: string, event: React.PointerEvent<SVGGElement>) => void;
  onNodeDoubleClick?: (id: string, event: React.MouseEvent<SVGGElement>) => void;
  onBackgroundPointerDown?: (event: React.PointerEvent<SVGSVGElement>) => void;
  interactive?: boolean;
  /** Stable dom id, needed so exported markup keeps its defs references. */
  idPrefix?: string;
}

/**
 * The whole renderer. Layout decides geometry, the theme decides paint, and
 * this file only walks the two. Nothing here reads the raw text or the model.
 */
export function DiagramSvg({
  layout,
  theme,
  selected = null,
  onNodePointerDown,
  onNodeDoubleClick,
  onBackgroundPointerDown,
  interactive = false,
  idPrefix = "napkin",
}: DiagramSvgProps) {
  const { width, height } = layout;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={layout.title ?? "Generated diagram"}
      onPointerDown={onBackgroundPointerDown}
      style={{ display: "block", touchAction: "none" }}
    >
      <defs>
        {theme.accents.map((accent, i) => (
          <marker
            key={i}
            id={`${idPrefix}-arrow-${i}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth={theme.edge.arrow}
            markerHeight={theme.edge.arrow}
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill={accent.stroke} />
          </marker>
        ))}
        <marker
          id={`${idPrefix}-arrow-default`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={theme.edge.arrow}
          markerHeight={theme.edge.arrow}
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill={theme.edge.stroke} />
        </marker>
        {theme.node.shadow && (
          <filter id={`${idPrefix}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={theme.node.shadow} />
          </filter>
        )}
      </defs>

      <rect x={0} y={0} width={width} height={height} fill={theme.background} />

      {layout.title && (
        <text
          x={40}
          y={40 + theme.font.title * 0.82}
          fill={theme.ink}
          fontFamily={theme.font.family}
          fontSize={theme.font.title}
          fontWeight={650}
          letterSpacing="-0.01em"
        >
          {layout.title}
        </text>
      )}

      <g>
        {layout.groups.map((group) => (
          <GroupBox key={group.id} group={group} theme={theme} />
        ))}
      </g>

      <g>
        {layout.edges.map((edge) => (
          <Edge key={edge.id} edge={edge} theme={theme} idPrefix={idPrefix} />
        ))}
      </g>

      <g>
        {layout.nodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            theme={theme}
            selected={selected === node.id}
            interactive={interactive}
            idPrefix={idPrefix}
            onPointerDown={onNodePointerDown}
            onDoubleClick={onNodeDoubleClick}
          />
        ))}
      </g>
    </svg>
  );
}

function GroupBox({ group, theme }: { group: RenderGroup; theme: Theme }) {
  const accent = accentFor(theme, group.accent);
  return (
    <g>
      <rect
        x={group.x}
        y={group.y}
        width={group.w}
        height={group.h}
        rx={theme.group.radius}
        fill={theme.group.fill}
        stroke={theme.group.stroke}
        strokeWidth={1}
      />
      {group.label && (
        <text
          x={group.x + 14}
          y={group.y + theme.font.detail * 1.5}
          fill={accent.stroke}
          fontFamily={theme.font.family}
          fontSize={theme.font.detail}
          fontWeight={600}
          letterSpacing="0.04em"
        >
          {group.label.toUpperCase()}
        </text>
      )}
    </g>
  );
}

function Edge({
  edge,
  theme,
  idPrefix,
}: {
  edge: RenderEdge;
  theme: Theme;
  idPrefix: string;
}) {
  const accent = edge.accent === null ? null : accentFor(theme, edge.accent);
  const stroke = accent?.stroke ?? theme.edge.stroke;
  const marker =
    edge.accent === null
      ? `${idPrefix}-arrow-default`
      : `${idPrefix}-arrow-${edge.accent % theme.accents.length}`;

  const labelWidth = edge.label ? measureText(edge.label, theme.font.edgeLabel) + 12 : 0;

  return (
    <g>
      <path
        d={edge.d}
        fill="none"
        stroke={stroke}
        strokeWidth={theme.edge.width}
        strokeLinecap="round"
        markerEnd={edge.arrow ? `url(#${marker})` : undefined}
      />
      {edge.label && edge.labelAt && (
        <g>
          <rect
            x={edge.labelAt.x - labelWidth / 2}
            y={edge.labelAt.y - theme.font.edgeLabel}
            width={labelWidth}
            height={theme.font.edgeLabel * 2}
            rx={5}
            fill={theme.edge.labelBackground}
          />
          <text
            x={edge.labelAt.x}
            y={edge.labelAt.y + theme.font.edgeLabel * 0.35}
            textAnchor="middle"
            fill={theme.muted}
            fontFamily={theme.font.family}
            fontSize={theme.font.edgeLabel}
            fontWeight={500}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}

function Node({
  node,
  theme,
  selected,
  interactive,
  idPrefix,
  onPointerDown,
  onDoubleClick,
}: {
  node: RenderNode;
  theme: Theme;
  selected: boolean;
  interactive: boolean;
  idPrefix: string;
  onPointerDown?: DiagramSvgProps["onNodePointerDown"];
  onDoubleClick?: DiagramSvgProps["onNodeDoubleClick"];
}) {
  const accent = accentFor(theme, node.accent);
  const isHeader = node.shape === "header";
  const radius =
    node.shape === "pill" ? Math.min(node.h / 2, 16) : theme.node.radius;

  const badgeInset = node.badge ? 30 : 0;
  const textLeft = node.x + theme.node.paddingX + badgeInset;
  const centerX = node.x + node.w / 2 + badgeInset / 2;

  const labelHeight = node.labelLines.length * theme.font.label * theme.font.lineHeight;
  const detailHeight = node.detailLines.length
    ? node.detailLines.length * theme.font.detail * theme.font.lineHeight + 4
    : 0;
  let cursorY = node.y + (node.h - labelHeight - detailHeight) / 2 + theme.font.label * 0.95;

  return (
    <g
      onPointerDown={interactive && onPointerDown ? (e) => onPointerDown(node.id, e) : undefined}
      onDoubleClick={interactive && onDoubleClick ? (e) => onDoubleClick(node.id, e) : undefined}
      style={interactive ? { cursor: "grab" } : undefined}
    >
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={radius}
        fill={isHeader ? accent.stroke : accent.fill}
        stroke={isHeader ? accent.stroke : accent.stroke}
        strokeWidth={theme.node.strokeWidth}
        filter={theme.node.shadow ? `url(#${idPrefix}-shadow)` : undefined}
      />

      {selected && (
        <rect
          x={node.x - 4}
          y={node.y - 4}
          width={node.w + 8}
          height={node.h + 8}
          rx={radius + 4}
          fill="none"
          stroke={accent.stroke}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.85}
        />
      )}

      {node.badge && (
        <>
          <circle
            cx={node.x + 26}
            cy={node.y + node.h / 2}
            r={11}
            fill={accent.stroke}
          />
          <text
            x={node.x + 26}
            y={node.y + node.h / 2 + 4}
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily={theme.font.family}
            fontSize={11.5}
            fontWeight={650}
          >
            {node.badge}
          </text>
        </>
      )}

      {node.labelLines.map((line, i) => {
        const y = cursorY + i * theme.font.label * theme.font.lineHeight;
        return (
          <text
            key={`l${i}`}
            x={node.align === "center" ? centerX : textLeft}
            y={y}
            textAnchor={node.align === "center" ? "middle" : "start"}
            fill={isHeader ? "#FFFFFF" : accent.text}
            fontFamily={theme.font.family}
            fontSize={theme.font.label}
            fontWeight={600}
            letterSpacing="-0.005em"
          >
            {line}
          </text>
        );
      })}

      {node.detailLines.map((line, i) => {
        const y =
          cursorY +
          labelHeight +
          2 +
          i * theme.font.detail * theme.font.lineHeight;
        return (
          <text
            key={`d${i}`}
            x={node.align === "center" ? centerX : textLeft}
            y={y}
            textAnchor={node.align === "center" ? "middle" : "start"}
            fill={isHeader ? "rgba(255,255,255,0.82)" : theme.muted}
            fontFamily={theme.font.family}
            fontSize={theme.font.detail}
            fontWeight={450}
          >
            {line}
          </text>
        );
      })}
    </g>
  );
}
