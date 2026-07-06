#!/usr/bin/env node
/**
 * Gera um ZIP com tudo que a outra máquina precisa para replicar o módulo SGQ.
 *
 * Uso (na raiz do projeto):
 *   npm run package:deploy
 *   node scripts/package-for-deploy.mjs
 *
 * Saída: ../sgq-so-aco-modulo-AAAA-MM-DD-HHMMSS.zip
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Pastas ignoradas em qualquer nível. */
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "__pycache__",
  ".tmp-rcc-docx",
  "coverage",
  "out",
  "build",
  ".cursor",
]);

/** Arquivos ignorados pelo nome exato (em qualquer pasta). */
const EXCLUDE_FILES = new Set([
  ".env",
  ".DS_Store",
  "next-env.d.ts",
  "tsconfig.tsbuildinfo",
]);

/** Padrões de nome de arquivo (regex) para ignorar artefatos de teste/build. */
const EXCLUDE_FILE_PATTERNS = [
  /^npm-debug\.log/,
  /^yarn-debug\.log/,
  /^yarn-error\.log/,
  /\.pem$/,
  /\.pyc$/,
  /^test-.*\.(pdf|docx)$/i,
  /^api-test\.pdf$/i,
  /-test\.docx$/i,
  /^tmp-.*\.json$/i,
];

function shouldExclude(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const fileName = parts.at(-1) ?? "";

  if (parts.some((part) => EXCLUDE_DIRS.has(part))) {
    return true;
  }

  if (EXCLUDE_FILES.has(fileName)) {
    return true;
  }

  return EXCLUDE_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function collectFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(base, fullPath);

    if (shouldExclude(relative)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function createZipWithTar(files, outputPath, cwd) {
  const listFile = path.join(cwd, ".package-files-list.txt");
  const relativeFiles = files.map((file) =>
    path.relative(cwd, file).replace(/\\/g, "/")
  );

  fs.writeFileSync(listFile, relativeFiles.join("\n"), "utf8");

  try {
    execSync(`tar -a -cf "${outputPath}" -T "${listFile}"`, {
      cwd,
      stdio: "inherit",
      shell: true,
    });
  } finally {
    fs.unlinkSync(listFile);
  }
}

function createZipWithPowerShell(files, outputPath, cwd) {
  const staging = path.join(
    path.dirname(outputPath),
    `.staging-sgq-${formatTimestamp()}`
  );

  fs.mkdirSync(staging, { recursive: true });

  try {
    for (const file of files) {
      const relative = path.relative(cwd, file);
      const dest = path.join(staging, relative);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
    }

    const psDest = outputPath.replace(/'/g, "''");
    const psSrc = path.join(staging, "*").replace(/'/g, "''");

    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${psSrc}' -DestinationPath '${psDest}' -Force"`,
      { stdio: "inherit", shell: true }
    );
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function hasTar() {
  try {
    execSync("tar --version", { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

function printInstructions(outputPath, fileCount) {
  const fileName = path.basename(outputPath);
  console.log("");
  console.log("=".repeat(60));
  console.log("Pacote gerado com sucesso");
  console.log("=".repeat(60));
  console.log(`Arquivo : ${outputPath}`);
  console.log(`Arquivos: ${fileCount}`);
  console.log("");
  console.log("Na outra máquina:");
  console.log(`  1. Extrair ${fileName}`);
  console.log("  2. cp .env.example .env   (e preencher credenciais ERP)");
  console.log("  3. npm install");
  console.log("  4. pip install -r scripts/rcc-pdf/requirements.txt");
  console.log("     pip install -r scripts/rnc-pdf/requirements.txt");
  console.log("  5. npm run dev   (ou integrar src/ ao sistema existente)");
  console.log("");
  console.log("Python: requer Microsoft Word (docx2pdf no Windows).");
  console.log("Opcional: PYTHON_PATH no .env se o python não estiver no PATH.");
  console.log("=".repeat(60));
}

function main() {
  const outputName = `sgq-so-aco-modulo-${formatTimestamp()}.zip`;
  const outputPath = path.resolve(ROOT, "..", outputName);

  console.log("Coletando arquivos do projeto...");
  const files = collectFiles(ROOT);

  if (files.length === 0) {
    console.error("Nenhum arquivo encontrado para empacotar.");
    process.exit(1);
  }

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  console.log(`Empacotando ${files.length} arquivos...`);

  if (hasTar()) {
    createZipWithTar(files, outputPath, ROOT);
  } else {
    console.log("tar não encontrado — usando PowerShell Compress-Archive...");
    createZipWithPowerShell(files, outputPath, ROOT);
  }

  const sizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
  console.log(`Tamanho: ${sizeMb} MB`);
  printInstructions(outputPath, files.length);
}

main();
