import 'dotenv/config';
import {
  resolverPathKeyDreSaidas,
  resolverPathKeyDreSaidasShop9,
  mapaIdsContaPorPathKeyDre,
} from '../src/data/drePlanoContasMap.js';

const casos: Array<[number, string]> = [
  [180, 'Horas Extras - Operacional'],
  [374, 'Horas Extras - Administrativo'],
  [328, 'Despesas de Viagens OP'],
  [64, 'Assessoria Contábil'],
  [394, 'ASSESSORIA CONTÁBIL'],
  [317, 'Taxas de Legalização'],
  [350, 'ICMS Difal'],
  [381, 'ICMS Difal Uso e Consumo'],
  [53, 'Pro-labore'],
];

for (const [id, nome] of casos) {
  const pk = resolverPathKeyDreSaidas(id, nome);
  console.log(`id=${id} nome="${nome}" -> pathKey=${pk}`);
}

const mapa = mapaIdsContaPorPathKeyDre();
console.log('\n--- pathKeys de interesse ---');
for (const pk of ['D/7/0/8', 'D/10/0/2', 'D/8/1/0/9', 'D/12/3/0']) {
  console.log(pk, '=>', mapa[pk]);
}
