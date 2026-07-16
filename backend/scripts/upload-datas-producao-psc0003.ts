/**
 * Aplica datas de produção na simulação do snapshot PSC0003 (rascunho).
 * Chave: Coluna1 (RM) ↔ cód da carrada. Se o cód não existir no snapshot, fica em branco (não aplica).
 * Uso: npx tsx scripts/upload-datas-producao-psc0003.ts
 */
import { prisma } from '../src/config/prisma.js';
import {
  atualizarSimulacaoSnapshot,
  sanitizarSimulacao,
  type SequenciamentoCarradasPayloadV2,
  type SequenciamentoSimulacao,
  type SequenciamentoSimulacaoItem,
} from '../src/data/sequenciamentoCarradasRepository.js';

const SNAPSHOT_COD = 'PSC0003';

/** RM (Coluna1) → ISO YYYY-MM-DD */
const DATAS_POR_RM: Record<string, string> = {
  '01719': '2026-07-15',
  '01735': '2026-07-16',
  '01687': '2026-07-17',
  '01677': '2026-07-17',
  '01704': '2026-07-20',
  '01740': '2026-07-23',
  '01688': '2026-07-28',
  '01732': '2026-07-29',
  '01728': '2026-08-03',
  '01738': '2026-08-06',
  '01737': '2026-08-10',
  '01736': '2026-08-11',
  '01715': '2026-07-21',
  '01741': '2026-08-18',
  '01712': '2026-08-30',
  '01676': '2026-08-30',
  '01724': '2026-08-30',
  '01733': '2026-08-30',
  '01739': '2026-08-30',
};

const KEY_SEP = '\x1e';

function carradaKey(cod: string, carrada: string): string {
  return `${cod}${KEY_SEP}${carrada}`;
}

function normalizarRm(cod: string): string {
  const digits = cod.replace(/\D/g, '');
  return digits.padStart(5, '0');
}

async function main() {
  const row = await prisma.sequenciamentoCarradasSnapshot.findUnique({ where: { cod: SNAPSHOT_COD } });
  if (!row) {
    console.error(`Snapshot ${SNAPSHOT_COD} não encontrado.`);
    process.exit(1);
  }
  if (row.status !== 'rascunho') {
    console.error(`Snapshot ${SNAPSHOT_COD} não está em rascunho (status=${row.status}).`);
    process.exit(1);
  }

  const payload = JSON.parse(row.payload) as SequenciamentoCarradasPayloadV2;
  const simAtual = sanitizarSimulacao(payload.simulacao) ?? { ordem: [], itens: [] };
  const itensMap = new Map<string, SequenciamentoSimulacaoItem>();
  for (const it of simAtual.itens) {
    itensMap.set(it.chave, { ...it });
  }

  let aplicadas = 0;
  const naoEncontradas: string[] = [];

  for (const [rm, iso] of Object.entries(DATAS_POR_RM)) {
    const carrada = payload.carradas.find((c) => normalizarRm(c.cod) === rm);
    if (!carrada) {
      naoEncontradas.push(rm);
      console.log(`EM BRANCO ${rm} — cód não encontrado no snapshot`);
      continue;
    }
    const chave = carradaKey(carrada.cod, carrada.carrada);
    const prev = itensMap.get(chave);
    itensMap.set(chave, {
      chave,
      cod: carrada.cod,
      carrada: carrada.carrada,
      dataProducao: iso,
      ...(prev?.dataEntrega ? { dataEntrega: prev.dataEntrega } : { dataEntrega: '' }),
    });
    aplicadas++;
    console.log(`OK ${carrada.cod} | ${carrada.carrada} → ${iso}`);
  }

  const novaSimulacao: SequenciamentoSimulacao = {
    ordem: simAtual.ordem,
    itens: [...itensMap.values()],
    ...(simAtual.prioridades ? { prioridades: simAtual.prioridades } : {}),
    ...(simAtual.motivos ? { motivos: simAtual.motivos } : {}),
  };

  const r = await atualizarSimulacaoSnapshot(row.id, novaSimulacao);
  if (!r.ok) {
    console.error('Erro ao gravar:', r.error);
    process.exit(1);
  }

  console.log(`\nConcluído: ${aplicadas} carrada(s) atualizada(s) em ${SNAPSHOT_COD}.`);
  if (naoEncontradas.length) {
    console.warn('RM sem carrada no snapshot (deixadas em branco):', naoEncontradas.join(', '));
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
