import 'dotenv/config';
import { listarContasReceberPorPessoa } from './src/data/crmFinanceiro/crmDashboardService.ts';

const contas = await listarContasReceberPorPessoa('atraso', 'MAQUISUL');
console.log('atraso qtd', contas.length);
console.log(
  JSON.stringify(
    contas.map((c) => ({
      codigo: c.codigo,
      dataVencimento: c.dataVencimento,
      valor: c.valor,
      diasAtraso: c.diasAtraso,
      pessoa: c.pessoa,
    })),
    null,
    2
  )
);

const total = await listarContasReceberPorPessoa('total', 'MAQUISUL');
console.log('total abertas', total.length);
console.log(
  JSON.stringify(
    total.map((c) => ({
      codigo: c.codigo,
      dataVencimento: c.dataVencimento,
      valor: c.valor,
      diasAtraso: c.diasAtraso,
      status: c.status,
    })),
    null,
    2
  )
);
