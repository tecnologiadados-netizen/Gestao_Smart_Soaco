/**
 * Importa documentos SGQ a partir de pastas de migração (planilha + arquivos de revisão).
 *
 * Uso:
 *   npx tsx scripts/import-sgq-documentos-migracao.ts --pasta "C:\...\Teste Gestão" --dry-run
 *   npx tsx scripts/import-sgq-documentos-migracao.ts --pasta "C:\...\Teste Gestão"
 *   npx tsx scripts/import-sgq-documentos-migracao.ts --pasta "..." --force
 *
 * Planilha esperada (1 arquivo .xlsx):
 *   - 1 documento por aba (ou 1 aba só, formato antigo)
 *   - Cabeçalho com: Código | Nome | Cadastro | Dat. Cad. | Elaborador | …
 *   - Código com ":" (MP-SA-0001:01) ou "R" (MP-SA-0001R01)
 *   - Se a aba se chama como o código-base, ela prevalece sobre código errado na linha
 *
 * Arquivos (mesmo diretório da planilha OU subpasta "Revisões {CODIGO}"):
 *   nomes tipo "MP-SA-0001R01 Titulo.pdf" / ".pdf.pptx" / ".docx"
 * Tipo e setor ficam vazios para preenchimento manual depois na UI.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { prisma } from '../src/config/prisma.js';
import { saveQualidadeAnexo } from '../src/utils/qualidadeUpload.js';

type PessoaResolvida = {
  valor: string;
  vinculado: boolean;
  original: string;
};

type LinhaRevisao = {
  codigoCompleto: string;
  codigoBase: string;
  revisao: string;
  titulo: string;
  cadastro: string;
  dataCadastro: string | null;
  elaborador: string;
  dataElaboracao: string | null;
  consenso: string;
  dataConsenso: string | null;
  aprovador: string;
  dataAprovacao: string | null;
};

type DocImport = {
  codigoBase: string;
  titulo: string;
  linhas: LinhaRevisao[];
  pastaRevisoes: string;
  planilha: string;
};

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');
  const pastaIdx = argv.indexOf('--pasta');
  const pasta =
    pastaIdx >= 0 && argv[pastaIdx + 1]
      ? path.resolve(argv[pastaIdx + 1]!)
      : '';
  return { dryRun, force, pasta };
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cellStr(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const d = new Date(
        Date.UTC(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0)
      );
      return d.toISOString();
    }
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}T12:00:00.000Z`;
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

function parseCodigo(codigo: string): { base: string; revisao: string } | null {
  const t = codigo.trim();
  // MP-SA-0001:01 (planilha) ou MP-SA-0001R01 (nome de arquivo)
  let m = t.match(/^(.+):(\d{2})$/);
  if (m) return { base: m[1]!, revisao: m[2]! };
  m = t.match(/^(.+?)R(\d{2})(?:\b|$)/i);
  if (m) return { base: m[1]!, revisao: m[2]! };
  return null;
}

/** MP-SA0018 → MP-SA-0018; MP-SA-0001 permanece. */
function canonicalizeBase(raw: string): string {
  const t = raw.trim();
  let m = t.match(/^([A-Za-z]+)-([A-Za-z]+)-(\d+)$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^([A-Za-z]+)-([A-Za-z]+)(\d+)$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return t;
}

function looksLikeDocCodeBase(name: string): boolean {
  const t = name.trim();
  return (
    /^[A-Za-z]+-[A-Za-z]+-\d+$/.test(t) || /^[A-Za-z]+-[A-Za-z]+\d+$/.test(t)
  );
}

function compareRevision(a: string, b: string): number {
  return Number.parseInt(a, 10) - Number.parseInt(b, 10);
}

function headerIndex(headers: string[], ...aliases: string[]): number {
  const normalized = headers.map((h) => normalizeKey(h));
  for (const alias of aliases) {
    const key = normalizeKey(alias);
    const idx = normalized.indexOf(key);
    if (idx >= 0) return idx;
  }
  return -1;
}

function findRevisoesDir(root: string, codigoBase: string): string {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const target = normalizeKey(`Revisoes ${codigoBase}`);
  const targetAlt = normalizeKey(codigoBase);

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const key = normalizeKey(ent.name);
    if (key === target || key.includes(targetAlt)) {
      if (key.startsWith(normalizeKey('Revisoes')) || key.includes(targetAlt)) {
        if (key.includes(targetAlt)) return path.join(root, ent.name);
      }
    }
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (normalizeKey(ent.name).includes(normalizeKey(codigoBase))) {
      return path.join(root, ent.name);
    }
  }

  // Layout flat: planilha + arquivos no mesmo diretório
  return root;
}

