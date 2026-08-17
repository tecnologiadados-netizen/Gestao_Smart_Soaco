import { listarYmdFeriadosReconhecidos } from './feriadosNacionais.js';

const FERIADOS_YMD = listarYmdFeriadosReconhecidos();
const FERIADOS_SQL_IN = FERIADOS_YMD.map((d) => `'${d}'`).join(',');

function naoUtilMysql(dateExpr: string): string {
  return `(WEEKDAY(${dateExpr}) IN (5, 6) OR ${dateExpr} IN (${FERIADOS_SQL_IN}))`;
}

function naoUtilMssql(dateExpr: string): string {
  return `((((DATEPART(WEEKDAY, ${dateExpr}) + @@DATEFIRST - 1) % 7) IN (0, 6)) OR CAST(${dateExpr} AS date) IN (${FERIADOS_SQL_IN}))`;
}

/**
 * 1º dia útil a partir do vencimento (o próprio vencimento, se for útil).
 * Sábado/domingo/feriado → segunda (ou o útil seguinte).
 */
export function sqlPrazoEfetivoMysql(vencExpr: string): string {
  const d0 = `DATE(${vencExpr})`;
  const ramos: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const di = i === 0 ? d0 : `DATE_ADD(${d0}, INTERVAL ${i} DAY)`;
    ramos.push(`WHEN NOT ${naoUtilMysql(di)} THEN ${di}`);
  }
  return `(CASE ${ramos.join(' ')} ELSE DATE_ADD(${d0}, INTERVAL 6 DAY) END)`;
}

export function sqlPrazoEfetivoMssql(vencExpr: string): string {
  const d0 = `CAST(${vencExpr} AS date)`;
  const ramos: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const di = i === 0 ? d0 : `DATEADD(day, ${i}, ${d0})`;
    ramos.push(`WHEN NOT ${naoUtilMssql(di)} THEN ${di}`);
  }
  return `(CASE ${ramos.join(' ')} ELSE DATEADD(day, 6, ${d0}) END)`;
}

/** Recuperado = pagamento depois do prazo efetivo (não conta sáb→segunda no 1º útil). */
export function sqlPagouAposPrazoEfetivoMysql(vencExpr: string, pagExpr: string): string {
  return `DATE(${pagExpr}) > ${sqlPrazoEfetivoMysql(vencExpr)}`;
}

export function sqlPagouAposPrazoEfetivoMssql(vencExpr: string, pagExpr: string): string {
  return `CAST(${pagExpr} AS date) > ${sqlPrazoEfetivoMssql(vencExpr)}`;
}
