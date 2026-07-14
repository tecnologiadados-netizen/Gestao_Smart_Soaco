/**
 * @deprecated Use scripts/sync-modelos-xlsx.mjs — copia os modelos oficiais da raiz do repo.
 */
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const syncScript = join(scriptDir, "sync-modelos-xlsx.mjs");
const result = spawnSync(process.execPath, [syncScript], { stdio: "inherit" });
process.exit(result.status ?? 1);
