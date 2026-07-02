/**
 * Popula a tabela municipio_coordenada com dados do CSV do repositório
 * kelvins/municipios-brasileiros (origem IBGE). Execute uma vez: npx tsx prisma/seed-municipios.ts
 */
import { PrismaClient } from '@prisma/client';

const CSV_URL =
  'https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv';

const CODIGO_UF_PARA_SIGLA: Record<number, string> = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS',
  50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};

function normalizarSemAcentos(texto: string): string {
  return (texto || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const prisma = new PrismaClient();

async function main() {
  console.log('Baixando CSV de municípios...');
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Falha ao baixar CSV: ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim());
  const header = lines[0];
  if (!header.includes('nome') || !header.includes('latitude') || !header.includes('longitude') || !header.includes('codigo_uf')) {
    throw new Error('CSV sem colunas esperadas (nome, latitude, longitude, codigo_uf)');
  }
  const cols = header.split(',');
  const idxNome = cols.indexOf('nome');
  const idxLat = cols.indexOf('latitude');
  const idxLng = cols.indexOf('longitude');
  const idxUf = cols.indexOf('codigo_uf');
  if (idxNome === -1 || idxLat === -1 || idxLng === -1 || idxUf === -1) {
    throw new Error('Colunas não encontradas no CSV');
  }

  const rows: { nome_normalizado: string; uf: string; lat: number; lng: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCsvLine(line);
    if (parts.length <= Math.max(idxNome, idxLat, idxLng, idxUf)) continue;
    const nome = parts[idxNome]?.trim().replace(/^"|"$/g, '');
    const lat = parseFloat(parts[idxLat] ?? '');
    const lng = parseFloat(parts[idxLng] ?? '');
    const codigoUf = parseInt(parts[idxUf] ?? '0', 10);
    const uf = CODIGO_UF_PARA_SIGLA[codigoUf];
    if (!nome || !uf || Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const nome_normalizado = normalizarSemAcentos(nome);
    rows.push({ nome_normalizado, uf, lat, lng });
  }

  console.log(`Inserindo ${rows.length} municípios...`);
  await prisma.$transaction(async (tx) => {
    await tx.municipioCoordenada.deleteMany({});
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      await tx.municipioCoordenada.createMany({
        data: chunk,
      });
    }
  });
  console.log('Concluído.');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\n') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
