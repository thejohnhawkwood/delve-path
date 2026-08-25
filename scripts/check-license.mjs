import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "LICENSE",
  "NOTICE",
  "AUTHORS.md",
  "PROVENANCE.md",
  "TRADEMARKS.md",
  "THIRD_PARTY_NOTICES.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CITATION.cff",
];

const missing = required.filter((f) => !existsSync(join(root, f)));
if (missing.length) {
  console.error("Missing license package files:", missing.join(", "));
  process.exit(1);
}

const license = readFileSync(join(root, "LICENSE"), "utf8");
if (!license.includes("Apache License") || !license.includes("Version 2.0")) {
  console.error("LICENSE is not unmodified Apache-2.0 text.");
  process.exit(1);
}
if (license.includes("Commons Clause") || license.includes("non-commercial")) {
  console.error("LICENSE must not add field-of-use restrictions.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.license !== "Apache-2.0") {
  console.error("package.json license must be Apache-2.0");
  process.exit(1);
}

const cargo = readFileSync(join(root, "Cargo.toml"), "utf8");
if (cargo.includes("LicenseRef-Proprietary")) {
  console.error("Cargo workspace still marked proprietary.");
  process.exit(1);
}
if (!cargo.includes('license = "Apache-2.0"')) {
  console.error("Cargo workspace license must be Apache-2.0");
  process.exit(1);
}

const notice = readFileSync(join(root, "NOTICE"), "utf8");
if (!notice.includes("Created by Philip Bird — Mithril Consulting")) {
  console.error("NOTICE missing required credit.");
  process.exit(1);
}

console.log("License package OK (Apache-2.0, required files, credit present).");
