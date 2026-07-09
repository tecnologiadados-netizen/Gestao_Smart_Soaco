import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getNomusPool } from '../../config/nomusDb.js';
import { produtoPesoCache } from './painelProducaoCache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_PATH = path.join(__dirname, '../../data/sql/painelProducaoPesoBom.sql');

export async function loadPesoBomMap(pool?: Pool | null): Promise<Map<number, number>> {
  const cached = produtoPesoCache.get('map');
  if (cached) return cached;

  const db = pool ?? getNomusPool();
  if (!db) return new Map();

  const sql = fs.readFileSync(SQL_PATH, 'utf-8');
  const [rows] = await db.query<RowDataPacket[]>(sql);

  const pesoMap = new Map<number, number>();
  for (const row of rows) {
    const pid = Number(row.id_produto);
    const prev = pesoMap.get(pid) ?? 0;
    pesoMap.set(pid, prev + Number(row.peso ?? 0));
  }

  produtoPesoCache.set('map', pesoMap);
  return pesoMap;
}
