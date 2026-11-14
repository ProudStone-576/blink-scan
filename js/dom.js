const SVG_NS = "http://www.w3.org/2000/svg";

export const $ = (id) => document.getElementById(id);

// `name` is a symbol in the sprite at the top of index.html
export function iconEl(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

export function showNotice(text) {
  const notice = $("notice");
  notice.hidden = !text;
  notice.replaceChildren(...(text ? [iconEl("warn"), document.createTextNode(text)] : []));
}

export const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const fmtDay = (iso) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
export const doneToday = (iso) => Boolean(iso) && new Date(iso).toDateString() === new Date().toDateString();
