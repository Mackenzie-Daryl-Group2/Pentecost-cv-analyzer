export function mergeTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key: string) => String(values[key] ?? ""));
}

export function textToHtml(value: string) {
  const escaped = value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character] || character));
  return `<div style="font-family:Arial,sans-serif;color:#17211b;line-height:1.6;max-width:720px">${escaped.replace(/\n/g, "<br>")}</div>`;
}
