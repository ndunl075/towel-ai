/**
 * Client-side export. The rendered SVG is already the source of truth for
 * pixels, so PNG is just a rasterisation of the same markup - no second
 * renderer to keep in sync.
 */

export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  // Interaction-only attributes have no business in an exported file.
  clone.removeAttribute("style");
  for (const el of clone.querySelectorAll("[style*='cursor']")) {
    el.removeAttribute("style");
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

export function downloadSvg(svg: SVGSVGElement, filename: string): void {
  const blob = new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), filename, true);
}

export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const width = Number(svg.getAttribute("width")) || svg.clientWidth;
  const height = Number(svg.getAttribute("height")) || svg.clientHeight;
  const source = serializeSvg(svg);
  // A data URL keeps the image same-origin, so the canvas stays untainted.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
      "image/png",
    );
  });
}

export async function downloadPng(svg: SVGSVGElement, filename: string, scale = 2): Promise<void> {
  const blob = await svgToPngBlob(svg, scale);
  triggerDownload(URL.createObjectURL(blob), filename, true);
}

/** Returns false when the browser blocks clipboard image writes. */
export async function copyPngToClipboard(svg: SVGSVGElement, scale = 2): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  try {
    const blob = await svgToPngBlob(svg, scale);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterise the SVG"));
    image.src = src;
  });
}

function triggerDownload(url: string, filename: string, revoke: boolean): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugifyFilename(title: string | null): string {
  const base = (title ?? "diagram")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "diagram";
}
