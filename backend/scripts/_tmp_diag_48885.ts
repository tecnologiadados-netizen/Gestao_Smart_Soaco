import { config } from 'dotenv';
config();
import { listarPedidos } from '../src/data/pedidosRepository.js';

async function main() {
  const res = await listarPedidos({ pd: '48885', limit: 50 });
  const sample = (res.data || []).map((r) => ({
    PD: r.PD,
    id_pedido: r.id_pedido,
    Cod: r.Cod,
    Cliente: r.Cliente,
    TipoF: r.TipoF,
    Observacoes: r.Observacoes,
    Valor: r['Valor Pedido Total'],
    Emissao: r.Emissao,
    prev: r.previsao_entrega,
    prevAt: r.previsao_entrega_atualizada,
    motivo: r.motivo_ultimo_ajuste,
    origem: r.origem_ultimo_ajuste,
    prod: r.data_producao,
    form: r.romaneio_como_formacao,
    Status: r.Status,
    Setor: r['Setor de Producao'],
    Qtde: r['Qtde Pendente Real'],
  }));
  console.log(JSON.stringify({ total: res.total, erro: res.erroConexao, n: sample.length, sample }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
