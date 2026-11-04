/**
 * Gestão entradas — eficiência da conferência física (volta à Mesa).
 * A grade e o detalhe usam estas mesmas voltas.
 */

const MS_HORA = 3_600_000;
const MS_DIA = 24 * MS_HORA;

export type ItemVoltaBruta = {
  conferido: boolean;
  /** 1, 2 ou 3: em qual chance da contagem às cegas a quantidade foi informada. */
  tentativas?: number;
  idItemDocumento?: number | null;
};

export type VoltaBruta = {
  idDocumentoEstoque: number;
  numeroDocumento: string | null;
  conferenteNome: string | null;
  conferenteLogin: string | null;
  atribuidoEm: Date | null;
  finalizadoEm: Date | null;
  cancelada: boolean;
  itens: ItemVoltaBruta[];
  origem: 'atual' | 'ciclo';
  cicloId: number | null;
};

export type ResultadoVoltaFisica = 'em_conferencia' | 'conferida' | 'divergencia';

export type VoltaConferenciaFisica = {
  chave: string;
  idDocumentoEstoque: number;
  numeroDocumento: string | null;
  conferenteNome: string | null;
  conferenteLogin: string | null;
  conferente: string;
  atribuidoEm: string;
  atribuidoDia: string;
  finalizadoEm: string | null;
  leadTimeHoras: number | null;
  resultado: ResultadoVoltaFisica;
  /** 1 = primeira ida do documento ao conferente; 2 = reenvio, e assim por diante. */
  voltaNumero: number;
  itens: number;
  itensConferidos: number;
  /** Itens que este conferente acertou nesta volta, sem repetir item já acertado numa volta anterior. */
  acertosChance: [number, number, number];
};

export type SerieDiaConferenciaFisica = {
  data: string;
  destinacoes: number;
  finalizadas: number;
  divergencias: number;
  leadTimeMedioHoras: number | null;
};

export type ConferenteConferenciaFisica = {
  nome: string;
  destinacoes: number;
  finalizadas: number;
  divergencias: number;
  taxaDivergencia: number | null;
  primeira: number;
  divergenciaPrimeira: number;
  segunda: number;
  divergenciaSegunda: number;
  /** Acertos de quantidade na 1ª, 2ª ou 3ª chance da contagem. */
  acertosPorChance: Array<{ chance: 1 | 2 | 3; acertos: number }>;
  leadTimeMedianoHoras: number | null;
};

export type KpisConferenciaFisica = {
  qtdeDestinacoes: number;
  /** Conferidas e finalizadas: voltaram à Mesa, com ou sem divergência. */
  qtdeFinalizadas: number;
  qtdeDivergencias: number;
  /** Divergências ÷ finalizadas, em percentual com 1 casa. */
  taxaDivergencia: number | null;
  qtdePrimeira: number;
  qtdeDivergenciaPrimeira: number;
  qtdeSegunda: number;
  qtdeDivergenciaSegunda: number;
  qtdeDemais: number;
  qtdeDivergenciaDemais: number;
  qtdeEmConferencia: number;
  leadTimeMedioHoras: number | null;
  leadTimeMedianoHoras: number | null;
  leadTimeMedianoPrimeiraHoras: number | null;
  leadTimeMedianoSegundaHoras: number | null;
  qtdeAmostraLeadTime: number;
};

export type PainelConferenciaFisica = {
  dataInicio: string;
  dataFim: string;
  kpis: KpisConferenciaFisica;
  serieDiaria: SerieDiaConferenciaFisica[];
  porConferente: ConferenteConferenciaFisica[];
};

export type RecorteConferenciaFisica =
  | { tipo: 'destinacoes' }
  | { tipo: 'finalizadas' }
  | { tipo: 'divergencia' }
  | { tipo: 'divergencia_primeira' }
  | { tipo: 'divergencia_segunda' }
  | { tipo: 'sem_divergencia' }
  | { tipo: 'leadtime' }
  | { tipo: 'dia'; dia: string }
  | { tipo: 'conferente'; nome: string };

export function diaCivilSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

