/**
 * Importa trajetória (e stubs de desligados) a partir da Ficha de Empregado — Só Refrigeração.
 *
 * Uso:
 *   npx tsx scripts/import-trajetoria-ficha-refrigeracao.ts --dry-run
 *   npx tsx scripts/import-trajetoria-ficha-refrigeracao.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PDF_CANDIDATES = [
  path.join(ROOT, 'Ficha de Empregado - So Refrigeração.pdf'),
  ...fs
    .readdirSync(ROOT)
    .filter((n) => /^Ficha de Empregado.*\.pdf$/i.test(n))
    .map((n) => path.join(ROOT, n)),
];

const ORIGEM = 'Ficha de Empregado - So Refrigeração.pdf';
const IMPORTADO_POR = 'sistema';
const ADMISSAO_BASELINE_MOTIVO = '__admissao_inicial__';
const SETOR_PADRAO = 'LOJA - ADMINISTRATIVO';
const AREA_PADRAO = 'ADMINISTRATIVO';
const EMPRESA_TAB = 'SO REFRIGERAÇÃO';
const VINCULO_HISTORICO_LOCAL = 'HISTÓRICO LOCAL';
const DIRETORIA_IDX = 17;
const VINCULO_IDX = 27;

const dryRun = process.argv.includes('--dry-run');

type TipoEvento = 'salario' | 'cargo' | 'funcao';

type Alteracao = {
  dataEvento: string; // YYYY-MM-DD
  tipoEvento: TipoEvento;
  titulo: string;
  descricao: string;
  motivo: string | null;
  isBaseline?: boolean;
};

type EmpregadoFicha = {
  registro: string;
  nome: string;
  cpf: string;
  admissao: string | null;
  cargo: string | null;
  salarioInicial: string | null;
  dataSaida: string | null;
  tipoDesligamento: string | null;
  ativo: boolean;
  alteracoes: Alteracao[];
};

type OrganicoHit = {
  id: string;
  matricula: string;
  nome: string;
  status: string;
  admissao: string;
  cargo: string;
  values: unknown[];
};

const prisma = new PrismaClient();

function normalizeSpaces(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normCpf(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

function normNome(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toIsoDate(br: string): string {
  const m = String(br ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function brFromIso(iso: string): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function sanitizeSalaryMotivo(raw: string): string {
  let s = normalizeSpaces(raw);
  if (!s) return s;
  const ferias = /\bf(?:[ée]rias|erias)\b/i.exec(s);
  if (ferias?.index != null) s = s.slice(0, ferias.index).trim();
  for (const re of [
    /\bPER[ÍI]ODO\s+AQUISITIVO\b/i,
    /\bPER[ÍI]ODO\s+GOZO\b/i,
    /\bABONO\s+PECUNI[ÁA]RIO\b/i,
    /\bDe\s+\d{2}\/\d{2}\/\d{4}\b/i,
  ]) {
    const m = re.exec(s);
    if (m?.index != null) s = s.slice(0, m.index).trim();
  }
  return normalizeSpaces(s);
}

function buildPageText(items: Array<{ str?: string; hasEOL?: boolean }>): string {
  let text = '';
  for (const item of items) {
    const part = String(item.str ?? '');
    if (!part) continue;
    text += part;
    text += item.hasEOL ? '\n' : ' ';
  }
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

function tituloOf(tipo: TipoEvento, baseline = false): string {
  if (baseline) {
    return tipo === 'salario' ? 'Salário inicial' : tipo === 'cargo' ? 'Cargo inicial' : 'Função inicial';
  }
  return tipo === 'salario'
    ? 'Alteração salarial'
    : tipo === 'cargo'
      ? 'Alteração de cargo'
      : 'Alteração de função';
}

function extractSalarioLines(pageText: string): Array<{ data: string; valor: string; motivo: string }> {
  const flat = normalizeSpaces(pageText.replace(/\n/g, ' '));
  const re = /(\d{2}\/\d{2}\/\d{4})\s+(R\$\s*[\d.,]+\s+por\s*m[eê]s)\s*([^0-9]*?)(?=\d{2}\/\d{2}\/\d{4}\s+R\$|\bDe\s+\d{2}\/\d{2}\/\d{4}\b|\bEm\s+\d{2}\/\d{2}\/\d{4}\b|\bDISCRIMINA|\bREGISTRO DE EMPREGADO|\bF DAS C|$)/gi;
  const out: Array<{ data: string; valor: string; motivo: string }> = [];
  for (const m of flat.matchAll(re)) {
    const data = String(m[1] ?? '').trim();
    const valor = normalizeSpaces(String(m[2] ?? ''));
    const motivo = sanitizeSalaryMotivo(String(m[3] ?? ''));
    if (!data || !valor) continue;
    // Ignora linhas que são só cabeçalho residual
    if (/^Data\b/i.test(motivo) && motivo.length < 20) continue;
    out.push({ data, valor, motivo });
  }
  return out;
}

function extractCargoFuncao(pageText: string): Array<{ data: string; tipo: 'cargo' | 'funcao'; texto: string }> {
  const flat = normalizeSpaces(pageText.replace(/\n/g, ' '));
  const out: Array<{ data: string; tipo: 'cargo' | 'funcao'; texto: string }> = [];
  const reCargo = /(\d{2}\/\d{2}\/\d{4})\s*-\s*Cargo:\s*([^0-9]+?)(?=\d{2}\/\d{2}\/\d{4}\s*-|\d{2}\/\d{2}\/\d{4}\s+R\$|$)/gi;
  const reFuncao = /(\d{2}\/\d{2}\/\d{4})\s*-\s*Fun(?:ç|c)[aã]o:\s*([^0-9]+?)(?=\d{2}\/\d{2}\/\d{4}\s*-|\d{2}\/\d{2}\/\d{4}\s+R\$|$)/gi;
  for (const m of flat.matchAll(reCargo)) {
    out.push({ data: m[1]!, tipo: 'cargo', texto: normalizeSpaces(`Cargo: ${m[2]}`) });
  }
  for (const m of flat.matchAll(reFuncao)) {
    out.push({ data: m[1]!, tipo: 'funcao', texto: normalizeSpaces(`Função: ${m[2]}`) });
  }
  return out;
}

function extractRescisao(pageText: string): { dataSaida: string | null; tipoDesligamento: string | null } {
  // No PDF o texto costuma vir como: "29/11/2018 Data da saída:" (data ANTES do rótulo).
  const dataBr =
    /(\d{2}\/\d{2}\/\d{4})\s*Data da sa[ií]da\s*:/i.exec(pageText)?.[1] ||
    /Data da sa[ií]da\s*:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(pageText)?.[1] ||
    /Tipo do desligamento:\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(pageText)?.[1] ||
    null;

  let tipo: string | null = null;
  const tipoField = /Tipo do desligamento:\s*([^\n\d]+)/i.exec(pageText);
  if (tipoField?.[1] && normalizeSpaces(tipoField[1]).length > 3) {
    tipo = normalizeSpaces(tipoField[1]);
  }

  const topoHints = [
    /Rescis[aã]o contrato experi[eê]ncia antecipado pelo empregado/i,
    /Rescis[aã]o contrato experi[eê]ncia antecipado pelo empregador/i,
    /Pedido de demiss[aã]o SEM justa causa/i,
    /Demitido SEM justa causa/i,
    /Demitido COM justa causa/i,
    /\bMorte\b/i,
  ];
  if (!tipo) {
    for (const re of topoHints) {
      const m = re.exec(pageText);
      if (m) {
        tipo = normalizeSpaces(m[0]);
        break;
      }
    }
  }

  const dataIso = dataBr ? toIsoDate(dataBr) : '';
  return {
    dataSaida: dataIso || null,
    tipoDesligamento: tipo,
  };
}

function extractHeaderFields(pageText: string): Partial<EmpregadoFicha> & { isContinuation?: boolean } {
  const isContinuation =
    /REGISTRO DE EMPREGADO\s*N[ºo°]?\s*:/i.test(pageText) &&
    (/DISCRIMINA[CÇ][AÃ]O DO HOR[AÁ]RIO/i.test(pageText) || /ALTERA[CÇ][OÕ]ES SALARIAIS/i.test(pageText));

  const registroCont = /REGISTRO DE EMPREGADO\s*N[ºo°]?\s*:\s*(\d+)/i.exec(pageText)?.[1];
  const registroMain =
    /F[EÉ]RIAS\s*-\s*PER[IÍ]ODO\s+ABONO\s+PECUNI[AÁ]RIO\s+(\d{1,6})/i.exec(pageText)?.[1] ||
    /ABONO\s+PECUNI[AÁ]RIO\s+(\d{1,6})/i.exec(pageText)?.[1] ||
    null;

  const registroRaw = registroCont || registroMain;
  const registro = registroRaw ? String(registroRaw).padStart(6, '0') : undefined;

  let nome: string | undefined;
  if (isContinuation) {
    const m =
      /REGISTRO DE EMPREGADO\s*N[ºo°]?\s*:\s*\d+\s*\n[^\n]+\n\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç' ]{5,80}?)\s*\n/i.exec(
        pageText,
      );
    if (m?.[1] && !/^(F DAS|CNPJ|DISCRIMINA|ALTERA)/i.test(m[1])) nome = normalizeSpaces(m[1]);
  } else {
    const fromBenef =
      /Benefici[aá]rios\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç' ]{5,80}?)(?:\n|,|\s{2,}|(?:Avenida|Rua|Conjunto|Quadra|Av\.))/i.exec(
        pageText,
      );
    const fromEmissao =
      /Emiss[aã]o:\s*[^\n]+\n\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç' ]{5,80}?)\s+OBSERVA[CÇ]/i.exec(
        pageText,
      );
    nome = normalizeSpaces(fromEmissao?.[1] || fromBenef?.[1] || '');
    if (!nome || /^(End\.|Emiss|CONTRIBUI|OBSERVA|F DAS|CNPJ)/i.test(nome)) nome = undefined;
  }

  const cpfDotted = /(\d{3}\.\d{3}\.\d{3}-\d{2})/.exec(pageText)?.[1] ?? null;
  const cpf = cpfDotted ? normCpf(cpfDotted) : undefined;

  const admissaoBr = /Data de Admiss[aã]o\s+(\d{2}\/\d{2}\/\d{4})/i.exec(pageText)?.[1] ?? null;
  const cargo =
    /Cargo\s+([A-Z0-9./() -]{2,40}?)\s+Fun[cç][aã]o\s+C\.?\s*B\.?\s*O/i.exec(pageText)?.[1] ?? null;

  const salarioQuadroMatch =
    /Data\s+Motivo\s+Sal[aá]rio\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*R\$/i.exec(pageText) ||
    /(\d{1,3}(?:\.\d{3})*,\d{2})\s*R\$\s+Categoria/i.exec(pageText);
  const salarioInicial = salarioQuadroMatch?.[1]
    ? `R$ ${salarioQuadroMatch[1]} por mês`
    : undefined;

  return {
    registro,
    nome,
    cpf,
    admissao: admissaoBr ? toIsoDate(admissaoBr) : undefined,
    cargo: cargo ? normalizeSpaces(cargo) : undefined,
    salarioInicial,
    isContinuation,
  };
}

async function loadPdfText(pdfPath: string): Promise<string[]> {
  const pdfjsPath = path.join(ROOT, 'frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = await import(pathToFileUrl(pdfjsPath));
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(buildPageText(content.items as Array<{ str?: string; hasEOL?: boolean }>));
  }
  return pages;
}

function pathToFileUrl(p: string): string {
  const resolved = path.resolve(p).replace(/\\/g, '/');
  return resolved.startsWith('/') ? `file://${resolved}` : `file:///${resolved}`;
}

function parseFichaPages(pages: string[]): EmpregadoFicha[] {
  const byRegistro = new Map<string, EmpregadoFicha>();

  for (const pageText of pages) {
    const header = extractHeaderFields(pageText);
    if (!header.registro) continue;

    let emp = byRegistro.get(header.registro);
    if (!emp) {
      emp = {
        registro: header.registro,
        nome: '',
        cpf: '',
        admissao: null,
        cargo: null,
        salarioInicial: null,
        dataSaida: null,
        tipoDesligamento: null,
        ativo: true,
        alteracoes: [],
      };
      byRegistro.set(header.registro, emp);
    }

    // Continuação: só acrescenta alterações salariais extras; não sobrescreve identidade
    if (!header.isContinuation) {
      if (header.nome) emp.nome = header.nome;
      if (header.cpf && header.cpf.length === 11) emp.cpf = header.cpf;
      if (header.admissao) emp.admissao = header.admissao;
      if (header.cargo) emp.cargo = header.cargo;
      if (header.salarioInicial) emp.salarioInicial = header.salarioInicial;

      const resc = extractRescisao(pageText);
      if (resc.dataSaida) {
        emp.dataSaida = resc.dataSaida;
        emp.ativo = false;
        if (resc.tipoDesligamento) emp.tipoDesligamento = resc.tipoDesligamento;
      } else if (!emp.dataSaida) {
        // Sem data de saída na ficha = vínculo ativo (mesmo que o PDF tenha rótulos vazios).
        emp.ativo = true;
        emp.tipoDesligamento = null;
      }
    } else if (header.nome && !emp.nome) {
      emp.nome = header.nome;
    }

    for (const sal of extractSalarioLines(pageText)) {
      const iso = toIsoDate(sal.data);
      if (!iso) continue;
      const key = `salario|${iso}|${sal.valor}`;
      if (emp.alteracoes.some((a) => `salario|${a.dataEvento}|${a.descricao}` === key)) continue;
      emp.alteracoes.push({
        dataEvento: iso,
        tipoEvento: 'salario',
        titulo: tituloOf('salario'),
        descricao: sal.valor,
        motivo: sal.motivo || null,
      });
    }

    for (const cf of extractCargoFuncao(pageText)) {
      const iso = toIsoDate(cf.data);
      if (!iso) continue;
      const key = `${cf.tipo}|${iso}|${cf.texto}`;
      if (emp.alteracoes.some((a) => `${a.tipoEvento}|${a.dataEvento}|${a.descricao}` === key)) continue;
      emp.alteracoes.push({
        dataEvento: iso,
        tipoEvento: cf.tipo,
        titulo: tituloOf(cf.tipo),
        descricao: cf.texto,
        motivo: null,
      });
    }
  }

  for (const emp of byRegistro.values()) {
    emp.alteracoes.sort((a, b) => a.dataEvento.localeCompare(b.dataEvento));
    // Com data de saída = desligado; sem data = ativo.
    emp.ativo = !emp.dataSaida;

    if (emp.admissao) {
      const salAdm = emp.alteracoes.find((a) => a.tipoEvento === 'salario' && a.dataEvento === emp.admissao);
      const temSalarioDatado = emp.alteracoes.some((a) => a.tipoEvento === 'salario');
      if (salAdm) {
        salAdm.isBaseline = true;
        salAdm.motivo = ADMISSAO_BASELINE_MOTIVO;
        salAdm.titulo = tituloOf('salario', true);
      }

      if (emp.cargo) {
        emp.alteracoes.unshift({
          dataEvento: emp.admissao,
          tipoEvento: 'cargo',
          titulo: tituloOf('cargo', true),
          descricao: `Cargo: ${emp.cargo}`,
          motivo: ADMISSAO_BASELINE_MOTIVO,
          isBaseline: true,
        });
      }

      // Quadro salarial só vira baseline na admissão quando não há linhas datadas
      // (evita usar o salário final da ficha como se fosse o inicial).
      if (
        emp.salarioInicial &&
        !salAdm &&
        !temSalarioDatado
      ) {
        emp.alteracoes.unshift({
          dataEvento: emp.admissao,
          tipoEvento: 'salario',
          titulo: tituloOf('salario', true),
          descricao: emp.salarioInicial,
          motivo: ADMISSAO_BASELINE_MOTIVO,
          isBaseline: true,
        });
      }
    }

    emp.alteracoes.sort((a, b) => {
      if (a.dataEvento !== b.dataEvento) return a.dataEvento.localeCompare(b.dataEvento);
      if (a.isBaseline && !b.isBaseline) return -1;
      if (!a.isBaseline && b.isBaseline) return 1;
      return a.tipoEvento.localeCompare(b.tipoEvento);
    });
  }

  return [...byRegistro.values()].filter((e) => e.nome || e.cpf || e.alteracoes.length > 0);
}

function emptyOrganicoValues(): string[] {
  return Array.from({ length: 90 }, () => '');
}

function buildOrganicoValues(input: {
  matricula: string;
  nome: string;
  cpf: string;
  admissao: string | null;
  cargo: string | null;
  salario: string | null;
  status: 'Ativo' | 'Desligado';
  dataSaida: string | null;
  tipoDesligamento: string | null;
}): string[] {
  const values = emptyOrganicoValues();
  values[0] = input.matricula;
  values[1] = input.nome;
  values[2] = input.cpf;
  values[10] = input.admissao || '';
  values[12] = input.cargo || '';
  values[13] = AREA_PADRAO;
  values[14] = SETOR_PADRAO;
  values[DIRETORIA_IDX] = EMPRESA_TAB;
  values[VINCULO_IDX] = VINCULO_HISTORICO_LOCAL;
  values[53] = input.salario ? input.salario.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.') : '';
  // tenta extrair número do "R$ 1.043,83 por mês"
  if (input.salario) {
    const m = /R\$\s*([\d.]+,\d{2})/i.exec(input.salario);
    if (m) {
      values[53] = m[1]!.replace(/\./g, '').replace(',', '.');
    }
  }
  values[83] =
    input.status === 'Desligado'
      ? `Desligado${input.dataSaida ? ` em ${brFromIso(input.dataSaida)}` : ''}${
          input.tipoDesligamento ? ` - ${input.tipoDesligamento}` : ''
        }`
      : 'Ativo';
  values[84] = input.status;
  return values;
}

async function loadOrganicoIndex() {
  const rows = await prisma.rhOrganico.findMany();
  const byCpf = new Map<string, OrganicoHit>();
  const byNome = new Map<string, OrganicoHit>();
  const usedMats = new Set<string>();
  let maxMat = 20000;

  for (const r of rows) {
    const values = JSON.parse(r.valuesJson || '[]') as unknown[];
    const matricula = String(values[0] ?? r.matricula ?? '').trim();
    const nome = String(values[1] ?? r.nome ?? '').trim();
    const cpf = normCpf(String(values[2] ?? ''));
    const hit: OrganicoHit = {
      id: r.id,
      matricula,
      nome,
      status: String(values[84] ?? r.status ?? ''),
      admissao: String(values[10] ?? ''),
      cargo: String(values[12] ?? ''),
      values,
    };
    if (matricula) usedMats.add(matricula);
    const n = Number(matricula.replace(/\D/g, ''));
    if (Number.isFinite(n) && n > maxMat && n < 50000) maxMat = n;
    if (cpf.length === 11) byCpf.set(cpf, hit);
    if (nome) byNome.set(normNome(nome), hit);
  }

  return { byCpf, byNome, usedMats, maxMat, rows };
}

function nextMatricula(used: Set<string>, start: number): string {
  let n = Math.max(start + 1, 30001);
  while (used.has(String(n))) n += 1;
  used.add(String(n));
  return String(n);
}

function eventNoon(iso: string): Date {
  // Mantém padrão já usado no banco (meio-dia UTC)
  return new Date(`${iso}T12:00:00.000Z`);
}

async function main() {
  const pdfPath = PDF_CANDIDATES.find((p) => fs.existsSync(p));
  if (!pdfPath) {
    throw new Error('PDF da ficha não encontrado na raiz do projeto.');
  }
  console.log('PDF:', pdfPath);
  console.log('Modo:', dryRun ? 'DRY-RUN' : 'GRAVAR');

  const pages = await loadPdfText(pdfPath);
  console.log('Páginas:', pages.length);

  const empregados = parseFichaPages(pages);
  console.log('Colaboradores detectados:', empregados.length);
  for (const e of empregados) {
    console.log(
      `  [${e.registro}] ${e.nome || '(sem nome)'} cpf=${e.cpf || '-'} adm=${e.admissao || '-'} ` +
        `${e.ativo ? 'ATIVO' : 'DESLIGADO'} saida=${e.dataSaida || '-'} alteracoes=${e.alteracoes.length}`,
    );
  }

  const index = await loadOrganicoIndex();

  // Agrupa por CPF (mesma pessoa com 2 vínculos, ex.: Jaqueline 000004+000005)
  type Bundle = {
    cpf: string;
    nome: string;
    fichas: EmpregadoFicha[];
    organico: OrganicoHit | null;
    matriculaAlvo: string;
    criarOrganico: boolean;
  };

  const bundles = new Map<string, Bundle>();
  let seq = index.maxMat;

  for (const emp of empregados) {
    const key = emp.cpf || `nome:${normNome(emp.nome)}|reg:${emp.registro}`;
    let bundle = bundles.get(key);
    if (!bundle) {
      const organico =
        (emp.cpf && index.byCpf.get(emp.cpf)) ||
        (emp.nome ? index.byNome.get(normNome(emp.nome)) : undefined) ||
        null;
      let matriculaAlvo = organico?.matricula || '';
      let criarOrganico = false;
      if (!matriculaAlvo) {
        matriculaAlvo = nextMatricula(index.usedMats, seq);
        seq = Number(matriculaAlvo);
        criarOrganico = true;
      }
      bundle = {
        cpf: emp.cpf,
        nome: emp.nome,
        fichas: [],
        organico,
        matriculaAlvo,
        criarOrganico,
      };
      bundles.set(key, bundle);
    }
    bundle.fichas.push(emp);
    if (!bundle.nome && emp.nome) bundle.nome = emp.nome;
  }

  const plannedCreates: Array<{
    matricula: string;
    nome: string;
    values: string[];
    status: string;
    cargo: string;
    setor: string;
    dataAdmissao: Date | null;
  }> = [];
  const plannedTrajetoria: Array<{
    colaboradorMatricula: string;
    colaboradorNome: string;
    dataEvento: Date;
    tipoEvento: string;
    titulo: string;
    descricao: string;
    motivo: string | null;
    origemArquivo: string;
    importadoPor: string;
  }> = [];
  const matriculasToReplace = new Set<string>();

  for (const bundle of bundles.values()) {
    const fichasOrdenadas = [...bundle.fichas].sort((a, b) =>
      String(a.admissao || '').localeCompare(String(b.admissao || '')),
    );
    // Preferir o vínculo mais recente para o card (admissão/status)
    const principal = fichasOrdenadas[fichasOrdenadas.length - 1]!;
    const nome = bundle.organico?.nome || bundle.nome || principal.nome;
    const matricula = bundle.matriculaAlvo;

    if (bundle.criarOrganico) {
      const status = principal.ativo ? 'Ativo' : 'Desligado';
      const values = buildOrganicoValues({
        matricula,
        nome,
        cpf: principal.cpf || bundle.cpf,
        admissao: principal.admissao,
        cargo: principal.cargo,
        salario:
          [...principal.alteracoes].reverse().find((a) => a.tipoEvento === 'salario')?.descricao ||
          principal.salarioInicial,
        status,
        dataSaida: principal.dataSaida,
        tipoDesligamento: principal.tipoDesligamento,
      });
      plannedCreates.push({
        matricula,
        nome,
        values,
        status,
        cargo: principal.cargo || '—',
        setor: SETOR_PADRAO,
        dataAdmissao: principal.admissao ? eventNoon(principal.admissao) : null,
      });
    }

    // Mescla alterações de todos os vínculos da mesma pessoa
    const merged = new Map<string, Alteracao>();
    for (const ficha of fichasOrdenadas) {
      for (const alt of ficha.alteracoes) {
        const k = `${alt.tipoEvento}|${alt.dataEvento}|${alt.descricao}|${alt.motivo ?? ''}`;
        if (!merged.has(k)) merged.set(k, alt);
      }
    }

    // Garante baseline do vínculo atual do orgânico (se já existe)
    if (bundle.organico?.admissao) {
      const adm = bundle.organico.admissao.slice(0, 10);
      const fichaDoVinculo =
        fichasOrdenadas.find((f) => f.admissao === adm) ||
        fichasOrdenadas.find((f) => f.admissao && Math.abs(Date.parse(f.admissao) - Date.parse(adm)) < 3 * 86400000) ||
        principal;

      const salNaAdmissao = fichaDoVinculo.alteracoes.find(
        (a) => a.tipoEvento === 'salario' && a.dataEvento === adm,
      );
      const temSalarioDatado = fichaDoVinculo.alteracoes.some(
        (a) => a.tipoEvento === 'salario' && a.motivo !== ADMISSAO_BASELINE_MOTIVO,
      );
      const salQuadro = fichaDoVinculo.salarioInicial;
      if (salNaAdmissao) {
        merged.set(`salario|${adm}|${salNaAdmissao.descricao}|${ADMISSAO_BASELINE_MOTIVO}`, {
          ...salNaAdmissao,
          dataEvento: adm,
          isBaseline: true,
          motivo: ADMISSAO_BASELINE_MOTIVO,
          titulo: tituloOf('salario', true),
        });
      } else if (salQuadro && !temSalarioDatado) {
        merged.set(`salario|${adm}|${salQuadro}|${ADMISSAO_BASELINE_MOTIVO}`, {
          dataEvento: adm,
          tipoEvento: 'salario',
          titulo: tituloOf('salario', true),
          descricao: salQuadro,
          motivo: ADMISSAO_BASELINE_MOTIVO,
          isBaseline: true,
        });
      }

      const cargoNome = fichaDoVinculo.cargo || bundle.organico.cargo;
      if (cargoNome) {
        merged.set(`cargo|${adm}|Cargo: ${cargoNome}|${ADMISSAO_BASELINE_MOTIVO}`, {
          dataEvento: adm,
          tipoEvento: 'cargo',
          titulo: tituloOf('cargo', true),
          descricao: `Cargo: ${cargoNome}`,
          motivo: ADMISSAO_BASELINE_MOTIVO,
          isBaseline: true,
        });
      }
    }

    const eventos = [...merged.values()].sort((a, b) => a.dataEvento.localeCompare(b.dataEvento));
    if (eventos.length === 0) {
      console.warn(`Sem eventos para ${nome} (mat ${matricula})`);
      continue;
    }

    matriculasToReplace.add(matricula);
    for (const ev of eventos) {
      plannedTrajetoria.push({
        colaboradorMatricula: matricula,
        colaboradorNome: nome,
        dataEvento: eventNoon(ev.dataEvento),
        tipoEvento: ev.tipoEvento,
        titulo: ev.titulo,
        descricao: ev.descricao,
        motivo: ev.motivo,
        origemArquivo: ORIGEM,
        importadoPor: IMPORTADO_POR,
      });
    }

    console.log(
      `→ ${nome} mat=${matricula} (${bundle.organico ? 'match orgânico' : 'NOVO stub'}) ` +
        `fichas=${bundle.fichas.map((f) => f.registro).join('+')} eventos=${eventos.length}` +
        (bundle.criarOrganico ? ' [criar card Desligado/Ativo]' : ''),
    );
    if (dryRun) {
      for (const ev of eventos) {
        console.log(
          `    - ${ev.dataEvento} [${ev.tipoEvento}] ${ev.descricao}${ev.motivo ? ` | ${ev.motivo}` : ''}`,
        );
      }
    }
  }

  console.log('\nResumo:');
  console.log('  Cards novos:', plannedCreates.length);
  console.log('  Matrículas com trajetória a substituir:', matriculasToReplace.size);
  console.log('  Eventos a gravar:', plannedTrajetoria.length);

  if (dryRun) {
    console.log('\nDRY-RUN: nenhuma alteração gravada.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const row of plannedCreates) {
      await tx.rhOrganico.create({
        data: {
          id: randomUUID(),
          matricula: row.matricula,
          nome: row.nome,
          cargo: row.cargo,
          setor: row.setor,
          area: AREA_PADRAO,
          lider: null,
          dataAdmissao: row.dataAdmissao,
          status: row.status,
          valuesJson: JSON.stringify(row.values),
        },
      });
    }

    // Remove apenas trajetória anterior proveniente desta ficha / ou toda a trajetória
    // das matrículas afetadas que seja de origem ficha — mantém Secullum.
    for (const mat of matriculasToReplace) {
      await tx.rhOrganicoTrajetoria.deleteMany({
        where: {
          colaboradorMatricula: mat,
          OR: [
            { origemArquivo: ORIGEM },
            { origemArquivo: { contains: 'Ficha de Empregado - So Refriger' } },
            { origemArquivo: 'ficha-empregado-pdf' },
            { origemArquivo: { contains: 'histórico_ficha' } },
          ],
        },
      });
    }

    if (plannedTrajetoria.length > 0) {
      await tx.rhOrganicoTrajetoria.createMany({
        data: plannedTrajetoria.map((r) => ({
          id: randomUUID(),
          ...r,
        })),
      });
    }
  });

  console.log('\nGravação concluída.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