function isArquivoIncompleto(fileName: string): boolean {
  return /\.(crdownload|tmp|partial)$/i.test(fileName);
}

function findArquivoRevisao(
  pastaRevisoes: string,
  codigoBase: string,
  revisao: string
): string | null {
  const needle = normalizeKey(`${codigoBase}R${revisao}`);
  const files = fs.readdirSync(pastaRevisoes).filter((f) => {
    if (isArquivoIncompleto(f)) return false;
    if (/\.xlsx$/i.test(f)) return false;
    const full = path.join(pastaRevisoes, f);
    return fs.statSync(full).isFile();
  });

  for (const f of files) {
    if (normalizeKey(f).startsWith(needle)) return path.join(pastaRevisoes, f);
  }
  // Fallback: BASE + R + nn (hífen opcional — normalizeKey já ignora)
  const re = new RegExp(`R\\s*0*${Number.parseInt(revisao, 10)}\\b`, 'i');
  for (const f of files) {
    const key = normalizeKey(f);
    if (key.startsWith(normalizeKey(codigoBase)) && re.test(f)) {
      return path.join(pastaRevisoes, f);
    }
  }
  return null;
}

function detectMimeAndCleanName(filePath: string): {
  mimeType: string;
  arquivoNome: string;
} {
  const base = path.basename(filePath);
  const buf = fs.readFileSync(filePath);
  const isPdf =
    buf.length >= 4 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46;
  const isZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;

  let arquivoNome = base;
  // Nomes legados ".pdf.docx" / ".pdf.pptx" → extensão real pelo conteúdo/sufixo
  if (/\.pdf\.pptx$/i.test(base)) {
    arquivoNome = base.replace(/\.pdf\.pptx$/i, isPdf ? '.pdf' : '.pptx');
  } else if (/\.pdf\.docx$/i.test(base)) {
    arquivoNome = base.replace(/\.pdf\.docx$/i, isPdf ? '.pdf' : '.docx');
  } else if (/\.docx\.pdf$/i.test(base)) {
    arquivoNome = base.replace(/\.docx\.pdf$/i, isPdf ? '.pdf' : '.docx');
  } else if (/\.pptx\.pdf$/i.test(base)) {
    arquivoNome = base.replace(/\.pptx\.pdf$/i, isPdf ? '.pdf' : '.pptx');
  }

  if (isPdf) {
    return { mimeType: 'application/pdf', arquivoNome };
  }
  if (/\.pptx$/i.test(arquivoNome) || (isZip && /\.ppt/i.test(base))) {
    return {
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      arquivoNome: /\.pptx$/i.test(arquivoNome)
        ? arquivoNome
        : `${arquivoNome.replace(/\.(pdf|docx)$/i, '')}.pptx`,
    };
  }
  if (/\.docx$/i.test(arquivoNome) || (isZip && /\.doc/i.test(base))) {
    return {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      arquivoNome: /\.docx$/i.test(arquivoNome)
        ? arquivoNome
        : `${arquivoNome}.docx`,
    };
  }
  if (isZip) {
    // ZIP genérico: tenta inferir pelo nome limpo
    if (/\.pptx$/i.test(arquivoNome)) {
      return {
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        arquivoNome,
      };
    }
    return {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      arquivoNome: /\.docx$/i.test(arquivoNome)
        ? arquivoNome
        : `${arquivoNome}.docx`,
    };
  }
  if (/\.pdf$/i.test(arquivoNome)) {
    return { mimeType: 'application/pdf', arquivoNome };
  }
  if (/\.doc$/i.test(arquivoNome)) {
    return { mimeType: 'application/msword', arquivoNome };
  }
  if (/\.ppt$/i.test(arquivoNome)) {
    return { mimeType: 'application/vnd.ms-powerpoint', arquivoNome };
  }
  return {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    arquivoNome,
  };
}