/** Início inclusivo e fim exclusivo do recorte civil em America/Sao_Paulo. */
export function limitePeriodoSaoPaulo(
  dataInicio: string,
  dataFim: string,
): { inicio: Date; fimExclusivo: Date } {
  const inicio = new Date(`${dataInicio}T00:00:00-03:00`);
  const fimDia = new Date(`${dataFim}T00:00:00-03:00`);
  return { inicio, fimExclusivo: new Date(fimDia.getTime() + MS_DIA) };
}

function arredondarHoras(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const soma = valores.reduce((total, valor) => total + valor, 0);
  return arredondarHoras(soma / valores.length);
}

function taxaPercentual(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((parte / total) * 1000) / 10;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return arredondarHoras(ordenados[meio]!);
  return arredondarHoras((ordenados[meio - 1]! + ordenados[meio]!) / 2);
}

export function nomeConferenteVolta(
  nome: string | null | undefined,
  login: string | null | undefined,
): string {
  const limpo = nome?.trim();
  if (limpo) return limpo;
  const loginLimpo = login?.trim();
  if (loginLimpo) return loginLimpo;
  return 'Sem conferente';
}

function leadTimeHoras(atribuidoEm: Date, finalizadoEm: Date | null): number | null {
  if (!finalizadoEm) return null;
  const ms = finalizadoEm.getTime() - atribuidoEm.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return arredondarHoras(ms / MS_HORA);
}

function resultadoVolta(
  finalizadoEm: Date | null,
  itens: ItemVoltaBruta[],
): ResultadoVoltaFisica {
  if (!finalizadoEm) return 'em_conferencia';
  if (itens.length > 0 && itens.every((item) => item.conferido)) return 'conferida';
  return 'divergencia';
}

function chanceDoAcerto(item: ItemVoltaBruta): 1 | 2 | 3 | null {
  if (!item.conferido) return null;
  if (item.tentativas === 2) return 2;
  if (item.tentativas === 3) return 3;
  return 1;
}

function acertosChancePorVolta(entradas: VoltaBruta[]): Map<VoltaBruta, [number, number, number]> {
  const numeros = voltaNumeroPorDocumento(entradas);
  const grupos = new Map<number, VoltaBruta[]>();
  for (const entrada of entradas) {
    if (!numeros.has(entrada)) continue;
    const lista = grupos.get(entrada.idDocumentoEstoque) ?? [];
    lista.push(entrada);
    grupos.set(entrada.idDocumentoEstoque, lista);
  }
  const acertos = new Map<VoltaBruta, [number, number, number]>();
  for (const lista of grupos.values()) {
    lista.sort((a, b) => (numeros.get(a) ?? 0) - (numeros.get(b) ?? 0));
    const jaAcertados = new Set<string>();
    for (const entrada of lista) {
      const contagem: [number, number, number] = [0, 0, 0];
      entrada.itens.forEach((item, indice) => {
        const chance = chanceDoAcerto(item);
        if (chance == null) return;
        const chave =
          item.idItemDocumento != null
            ? `item:${item.idItemDocumento}`
            : `volta:${entrada.origem}:${entrada.cicloId ?? 0}:${indice}`;
        if (jaAcertados.has(chave)) return;
        jaAcertados.add(chave);
        contagem[chance - 1] += 1;
      });
      acertos.set(entrada, contagem);
    }
  }
  return acertos;
}

function voltaNumeroPorDocumento(entradas: VoltaBruta[]): Map<VoltaBruta, number> {
  const grupos = new Map<number, VoltaBruta[]>();
  for (const entrada of entradas) {
    if (entrada.cancelada || !entrada.atribuidoEm) continue;
    const lista = grupos.get(entrada.idDocumentoEstoque) ?? [];
    lista.push(entrada);
    grupos.set(entrada.idDocumentoEstoque, lista);
  }
  const numeros = new Map<VoltaBruta, number>();
  for (const lista of grupos.values()) {
    lista.sort((a, b) => {
      const delta = a.atribuidoEm!.getTime() - b.atribuidoEm!.getTime();
      if (delta !== 0) return delta;
      if (a.origem !== b.origem) return a.origem === 'ciclo' ? -1 : 1;
      return (a.cicloId ?? 0) - (b.cicloId ?? 0);
    });
    lista.forEach((entrada, indice) => numeros.set(entrada, indice + 1));
  }
  return numeros;
}

