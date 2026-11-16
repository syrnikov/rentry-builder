// Named colors accepted by rentry (inline %color% and metadata color_name).
// Source: https://rentry.co/rentry-text-colors
const raw = `black silver gray white maroon red purple fuchsia green lime olive yellow navy blue teal aqua
aliceblue antiquewhite aquamarine azure beige bisque blanchedalmond blueviolet brown burlywood cadetblue
chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray
darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon
darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
dimgray dimgrey dodgerblue firebrick floralwhite forestgreen gainsboro ghostwhite gold goldenrod
greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen
lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow limegreen
linen magenta mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite
oldlace olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip
peachpuff peru pink plum powderblue rebeccapurple rosybrown royalblue saddlebrown salmon sandybrown
seagreen seashell sienna skyblue slateblue slategray slategrey snow springgreen steelblue tan thistle
tomato transparent turquoise violet wheat whitesmoke yellowgreen`;

export const RENTRY_COLORS: string[] = Array.from(new Set(raw.split(/\s+/).filter(Boolean)));
const set = new Set(RENTRY_COLORS);

export const isColorName = (v: string) => set.has(v.toLowerCase());
export const isHexColor = (v: string) => /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);

const RGBA_RE = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d*\.?\d+)\s*\)$/i;
export function parseRgba(v: string): [number, number, number, number] | null {
  const m = RGBA_RE.exec(v.trim());
  if (!m) return null;
  const [r, g, b, a] = [+m[1], +m[2], +m[3], +m[4]];
  if (r > 255 || g > 255 || b > 255 || a < 0 || a > 1) return null;
  return [r, g, b, a];
}
export const isRgbaColor = (v: string) => parseRgba(v) !== null;
export const isAnyColor = (v: string) => isColorName(v) || isHexColor(v) || isRgbaColor(v);

/** Normalise an rgba string so it contains no spaces (metadata values are space separated). */
export const compactRgba = (v: string) => {
  const p = parseRgba(v);
  return p ? `RGBA(${p[0]},${p[1]},${p[2]},${+p[3].toFixed(3)})` : v;
};
