/**
 * Importa documentos SGQ a partir de pastas de migração (planilha + arquivos de revisão).
 *
 * Uso:
 *   npx tsx scripts/import-sgq-documentos-migracao.ts --pasta "C:\...\Teste Gestão" --dry-run
 *   npx tsx scripts/import-sgq-documentos-migracao.ts --pasta "C:\...\Teste Gestão"
 *   npx tsx scripts/import-sgq-documentos-migracao.ts --pasta "..." --force
 *
 * Planilha esperada (cabeçalho na linha 2):
 *   Código | Nome do documento | Cadastro | Dat. Cad. | Elaborador | Dat. Elab. |
 *   Consenso | Dat. Cons. | Aprovador | Dat. Apro.
 *
 * Arquivos: pasta "Revisões {CODIGO_BASE}" com nomes tipo "CT-SA-01R00 Titulo.docx"
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
  const m = codigo.trim().match(/^(.+):(\d{2})$/);
  if (!m) return null;
  return { base: m[1]!, revisao: m[2]! };
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

function findRevisoesDir(root: string, codigoBase: string): string | null {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const target = normalizeKey(`Revisoes ${codigoBase}`);
  const targetAlt = normalizeKey(codigoBase);

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const key = normalizeKey(ent.name);
    if (key === target || key.includes(targetAlt)) {
      // Prefer dirs that look like "Revisões …"
      if (key.startsWith(normalizeKey('Revisoes')) || key.includes(targetAlt)) {
        if (key.includes(targetAlt)) return path.join(root, ent.name);
      }
    }
  }

  // Fallback: exact-ish match containing base
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (normalizeKey(ent.name).includes(normalizeKey(codigoBase))) {
      return path.join(root, ent.name);
    }
  }
  return null;
}

function findArquivoRevisao(
  pastaRevisoes: string,
  codigoBase: string,
  revisao: string
): string | null {
  const needle = normalizeKey(`${codigoBase}R${revisao}`);
  const files = fs.readdirSync(pastaRevisoes).filter((f) => {
    const full = path.join(pastaRevisoes, f);
    return fs.statSync(full).isFile();
  });

  for (const f of files) {
    if (normalizeKey(f).startsWith(needle)) return path.join(pastaRevisoes, f);
  }
  // Fallback: contains Rn in name near the code
  const re = new RegExp(
    `${escapeRegex(codigoBase)}\\s*R\\s*${revisao}\\b`,
    'i'
  );
  for (const f of files) {
    if (re.test(f)) return path.join(pastaRevisoes, f);
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  // Nomes legados ".pdf.docx" → preferir extensão real pelo conteúdo
  if (/\.pdf\.docx$/i.test(base)) {
    arquivoNome = base.replace(/\.pdf\.docx$/i, isPdf ? '.pdf' : '.docx');
  } else if (/\.docx\.pdf$/i.test(base)) {
    arquivoNome = base.replace(/\.docx\.pdf$/i, isPdf ? '.pdf' : '.docx');
  }

  if (isPdf) {
    return { mimeType: 'application/pdf', arquivoNome };
  }
  if (isZip || /\.docx$/i.test(arquivoNome)) {
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
  return {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    arquivoNome,
  };
}

function readPlanilha(filePath: string): LinhaRevisao[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    { header: 1, defval: null, raw: true }
  ) as unknown[][];

  // Cabeçalho costuma estar na linha 2 (índice 1); senão procura a linha com "Código"
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = (rows[i] ?? []).map((c) => cellStr(c));
    if (headerIndex(row, 'Codigo', 'Código') >= 0) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) {
    throw new Error(`Cabeçalho não encontrado em ${path.basename(filePath)}`);
  }

  const headers = (rows[headerRowIdx] ?? []).map((c) => cellStr(c));
  const iCodigo = headerIndex(headers, 'Codigo', 'Código');
  const iNome = headerIndex(headers, 'Nome do documento', 'Nome', 'Titulo', 'Título');
  const iCadastro = headerIndex(headers, 'Cadastro');
  const iDatCad = headerIndex(headers, 'Dat. Cad.', 'Data Cadastro', 'Dat Cad');
  const iElab = headerIndex(headers, 'Elaborador');
  const iDatElab = headerIndex(headers, 'Dat. Elab.', 'Data Elaboracao', 'Data Elaboração');
  const iCons = headerIndex(headers, 'Consenso');
  const iDatCons = headerIndex(headers, 'Dat. Cons.', 'Data Consenso');
  const iAprov = headerIndex(headers, 'Aprovador');
  const iDatAprov = headerIndex(headers, 'Dat. Apro.', 'Data Aprovacao', 'Data Aprovação');

  if (iCodigo < 0 || iNome < 0) {
    throw new Error(
      `Colunas Código/Nome obrigatórias ausentes em ${path.basename(filePath)}`
    );
  }

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
    out.push({
      codigoCompleto,
      codigoBase: parsed.base,
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
    const linhas = readPlanilha(planilha);
    if (!linhas.length) {
      console.warn(`[aviso] planilha sem linhas: ${xlsx}`);
      continue;
    }
    const codigoBase = linhas[0]!.codigoBase;
    const pastaRevisoes = findRevisoesDir(pasta, codigoBase);
    if (!pastaRevisoes) {
      console.warn(`[aviso] pasta de revisões não encontrada para ${codigoBase}`);
      continue;
    }
    const titulo =
      linhas.map((l) => l.titulo).find((t) => t) ?? codigoBase;
    docs.push({
      codigoBase,
      titulo,
      linhas: [...linhas].sort((a, b) =>
        compareRevision(a.revisao, b.revisao)
      ),
      pastaRevisoes,
      planilha,
    });
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