function readSheetLinhas(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  planilhaLabel: string
): LinhaRevisao[] {
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    { header: 1, defval: null, raw: true }
  ) as unknown[][];

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = (rows[i] ?? []).map((c) => cellStr(c));
    if (headerIndex(row, 'Codigo', 'Código') >= 0) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) {
    console.warn(
      `  [aviso] cabeçalho não encontrado na aba "${sheetName}" (${planilhaLabel})`
    );
    return [];
  }

  const headers = (rows[headerRowIdx] ?? []).map((c) => cellStr(c));
  const iCodigo = headerIndex(headers, 'Codigo', 'Código');
  const iNome = headerIndex(
    headers,
    'Nome do documento',
    'Nome',
    'Titulo',
    'Título'
  );
  const iCadastro = headerIndex(headers, 'Cadastro');
  const iDatCad = headerIndex(headers, 'Dat. Cad.', 'Data Cadastro', 'Dat Cad');
  const iElab = headerIndex(headers, 'Elaborador');
  const iDatElab = headerIndex(
    headers,
    'Dat. Elab.',
    'Data Elaboracao',
    'Data Elaboração'
  );
  const iCons = headerIndex(headers, 'Consenso');
  const iDatCons = headerIndex(headers, 'Dat. Cons.', 'Data Consenso');
  const iAprov = headerIndex(headers, 'Aprovador');
  const iDatAprov = headerIndex(
    headers,
    'Dat. Apro.',
    'Data Aprovacao',
    'Data Aprovação'
  );

  if (iCodigo < 0 || iNome < 0) {
    console.warn(
      `  [aviso] colunas Código/Nome ausentes na aba "${sheetName}"`
    );
    return [];
  }

  const sheetBase = looksLikeDocCodeBase(sheetName)
    ? canonicalizeBase(sheetName)
    : null;

  const out: LinhaRevisao[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const codigoCompleto = cellStr(row[iCodigo]);
    if (!codigoCompleto) continue;
    const parsed = parseCodigo(codigoCompleto);
    if (!parsed) {
      console.warn(`  [aviso] código inválido ignorado: ${codigoCompleto}`);
      continue;
    }

    let codigoBase = canonicalizeBase(parsed.base);
    if (
      sheetBase &&
      normalizeKey(sheetBase) !== normalizeKey(codigoBase)
    ) {
      console.warn(
        `  [aviso] aba "${sheetName}": código ${codigoCompleto} → base corrigida para ${sheetBase}`
      );
      codigoBase = sheetBase;
    } else if (sheetBase) {
      codigoBase = sheetBase;
    }

    out.push({
      codigoCompleto: `${codigoBase}:${parsed.revisao}`,
      codigoBase,
      revisao: parsed.revisao,
      titulo: cellStr(row[iNome]),
      cadastro: iCadastro >= 0 ? cellStr(row[iCadastro]) : '',
      dataCadastro: iDatCad >= 0 ? toIsoDate(row[iDatCad]) : null,
      elaborador: iElab >= 0 ? cellStr(row[iElab]) : '',
      dataElaboracao: iDatElab >= 0 ? toIsoDate(row[iDatElab]) : null,
      consenso: iCons >= 0 ? cellStr(row[iCons]) : '',
      dataConsenso: iDatCons >= 0 ? toIsoDate(row[iDatCons]) : null,
      aprovador: iAprov >= 0 ? cellStr(row[iAprov]) : '',
      dataAprovacao: iDatAprov >= 0 ? toIsoDate(row[iDatAprov]) : null,
    });
  }
  return out;
}

