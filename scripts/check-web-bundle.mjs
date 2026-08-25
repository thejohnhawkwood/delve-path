import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const blockedName = /\b(brett|iscwsa.*\.pdf|winserve.*manual|\.docx|\.xlsx)\b/i;
const blockedExt = /\.(pdf|docx|xlsx)$/i;
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path);
    else {
      const rel = path.slice(dist.length + 1);
      if (blockedExt.test(name) || blockedName.test(rel)) hits.push(rel);
    }
  }
}

try {
  walk(dist);
} catch (e) {
  console.error("dist/ missing. Run npm run build first.", e);
  process.exit(1);
}

if (hits.length) {
  console.error("Restricted material found in web bundle:", hits);
  process.exit(1);
}

const index = readFileSync(join(dist, "index.html"), "utf8");
if (/fonts\.googleapis|cdn\.jsdelivr|unpkg\.com/.test(index)) {
  console.error("index.html references a CDN.");
  process.exit(1);
}

console.log("Web bundle hygiene OK — no restricted research files, no CDN tags in index.html.");
