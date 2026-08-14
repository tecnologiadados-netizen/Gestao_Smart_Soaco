import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from '../src/config/prisma.js';
import { listarPedidos } from '../src/data/pedidosRepository.js';
import { addDaysIso, toISODate, dataRegraRomaneioAcimaCorte, resolverDataCalendarioLinha, isRomaneioComoFormacaoLinha } from '../../frontend/src/components/sequenciamento-carradas/simulacaoCarradas.ts';

async function main() {
  const res = await listarPedidos({ pd: '48885', limit: 50 });
  const row = (res.data || []).find((r) => String(r.Observacoes || '').toLowerCase().includes('inserir'));
  if (!row) { console.log('nao achou inserir'); process.exit(1); }

  const id = String(row.id_pedido);
  const ajustes = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { id_pedido: { contains: id.split('-')[1] || id } },
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
    take: 20,
  });
  const ajustesExatos = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { OR: [
      { id_pedido: id },
      { id_pedido: { contains: '-48885-' } },
      { id_pedido: { contains: '-48895-' } },
    ]},
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
    take: 50,
  });

  const emissao = toISODate(row.Emissao);
  const regraAuto = emissao ? addDaysIso(emissao, 45) : null;
  const resolvido = resolverDataCalendarioLinha(row as Record<string, unknown>, new Map(), new Map());

  console.log(JSON.stringify({
    id_pedido: id,
    PD: row.PD,
    TipoF: row.TipoF ?? row.tipoF,
    Observacoes: row.Observacoes,
    Valor: row['Valor Pedido Total'],
    formacao: row.romaneio_como_formacao,
    isFormacaoLinha: isRomaneioComoFormacaoLinha(row as Record<string, unknown>),
    data_producao: row.data_producao,
    Emissao: row.Emissao,
    emissaoISO: emissao,
    regraAutoEmissaoMais45: regraAuto,
    previsao_entrega_regra: row.previsao_entrega,
    previsao_atualizada: row.previsao_entrega_atualizada,
    motivo: row.motivo_ultimo_ajuste,
    origem: row.origem_ultimo_ajuste,
    dataRegraRomaneioAcimaCorte: dataRegraRomaneioAcimaCorte(row as Record<string, unknown>),
    resolverDataCalendarioLinha: resolvido,
    ajustesRelacionados: ajustesExatos.map(a => ({
      id: a.id,
      id_pedido: a.id_pedido,
      rota: a.rota,
      previsao_nova: a.previsao_nova,
      motivo: a.motivo,
      data_ajuste: a.data_ajuste,
      confiavel: a.previsao_confiavel,
    })),
  }, null, 2));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