export function montarVoltasNoPeriodo(
  entradas: VoltaBruta[],
  dataInicio: string,
  dataFim: string,
): VoltaConferenciaFisica[] {
  const numeros = voltaNumeroPorDocumento(entradas);
  const acertos = acertosChancePorVolta(entradas);
  const voltas: VoltaConferenciaFisica[] = [];
  for (const entrada of entradas) {
    if (entrada.cancelada || !entrada.atribuidoEm) continue;
    const atribuidoDia = diaCivilSaoPaulo(entrada.atribuidoEm);
    if (atribuidoDia < dataInicio || atribuidoDia > dataFim) continue;
    const itensConferidos = entrada.itens.filter((item) => item.conferido).length;
    voltas.push({
      chave: `${entrada.idDocumentoEstoque}:${entrada.origem}:${entrada.cicloId ?? 0}`,
      idDocumentoEstoque: entrada.idDocumentoEstoque,
      numeroDocumento: entrada.numeroDocumento,
      conferenteNome: entrada.conferenteNome,
      conferenteLogin: entrada.conferenteLogin,
      conferente: nomeConferenteVolta(entrada.conferenteNome, entrada.conferenteLogin),
      atribuidoEm: entrada.atribuidoEm.toISOString(),
      atribuidoDia,
      finalizadoEm: entrada.finalizadoEm ? entrada.finalizadoEm.toISOString() : null,
      leadTimeHoras: leadTimeHoras(entrada.atribuidoEm, entrada.finalizadoEm),
      resultado: resultadoVolta(entrada.finalizadoEm, entrada.itens),
      voltaNumero: numeros.get(entrada) ?? 1,
      itens: entrada.itens.length,
      itensConferidos,
      acertosChance: acertos.get(entrada) ?? [0, 0, 0],
    });
  }
  voltas.sort((a, b) => b.atribuidoEm.localeCompare(a.atribuidoEm) || a.chave.localeCompare(b.chave));
  return voltas;
}

function horasLeadTime(voltas: VoltaConferenciaFisica[]): number[] {
  return voltas.flatMap((volta) => (volta.leadTimeHoras == null ? [] : [volta.leadTimeHoras]));
}

function finalizada(volta: VoltaConferenciaFisica): boolean {
  return volta.resultado !== 'em_conferencia';
}

function acertosPorChance(
  voltas: VoltaConferenciaFisica[],
): Array<{ chance: 1 | 2 | 3; acertos: number }> {
  const totais: [number, number, number] = [0, 0, 0];
  for (const volta of voltas) {
    totais[0] += volta.acertosChance[0];
    totais[1] += volta.acertosChance[1];
    totais[2] += volta.acertosChance[2];
  }
  return ([1, 2, 3] as const)
    .filter((chance) => totais[chance - 1] > 0)
    .map((chance) => ({ chance, acertos: totais[chance - 1] }));
}

function resumirIdas(voltas: VoltaConferenciaFisica[]) {
  const finalizadas = voltas.filter(finalizada);
  const divergencias = finalizadas.filter((volta) => volta.resultado === 'divergencia');
  const daIda = (numero: number) => finalizadas.filter((volta) => volta.voltaNumero === numero);
  const divergiu = (lista: VoltaConferenciaFisica[]) =>
    lista.filter((volta) => volta.resultado === 'divergencia').length;
  const primeira = daIda(1);
  const segunda = daIda(2);
  const demais = finalizadas.filter((volta) => volta.voltaNumero >= 3);
  return {
    finalizadas,
    divergencias,
    primeira,
    divergenciaPrimeira: divergiu(primeira),
    segunda,
    divergenciaSegunda: divergiu(segunda),
    demais,
    divergenciaDemais: divergiu(demais),
  };
}