function readPlanilhaDocs(filePath: string): DocImport[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const pasta = path.dirname(filePath);
  const docs: DocImport[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const linhas = readSheetLinhas(sheet, sheetName, path.basename(filePath));
    if (!linhas.length) continue;

    const codigoBase = linhas[0]!.codigoBase;
    const pastaRevisoes = findRevisoesDir(pasta, codigoBase);
    const titulo =
      linhas.map((l) => l.titulo).find((t) => t) ?? codigoBase;

    docs.push({
      codigoBase,
      titulo,
      linhas: [...linhas].sort((a, b) =>
        compareRevision(a.revisao, b.revisao)
      ),
      pastaRevisoes,
      planilha: filePath,
    });
  }
  return docs;
}

function discoverDocs(pasta: string): DocImport[] {
  const entries = fs.readdirSync(pasta);
  const xlsxFiles = entries.filter(
    (f) =>
      /\.xlsx$/i.test(f) &&
      !f.startsWith('~$') &&
      fs.statSync(path.join(pasta, f)).isFile()
  );

  const docs: DocImport[] = [];
  for (const xlsx of xlsxFiles) {
    const planilha = path.join(pasta, xlsx);
    const fromFile = readPlanilhaDocs(planilha);
    if (!fromFile.length) {
      console.warn(`[aviso] planilha sem documentos: ${xlsx}`);
      continue;
    }
    docs.push(...fromFile);
  }
  return docs;
}

type UserRow = { login: string; nome: string | null };

function buildUserResolver(users: UserRow[]) {
  const byLogin = new Map<string, string>();
  const byNormLogin = new Map<string, string>();
  const byNormNome = new Map<string, string>();

  for (const u of users) {
    byLogin.set(u.login.toLowerCase(), u.login);
    byNormLogin.set(normalizeKey(u.login), u.login);
    if (u.nome) {
      const nk = normalizeKey(u.nome);
      if (nk && !byNormNome.has(nk)) byNormNome.set(nk, u.login);
    }
  }

  return function resolvePessoa(raw: string): PessoaResolvida {
    const original = raw.trim();
    if (!original) {
      return { valor: '', vinculado: false, original: '' };
    }
    const lower = original.toLowerCase();
    if (byLogin.has(lower)) {
      return { valor: byLogin.get(lower)!, vinculado: true, original };
    }
    const nk = normalizeKey(original);
    if (byNormLogin.has(nk)) {
      return { valor: byNormLogin.get(nk)!, vinculado: true, original };
    }
    if (byNormNome.has(nk)) {
      return { valor: byNormNome.get(nk)!, vinculado: true, original };
    }
    return { valor: original, vinculado: false, original };
  };
}

