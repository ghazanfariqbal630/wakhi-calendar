// Builds the calendar-app feeds from the same month and holiday tables the web page uses.
// Run after changing holidays:  node tools/make-ics.js
//   wakhi-calendar.ics  every day's Wakhi date + month starts + holidays
//   wakhi-holidays.ics  month starts + holidays only
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "wakhi-calendar.html"), "utf8");
const from = html.indexOf("  const MONTHS = ");
const to = html.indexOf("  const label = ");
if (from < 0 || to < 0) throw new Error("calendar tables not found in wakhi-calendar.html");
const { MONTHS, yearMonths, holiday, DAY } =
  new Function(html.slice(from, to) + "\nreturn { MONTHS, yearMonths, holiday, DAY };")();

const FIRST = 2024, LAST = 2032;          // Wakhi years 2024-25 … 2032-33; Google Calendar drops feeds much over ~1 MB
const EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const esc = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const label = Y => `${Y}-${String(Y + 1).slice(2)}`;
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

// RFC 5545: lines over 75 bytes continue on the next line after a space
function fold(line) {
  const out = [];
  let buf = Buffer.from(line, "utf8");
  while (buf.length > 75) {
    let cut = 75;
    while ((buf[cut] & 0xc0) === 0x80) cut--;      // never split a UTF-8 character
    out.push(buf.slice(0, cut).toString("utf8"));
    buf = Buffer.concat([Buffer.from(" "), buf.slice(cut)]);
  }
  out.push(buf.toString("utf8"));
  return out.join("\r\n");
}

function event(uid, d, summary, desc) {
  const next = new Date(d.getTime() + DAY);
  return ["BEGIN:VEVENT", `UID:${uid}-${ymd(d)}@wakhi-calendar`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${esc(summary)}`, desc ? `DESCRIPTION:${esc(desc)}` : null,
    "TRANSP:TRANSPARENT", "END:VEVENT"].filter(Boolean);
}

function build(name, everyDay) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KRD Aman Maad//Wakhi Shole Hisobet//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${name}`,
    "X-WR-CALDESC:Wakhi Sholẽ Hisobet · Kũngra Research & Development (KRD · Aman Maad)",
    "X-WR-TIMEZONE:Asia/Karachi", "REFRESH-INTERVAL;VALUE=DURATION:P1D", "X-PUBLISHED-TTL:P1D"];
  for (let Y = FIRST; Y <= LAST; Y++) {
    for (const m of yearMonths(Y)) {
      const endD = new Date(m.start + (m.len - 1) * DAY);
      for (let n = 1; n <= m.len; n++) {
        const d = new Date(m.start + (n - 1) * DAY);
        if (n === 1) {
          let title = everyDay ? `1 ${m.name} · new month` : `${m.name} begins`;
          if (m.i === 0) title += ` · Wakhi year ${label(Y)}`;
          lines.push(...event("month", d, title,
            `Month ${m.i + 1} of ${label(Y)}, ${m.len} days: ${d.getUTCDate()} ${EN[d.getUTCMonth()]} – ${endD.getUTCDate()} ${EN[endD.getUTCMonth()]} ${endD.getUTCFullYear()}`));
        } else if (everyDay) {
          lines.push(...event("day", d, `${n} ${m.name}`));
        }
        const h = holiday(d);
        if (h) lines.push(...event("hol", d, h[0], h[1] ? `${h[1]} · ${n} ${m.name}` : `${n} ${m.name}`));
      }
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

for (const [file, name, everyDay] of [["wakhi-calendar.ics", "Wakhi Calendar", true],
                                      ["wakhi-holidays.ics", "Wakhi Holidays", false]]) {
  const text = build(name, everyDay);
  fs.writeFileSync(path.join(root, file), text);
  console.log(file, (text.length / 1024).toFixed(0) + " KB", (text.match(/BEGIN:VEVENT/g) || []).length, "events");
}
