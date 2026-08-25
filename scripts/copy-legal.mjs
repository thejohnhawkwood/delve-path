import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "dist", "legal");
mkdirSync(dest, { recursive: true });
copyFileSync(join(root, "LICENSE"), join(dest, "LICENSE.txt"));
copyFileSync(join(root, "NOTICE"), join(dest, "NOTICE.txt"));
copyFileSync(join(root, "THIRD_PARTY_NOTICES.md"), join(dest, "THIRD_PARTY_NOTICES.md"));
copyFileSync(join(root, "AUTHORS.md"), join(dest, "AUTHORS.md"));
console.log("Copied legal files to dist/legal");
