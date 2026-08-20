import { DiagramSvg } from "@/components/DiagramSvg";
import { FIXTURES } from "@/lib/fixtures";
import { autoIconFor } from "@/lib/icons";
import { layoutSpec } from "@/lib/layout";
import { getTheme, THEMES } from "@/lib/theme";

export const metadata = { title: "Renderer fixtures" };

/**
 * Every layout rendered from a fixed spec. Rendering is deterministic, so this
 * page is the fastest way to see a layout regression - and it never touches
 * the model.
 */
/**
 * `?theme=<id>` renders the whole sheet in one theme. Themes change the
 * typeface, and the typeface changes every measured box, so a layout can only
 * be called correct once it has been seen in all four.
 */
export default async function Fixtures({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const { theme: requested } = await searchParams;
  const theme = getTheme(requested);
  return (
    <main style={{ padding: 32, display: "grid", gap: 32 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.02em" }}>Renderer fixtures</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Static specs through the real layout engine and renderer. No model call.
          Icons are auto-matched, as they are by default in the editor, so this page
          catches icon sizing regressions too.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>
          {THEMES.map((option) => (
            <a
              key={option.id}
              href={`/fixtures?theme=${option.id}`}
              style={{
                marginRight: 12,
                fontWeight: option.id === theme.id ? 700 : 400,
                fontFamily: option.font.family,
              }}
            >
              {option.name}
            </a>
          ))}
        </p>
      </header>

      {FIXTURES.map((fixture) => {
        const layout = layoutSpec(fixture.spec, theme, (node) =>
          autoIconFor(node.label, node.detail),
        );
        return (
          <section key={fixture.name} style={{ display: "grid", gap: 8 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 650,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              {fixture.name}
              {layout.degradedFrom ? ` (degraded from ${layout.degradedFrom})` : ""}
            </h2>
            <div
              style={{
                width: "fit-content",
                background: theme.background,
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 1px 2px rgba(27,26,24,.06), 0 10px 28px rgba(27,26,24,.08)",
              }}
            >
              <DiagramSvg layout={layout} theme={theme} idPrefix={`fx-${fixture.spec.type}`} />
            </div>
          </section>
        );
      })}
    </main>
  );
}
