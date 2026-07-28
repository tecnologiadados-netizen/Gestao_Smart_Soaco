/**
 * Exporta planilha: pedidos com encerramento em jul/2026
 * - Inclui TODOS os itens já encerrados desses PDs (mesmo se algum item fechou antes)
 * - Uma linha por alteração de previsão/motivo (itens sem histórico: 1 linha)
 *
 * Uso: npx tsx scripts/export-encerrados-julho-2026.ts
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { prisma } from '../src/config/prisma.js';
import { getNomusPool, isNomusEnabled } from '../src/config/nomusDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../docs');
const OUT_FILE = path.join(OUT_DIR, 'pedidos-encerrados-julho-2026-v2.xlsx');

function chavePedidoItem(id: string): string {
  const parts = String(id ?? '').trim().split('-');
  if (parts.length >= 3) {
    const pedido = parts[parts.length - 2]!.trim();
    const itemStr = parts[parts.length - 1]!.trim();
    const numItem = parseInt(itemStr, 10);
    const itemCanonico = Number.isNaN(numItem) ? itemStr : String(numItem);
    return `${pedido}-${itemCanonico}`;
  }
  if (parts.length === 2) return parts.join('-').trim();
  return String(id ?? '').trim();
}

function formatDateBr(value: Date | string | null | undefined): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}/${m}/${y}`;
}

function formatDateTimeBr(value: Date | string | null | undefined): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
}

function statusLabel(status: number): string {
  switch (status) {
    case 1:
      return 'Aguardando liberacao';
    case 4:
      return 'Atendido totalmente';
    case 5:
      return 'Atendido com corte';
    case 6:
      return 'Cancelado';
    case 7:
      return 'Devolvido parcialmente';
    case 8:
      return 'Devolvido totalmente';
    default:
      return `Status ${status}`;
  }
}

type Ajuste = {
  id: number;
  id_pedido: string;
  previsao_nova: Date;
  motivo: string;
  observacao: string | null;
  usuario: string;
  data_ajuste: Date;
  rota: string | null;
};

type ItemNomus = {
  pd: string;
  cod: string;
  descricao: string;
  setor_producao: string | null;
  id_pedido: number;
  id_produto: number;
  status: number;
  data_encerramento: Date | null;
  cliente: string | null;
};

async function main() {
  if (!isNomusEnabled()) throw new Error('NOMUS_DB_URL não configurado.');
  const pool = getNomusPool();
  if (!pool) throw new Error('Pool Nomus indisponível.');

  console.log('Consultando Nomus (PDs com encerramento em jul/2026)...');

  // 1) PDs que tiveram ao menos 1 item encerrado em julho/2026
  // 2) Todos os itens encerrados (status NOT IN 2,3) desses PDs — alinhado à aba Pedidos encerrados
  const sql = `
    SELECT
      pd.nome AS pd,
      p.nome AS cod,
      p.descricao AS descricao,
      sp.opcao AS setor_producao,
      pd.id AS id_pedido,
      p.id AS id_produto,
      ip.status AS status,
      ip.dataHoraEncerramento AS data_encerramento,
      pe.nome AS cliente
    FROM itempedido ip
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    INNER JOIN produto p ON p.id = ip.idProduto
    LEFT JOIN pessoa pe ON pe.id = pd.idCliente
    LEFT JOIN (
      SELECT apv.idProduto, alo.opcao
      FROM atributoprodutovalor apv
      LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idAtributo = 679
    ) sp ON sp.idProduto = p.id
    WHERE pd.idEmpresa IN (1, 2)
      AND ip.status NOT IN (2, 3)
      AND pd.id IN (
        SELECT DISTINCT ip2.idPedido
        FROM itempedido ip2
        INNER JOIN pedido pd2 ON pd2.id = ip2.idPedido
        WHERE pd2.idEmpresa IN (1, 2)
          AND ip2.status NOT IN (2, 3)
          AND ip2.dataHoraEncerramento >= '2026-07-01 00:00:00'
          AND ip2.dataHoraEncerramento < '2026-08-01 00:00:00'
      )
    ORDER BY pd.nome ASC, p.nome ASC, ip.dataHoraEncerramento ASC
  `;

  const [rowsRaw] = await pool.query(sql);
  const itens = (Array.isArray(rowsRaw) ? rowsRaw : []) as ItemNomus[];
  console.log(`Itens encerrados (PDs com fechamento em jul/2026): ${itens.length}`);

  console.log('Carregando histórico SQLite...');
  const todosAjustes = await prisma.pedidoPrevisaoAjuste.findMany({
    orderBy: [{ data_ajuste: 'asc' }, { id: 'asc' }],
  });

  const porCanon = new Map<string, Ajuste[]>();
  for (const r of todosAjustes) {
    const canon = chavePedidoItem(String(r.id_pedido ?? '').trim());
    if (!canon) continue;
    const list = porCanon.get(canon) ?? [];
    list.push({
      id: r.id,
      id_pedido: r.id_pedido,
      previsao_nova: r.previsao_nova,
      motivo: r.motivo,
      observacao: r.observacao,
      usuario: r.usuario,
      data_ajuste: r.data_ajuste,
      rota: r.rota,
    });
    porCanon.set(canon, list);
  }

  type Linha = {
    'Nº pedido': string;
    'Cód. produto': string;
    Descrição: string;
    'Setor de produção': string;
    Cliente: string;
    'Status ERP': string;
    'Data encerramento': string;
    'Data da alteração': string;
    'Previsão anterior': string;
    'Previsão nova': string;
    Motivo: string;
    Usuário: string;
    Observação: string;
    Rota: string;
  };

  const planilha: Linha[] = [];

  for (const it of itens) {
    const base = {
      'Nº pedido': String(it.pd ?? '').trim(),
      'Cód. produto': String(it.cod ?? '').trim(),
      Descrição: String(it.descricao ?? '').trim(),
      'Setor de produção': String(it.setor_producao ?? '').trim(),
      Cliente: String(it.cliente ?? '').trim(),
      'Status ERP': statusLabel(Number(it.status)),
      'Data encerramento': formatDateTimeBr(it.data_encerramento),
    };

    const canon = `${it.id_pedido}-${it.id_produto}`;
    const hist = porCanon.get(canon) ?? [];

    if (hist.length === 0) {
      planilha.push({
        ...base,
        'Data da alteração': '',
        'Previsão anterior': '',
        'Previsão nova': '',
        Motivo: '(sem alterações de previsão registradas)',
        Usuário: '',
        Observação: '',
        Rota: '',
      });
      continue;
    }

    // ASC já vem do findMany; garantir
    const asc = [...hist].sort((a, b) => {
      const t = a.data_ajuste.getTime() - b.data_ajuste.getTime();
      return t !== 0 ? t : a.id - b.id;
    });

    for (let i = 0; i < asc.length; i++) {
      const cur = asc[i]!;
      const prev = i > 0 ? asc[i - 1]! : null;
      planilha.push({
        ...base,
        'Data da alteração': formatDateTimeBr(cur.data_ajuste),
        'Previsão anterior': prev ? formatDateBr(prev.previsao_nova) : '',
        'Previsão nova': formatDateBr(cur.previsao_nova),
        Motivo: cur.motivo || '',
        Usuário: cur.usuario || '',
        Observação: cur.observacao?.trim() || '',
        Rota: cur.rota?.trim() || '',
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(planilha);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 50 },
    { wch: 22 },
    { wch: 32 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 55 },
    { wch: 22 },
    { wch: 30 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Encerrados jul-2026');
  XLSX.writeFile(wb, OUT_FILE);

  const pds = new Set(planilha.map((r) => r['Nº pedido']));
  const pd46304 = planilha.filter((r) => r['Nº pedido'] === 'PD 46304');
  const cods46304 = [...new Set(pd46304.map((r) => r['Cód. produto']))];
  console.log(`Arquivo: ${OUT_FILE}`);
  console.log(`Linhas (1 por alteração): ${planilha.length}`);
  console.log(`PDs: ${pds.size}`);
  console.log(`PD 46304: ${cods46304.length} itens, ${pd46304.length} linhas → ${cods46304.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