async function importDocumento(
  doc: DocImport,
  resolvePessoa: (raw: string) => PessoaResolvida,
  opts: { dryRun: boolean; force: boolean }
) {
  const maior = doc.linhas[doc.linhas.length - 1]!;
  const codigoAtual = `${doc.codigoBase}:${maior.revisao}`;
  const candidatos = await prisma.sgqDocumento.findMany({
    where: {
      OR: [
        { codigo: codigoAtual },
        { codigo: { startsWith: `${doc.codigoBase}:` } },
        { codigo: doc.codigoBase },
      ],
    },
    include: { versoes: true },
  });
  const existingAny =
    candidatos.find((d) => {
      const base = d.codigo.replace(/:\d{2}$/, '');
      return base === doc.codigoBase;
    }) ?? null;

  if (existingAny && !opts.force) {
    console.log(
      `  [skip] ${codigoAtual} já existe (uid=${existingAny.uid}, codigo=${existingAny.codigo}). Use --force para sobrescrever.`
    );
    return { skipped: true };
  }

  const cadastroLinha = doc.linhas[0]!;
  const criadoPor = resolvePessoa(cadastroLinha.cadastro);
  const createdAtIso =
    cadastroLinha.dataCadastro ?? new Date().toISOString();

  console.log(`  documento ${codigoAtual} — ${doc.titulo}`);
  console.log(
    `    cadastro: ${criadoPor.original || '—'} → ${
      criadoPor.vinculado ? `login ${criadoPor.valor}` : `nome livre "${criadoPor.valor}"`
    }`
  );

  if (opts.dryRun) {
    for (const linha of doc.linhas) {
      const arquivo = findArquivoRevisao(
        doc.pastaRevisoes,
        doc.codigoBase,
        linha.revisao
      );
      const elab = resolvePessoa(linha.elaborador);
      const cons = resolvePessoa(linha.consenso);
      const aprov = resolvePessoa(linha.aprovador);
      console.log(
        `    rev ${linha.revisao}: arquivo=${arquivo ? path.basename(arquivo) : 'NÃO ENCONTRADO'}`
      );
      console.log(
        `      elaborador=${fmtPessoa(elab)} | consenso=${fmtPessoa(cons)} | aprovador=${fmtPessoa(aprov)}`
      );
    }
    return { skipped: false, dryRun: true };
  }

  const docUid =
    existingAny?.uid ?? `doc-mig-${doc.codigoBase}-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const saved = await prisma.sgqDocumento.upsert({
    where: { uid: docUid },
    create: {
      uid: docUid,
      codigo: codigoAtual,
      titulo: doc.titulo,
      origem: 'interno',
      status: 'vigente',
      tipoUid: '',
      setorUid: '',
      versaoAtual: maior.revisao,
      localizacao: null,
      criadoPorLogin: criadoPor.valor || 'migracao',
      statusAtualizadoEm: maior.dataAprovacao ?? now,
      createdAt: createdAtIso ? new Date(createdAtIso) : undefined,
    },
    update: {
      codigo: codigoAtual,
      titulo: doc.titulo,
      origem: 'interno',
      status: 'vigente',
      versaoAtual: maior.revisao,
      statusAtualizadoEm: maior.dataAprovacao ?? now,
      // Preserva tipo/setor se já tiverem sido preenchidos na UI
      tipoUid: existingAny?.tipoUid || '',
      setorUid: existingAny?.setorUid || '',
    },
  });

  for (const linha of doc.linhas) {
    const elab = resolvePessoa(linha.elaborador);
    const cons = resolvePessoa(linha.consenso);
    const aprov = resolvePessoa(linha.aprovador);
    const arquivoPath = findArquivoRevisao(
      doc.pastaRevisoes,
      doc.codigoBase,
      linha.revisao
    );

    let arquivoNome: string | null = null;
    let arquivoStoragePath: string | null = null;
    let arquivoMimeType: string | null = null;

    if (arquivoPath) {
      const meta = detectMimeAndCleanName(arquivoPath);
      const buf = fs.readFileSync(arquivoPath);
      const savedFile = saveQualidadeAnexo(`documentos/${saved.uid}`, {
        fileName: meta.arquivoNome,
        mimeType: meta.mimeType,
        contentBase64: buf.toString('base64'),
      });
      arquivoNome = meta.arquivoNome;
      arquivoStoragePath = savedFile.storagePath;
      arquivoMimeType = savedFile.mimeType;
      console.log(
        `    rev ${linha.revisao}: arquivo OK (${meta.arquivoNome})`
      );
    } else {
      console.warn(`    rev ${linha.revisao}: arquivo NÃO ENCONTRADO`);
    }

    console.log(
      `      elaborador=${fmtPessoa(elab)} | consenso=${fmtPessoa(cons)} | aprovador=${fmtPessoa(aprov)}`
    );

    const existingVer = await prisma.sgqDocumentoVersao.findFirst({
      where: { documentoId: saved.id, versao: linha.revisao },
    });
    const verUid =
      existingVer?.uid ??
      `ver-mig-${doc.codigoBase}-${linha.revisao}-${randomUUID().slice(0, 8)}`;

    await prisma.sgqDocumentoVersao.upsert({
      where: { uid: verUid },
      create: {
        uid: verUid,
        documentoId: saved.id,
        versao: linha.revisao,
        elaboradorLogin: elab.valor || null,
        consensoLogin: cons.valor || null,
        aprovadorLogin: aprov.valor || null,
        dataElaboracao: linha.dataElaboracao,
        dataRevisao: linha.dataConsenso,
        dataAprovacao: linha.dataAprovacao,
        arquivoNome,
        arquivoStoragePath,
        arquivoMimeType,
        arquivoAtualizadoEm: linha.dataElaboracao ?? now,
        observacoes: 'Importado na migração SGQ',
      },
      update: {
        elaboradorLogin: elab.valor || null,
        consensoLogin: cons.valor || null,
        aprovadorLogin: aprov.valor || null,
        dataElaboracao: linha.dataElaboracao,
        dataRevisao: linha.dataConsenso,
        dataAprovacao: linha.dataAprovacao,
        ...(arquivoStoragePath
          ? {
              arquivoNome,
              arquivoStoragePath,
              arquivoMimeType,
              arquivoAtualizadoEm: linha.dataElaboracao ?? now,
            }
          : {}),
      },
    });
  }

  return { skipped: false, dryRun: false, uid: saved.uid };
}

function fmtPessoa(p: PessoaResolvida): string {
  if (!p.original) return '—';
  return p.vinculado
    ? `${p.original} → ${p.valor}`
    : `${p.original} (nome livre)`;
}

async function main() {
  const { dryRun, force, pasta } = parseArgs(process.argv.slice(2));
  if (!pasta) {
    console.error(
      'Uso: npx tsx scripts/import-sgq-documentos-migracao.ts --pasta "<caminho>" [--dry-run] [--force]'
    );
    process.exit(1);
  }
  if (!fs.existsSync(pasta) || !fs.statSync(pasta).isDirectory()) {
    console.error(`Pasta não encontrada: ${pasta}`);
    process.exit(1);
  }

  console.log(`Pasta: ${pasta}`);
  console.log(`Modo: ${dryRun ? 'DRY-RUN (não grava)' : 'APLICAR'}${force ? ' + FORCE' : ''}`);

  const docs = discoverDocs(pasta);
  if (!docs.length) {
    console.error('Nenhuma planilha/documento encontrado na pasta.');
    process.exit(1);
  }
  console.log(`Documentos encontrados: ${docs.length}`);

  const users = await prisma.usuario.findMany({
    select: { login: true, nome: true },
  });
  console.log(`Usuários no sistema: ${users.length}`);
  const resolvePessoa = buildUserResolver(users);

  let imported = 0;
  let skipped = 0;
  for (const doc of docs) {
    console.log(`\n=== ${doc.codigoBase} (${path.basename(doc.planilha)}) ===`);
    const result = await importDocumento(doc, resolvePessoa, { dryRun, force });
    if (result.skipped) skipped += 1;
    else imported += 1;
  }

  console.log(
    `\nConcluído. processados=${imported} skip=${skipped} dryRun=${dryRun}`
  );
  if (dryRun) {
    console.log(
      'Nada foi gravado. Remova --dry-run para importar de verdade.'
    );
  } else {
    console.log(
      'Abra Qualidade → Documentos e complete Tipo/Setor em "Editar cadastro".'
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