export function agregarConferenciaFisica(
  voltas: VoltaConferenciaFisica[],
  dataInicio: string,
  dataFim: string,
): PainelConferenciaFisica {
  const resumo = resumirIdas(voltas);
  const amostra = horasLeadTime(resumo.finalizadas);

  const serieMap = new Map<string, VoltaConferenciaFisica[]>();
  for (const volta of voltas) {
    const lista = serieMap.get(volta.atribuidoDia) ?? [];
    lista.push(volta);
    serieMap.set(volta.atribuidoDia, lista);
  }
  const serieDiaria = [...serieMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, doDia]) => {
      const finalizadasDia = doDia.filter(finalizada);
      return {
        data,
        destinacoes: doDia.length,
        finalizadas: finalizadasDia.length,
        divergencias: finalizadasDia.filter((volta) => volta.resultado === 'divergencia').length,
        leadTimeMedioHoras: media(horasLeadTime(finalizadasDia)),
      };
    });

  const conferenteMap = new Map<string, VoltaConferenciaFisica[]>();
  for (const volta of voltas) {
    const lista = conferenteMap.get(volta.conferente) ?? [];
    lista.push(volta);
    conferenteMap.set(volta.conferente, lista);
  }
  const porConferente = [...conferenteMap.entries()]
    .map(([nome, doConferente]) => {
      const doNome = resumirIdas(doConferente);
      return {
        nome,
        destinacoes: doConferente.length,
        finalizadas: doNome.finalizadas.length,
        divergencias: doNome.divergencias.length,
        taxaDivergencia: taxaPercentual(doNome.divergencias.length, doNome.finalizadas.length),
        primeira: doNome.primeira.length,
        divergenciaPrimeira: doNome.divergenciaPrimeira,
        segunda: doNome.segunda.length,
        divergenciaSegunda: doNome.divergenciaSegunda,
        acertosPorChance: acertosPorChance(doConferente),
        leadTimeMedianoHoras: mediana(horasLeadTime(doNome.finalizadas)),
      };
    })
    .sort((a, b) => b.destinacoes - a.destinacoes || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    dataInicio,
    dataFim,
    kpis: {
      qtdeDestinacoes: voltas.length,
      qtdeFinalizadas: resumo.finalizadas.length,
      qtdeDivergencias: resumo.divergencias.length,
      taxaDivergencia: taxaPercentual(resumo.divergencias.length, resumo.finalizadas.length),
      qtdePrimeira: resumo.primeira.length,
      qtdeDivergenciaPrimeira: resumo.divergenciaPrimeira,
      qtdeSegunda: resumo.segunda.length,
      qtdeDivergenciaSegunda: resumo.divergenciaSegunda,
      qtdeDemais: resumo.demais.length,
      qtdeDivergenciaDemais: resumo.divergenciaDemais,
      qtdeEmConferencia: voltas.filter((volta) => volta.resultado === 'em_conferencia').length,
      leadTimeMedioHoras: media(amostra),
      leadTimeMedianoHoras: mediana(amostra),
      leadTimeMedianoPrimeiraHoras: mediana(horasLeadTime(resumo.primeira)),
      leadTimeMedianoSegundaHoras: mediana(horasLeadTime(resumo.segunda)),
      qtdeAmostraLeadTime: amostra.length,
    },
    serieDiaria,
    porConferente,
  };
}

export function filtrarVoltasConferenciaFisica(
  voltas: VoltaConferenciaFisica[],
  recorte: RecorteConferenciaFisica,
): VoltaConferenciaFisica[] {
  switch (recorte.tipo) {
    case 'destinacoes':
      return voltas;
    case 'finalizadas':
      return voltas.filter(finalizada);
    case 'sem_divergencia':
      return voltas.filter((volta) => volta.resultado === 'conferida');
    case 'divergencia':
      return voltas.filter((volta) => volta.resultado === 'divergencia');
    case 'divergencia_primeira':
      return voltas.filter((volta) => volta.resultado === 'divergencia' && volta.voltaNumero === 1);
    case 'divergencia_segunda':
      return voltas.filter((volta) => volta.resultado === 'divergencia' && volta.voltaNumero >= 2);
    case 'leadtime':
      return voltas.filter((volta) => volta.leadTimeHoras != null);
    case 'dia':
      return recorte.dia.length === 7
        ? voltas.filter((volta) => volta.atribuidoDia.startsWith(recorte.dia))
        : voltas.filter((volta) => volta.atribuidoDia === recorte.dia);
    case 'conferente':
      return voltas.filter((volta) => volta.conferente === recorte.nome);
    default:
      return voltas;
  }
}
