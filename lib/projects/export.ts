import type { Config } from "./model";
export function download(blob: Blob, filename: string) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function calendar(config: Config, uid: string) {
  const escape = (v: string) =>
    v
      .replaceAll("\\", "\\\\")
      .replace(/\r\n?|\n/g, "\\n")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,");
  const time = (v: string) =>
    new Date(v)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const fold = (line: string) => {
    let result = "",
      len = 0;
    for (const ch of line) {
      const bytes = new TextEncoder().encode(ch).length;
      if (len + bytes > 75) {
        result += "\r\n ";
        len = 1;
      }
      result += ch;
      len += bytes;
    }
    return result;
  };
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LoopKit//Community Event//EN",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + time(new Date().toISOString()),
      "DTSTART:" + time(config.ends),
      "SUMMARY:" + escape(config.title),
      "DESCRIPTION:" + escape(config.description),
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
export function csv(rows: (string | number)[][]) {
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let x = String(cell);
            if (typeof cell === "string" && /^[\s]*[=+@-]/.test(x)) x = "'" + x;
            return '"' + x.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export async function imageExport(title: string, rows: string[]) {
  const c = document.createElement("canvas"),
    width = 1000,
    height = 150 + rows.length * 44;
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw Error("Canvas unavailable.");
  ctx.fillStyle = "#0c1017";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#a3e635";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(title, 44, 64, width - 88);
  ctx.font = "22px sans-serif";
  ctx.fillStyle = "#f8fafc";
  rows.forEach((row, i) => ctx.fillText(row, 44, 116 + i * 44, width - 88));
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(Error("Export failed.")))),
  );
  download(blob, "project.png");
}
