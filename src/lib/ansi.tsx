import type { CSSProperties } from "react";

const ESC = String.fromCharCode(27);
const OSC = new RegExp(`${ESC}[\\]P^_X][^\\u0007]*?(?:\\u0007|${ESC}\\\\)`, "g");
const ESC_SINGLE = new RegExp(`${ESC}[@-Z\\\\-_]`, "g");
const CSI = new RegExp(`${ESC}\\[([0-9;]*)([ -/]*)([@-~])`, "g");
const ANY_CSI = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");

const BASE_COLORS = [
  "#1e1e1e", "#cd3131", "#0dbc79", "#e5e510",
  "#2472c8", "#bc3fbc", "#11a8cd", "#e5e5e5",
  "#666666", "#f14c4c", "#23d18b", "#f5f543",
  "#3b8eea", "#d670d6", "#29b8db", "#ffffff",
];

function color256(n: number): string {
  if (n < 16) return BASE_COLORS[n] ?? "";
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return `rgb(${v}, ${v}, ${v})`;
  }
  const i = n - 16;
  const conv = (x: number) => (x === 0 ? 0 : 55 + x * 40);
  return `rgb(${conv(Math.floor(i / 36))}, ${conv(Math.floor((i % 36) / 6))}, ${conv(i % 6)})`;
}

type Style = {
  color?: string;
  background?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
};

function applyCodes(prev: Style, params: number[]): Style {
  let style: Style = { ...prev };
  for (let i = 0; i < params.length; i++) {
    const code = params[i];
    if (code === 0) style = {};
    else if (code === 1) style.bold = true;
    else if (code === 2) style.dim = true;
    else if (code === 3) style.italic = true;
    else if (code === 4) style.underline = true;
    else if (code === 22) { style.bold = false; style.dim = false; }
    else if (code === 23) style.italic = false;
    else if (code === 24) style.underline = false;
    else if (code === 39) style.color = undefined;
    else if (code === 49) style.background = undefined;
    else if (code >= 30 && code <= 37) style.color = BASE_COLORS[code - 30];
    else if (code >= 90 && code <= 97) style.color = BASE_COLORS[code - 90 + 8];
    else if (code >= 40 && code <= 47) style.background = BASE_COLORS[code - 40];
    else if (code >= 100 && code <= 107) style.background = BASE_COLORS[code - 100 + 8];
    else if (code === 38 || code === 48) {
      const key = code === 38 ? "color" : "background";
      if (params[i + 1] === 5) {
        style[key] = color256(params[i + 2]);
        i += 2;
      } else if (params[i + 1] === 2) {
        style[key] = `rgb(${params[i + 2]}, ${params[i + 3]}, ${params[i + 4]})`;
        i += 4;
      }
    }
  }
  return style;
}

function styleToCss(style: Style): CSSProperties | undefined {
  const css: CSSProperties = {};
  if (style.color) css.color = style.color;
  if (style.background) css.backgroundColor = style.background;
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = "italic";
  if (style.underline) css.textDecoration = "underline";
  if (style.dim) css.opacity = 0.7;
  return Object.keys(css).length > 0 ? css : undefined;
}

type Segment = { text: string; css?: CSSProperties };

function parse(input: string): Segment[] {
  const cleaned = input.replace(OSC, "").replace(ESC_SINGLE, "");
  const segments: Segment[] = [];
  let style: Style = {};
  let last = 0;
  CSI.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CSI.exec(cleaned)) !== null) {
    if (m.index > last) segments.push({ text: cleaned.slice(last, m.index), css: styleToCss(style) });
    if (m[3] === "m") {
      const params = m[1] === "" ? [0] : m[1].split(";").map((p) => Number(p) || 0);
      style = applyCodes(style, params);
    }
    last = CSI.lastIndex;
  }
  if (last < cleaned.length) segments.push({ text: cleaned.slice(last), css: styleToCss(style) });
  return segments;
}

export function stripAnsi(text: string): string {
  return text.replace(OSC, "").replace(ANY_CSI, "").replace(ESC_SINGLE, "");
}

export default function Ansi({ text }: { text: string }) {
  const segments = parse(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.css ? (
          <span key={i} style={seg.css}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
