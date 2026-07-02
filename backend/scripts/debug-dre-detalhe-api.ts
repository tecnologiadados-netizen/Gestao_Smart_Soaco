import 'dotenv/config';
import { queryDreReceitaVendasDetalhe } from '../src/data/dreReceitaVendasRepository.js';

const r = await queryDreReceitaVendasDetalhe({
  dataInicio: '2026-01-01',
  dataFim: '2026-01-31',
});
const hit = r.detalhes.filter((d) => d.pedido?.includes('47157') || d.numeroDocumentoFiscal === 133868);
console.log('erro:', r.erro);
console.log('total linhas:', r.detalhes.length);
console.log('PD47157/133868:', hit.length, hit);
