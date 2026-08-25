import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "sbom");
mkdirSync(outDir, { recursive: true });

function npmSbom() {
  try {
    execSync("npm sbom --sbom-format spdx > sbom/npm.spdx.json", {
      cwd: root,
      shell: true,
      stdio: "inherit",
    });
    return true;
  } catch {
    console.warn("npm sbom failed; writing a lockfile-derived SPDX stub.");
    return false;
  }
}

function cargoPackages() {
  const lock = readFileSync(join(root, "Cargo.lock"), "utf8");
  const names = [];
  let current = null;
  for (const line of lock.split(/\r?\n/)) {
    if (line === "[[package]]") current = {};
    else if (current && line.startsWith("name = ")) current.name = line.slice(8, -1);
    else if (current && line.startsWith("version = ")) {
      current.version = line.slice(11, -1);
      if (current.name) names.push(current);
      current = null;
    }
  }
  return names;
}

const npmOk = npmSbom();
const cargo = cargoPackages();
const stub = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: "delvepath-cargo",
  documentNamespace: "https://mithrilconsulting.io/sbom/delvepath-cargo",
  creationInfo: {
    created: new Date().toISOString(),
    creators: ["Tool: scripts/generate-sbom.mjs"],
  },
  packages: cargo.map((p, i) => ({
    name: p.name,
    versionInfo: p.version,
    SPDXID: `SPDXRef-cargo-${i}`,
    downloadLocation: "NOASSERTION",
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
  })),
};
writeFileSync(join(outDir, "cargo.spdx.json"), JSON.stringify(stub, null, 2));
if (!npmOk && !existsNpm()) {
  writeFileSync(
    join(outDir, "npm.spdx.json"),
    JSON.stringify({ name: "delvepath-npm", comment: "npm sbom unavailable; see package-lock.json" }, null, 2)
  );
}

function existsNpm() {
  try {
    readFileSync(join(outDir, "npm.spdx.json"));
    return true;
  } catch {
    return false;
  }
}

console.log(`SBOM written to ${outDir} (${cargo.length} Cargo.lock packages).`);
