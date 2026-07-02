import type { LogVeiculo } from '@prisma/client';
import {
  calcularStatusDimensionado,
  calcularStatusVeiculoDimensionado,
  type StatusDimensionado,
} from '../data/cubagemRepository.js';

export type VolumeExpandido = {
  id: string;
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  alturaMm: number;
  larguraMm: number;
  profundidadeMm: number;
  pesoKg: number | null;
  volumeOrdem: number;
  itemIndex: number;
  sequencia: number;
  idChave?: string;
  pd?: string;
  valorUnitario: number | null;
  empilhavel: boolean;
  esteLadoParaCima: boolean;
  fragilNaoSobrepor: boolean;
};

export type CubagemProdutoInput = {
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  pesoKg: number | null;
  alturaMm: number | null;
  larguraMm: number | null;
  profundidadeMm: number | null;
  numVolumes: number;
  empilhavel: boolean;
  esteLadoParaCima: boolean;
  fragilNaoSobrepor: boolean;
  volumes: Array<{
    ordem: number;
    alturaMm: number | null;
    larguraMm: number | null;
    profundidadeMm: number | null;
    pesoKg: number | null;
  }>;
};

export type ItemSimulacaoInput = {
  idProduto: number;
  quantidade: number;
  idChave?: string;
  pd?: string;
  sequencia?: number;
  valorUnitario?: number | null;
  cubagem: CubagemProdutoInput | null;
  codigoProduto?: string;
  descricaoProduto?: string;
};

export type RetanguloLayout2D = {
  id: string;
  codigoProduto: string;
  x: number;
  y: number;
  w: number;
  h: number;
  overflow: boolean;
  cor: string;
};

export type Layout2D = {
  superior: RetanguloLayout2D[];
  lateral: RetanguloLayout2D[];
};

export type IndicadoresSimulacao = {
  volumeTotalMm3: number;
  capacidadeVolumeMm3: number;
  pctVolume: number;
  pesoTotalKg: number | null;
  capacidadePesoKg: number | null;
  pctPeso: number | null;
  numVolumes: number;
  numItens: number;
  valorTotal: number;
  limitante: 'volume' | 'peso' | null;
  pesoDisponivel: boolean;
  aproveitamentoAbaixoAlvo: boolean;
};

export type ExcessosSimulacao = {
  volume: boolean;
  peso: boolean;
};

export type AvisoSimulacao = {
  tipo: 'empilhamento' | 'fragil' | 'este_lado_cima' | 'aproveitamento';
  mensagem: string;
};

export type ResultadoSimulacao = {
  indicadores: IndicadoresSimulacao;
  excessos: ExcessosSimulacao;
  avisos: AvisoSimulacao[];
  layout2D: Layout2D;
  volumes: VolumeExpandido[];
};

const CORES = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
];

function temDimensoes(
  altura?: number | null,
  largura?: number | null,
  profundidade?: number | null
): boolean {
  return (
    altura != null &&
    altura > 0 &&
    largura != null &&
    largura > 0 &&
    profundidade != null &&
    profundidade > 0
  );
}

export function statusCubagemProduto(cubagem: CubagemProdutoInput | null): StatusDimensionado {
  if (!cubagem) return 'pendente';
  return calcularStatusDimensionado(cubagem, cubagem.volumes);
}

export function detectarPendencias(itens: ItemSimulacaoInput[]): Array<{
  idProduto: number;
  codigoProduto: string;
  motivo: string;
}> {
  const pendencias: Array<{ idProduto: number; codigoProduto: string; motivo: string }> = [];
  for (const item of itens) {
    const codigo = item.codigoProduto ?? item.cubagem?.codigoProduto ?? String(item.idProduto);
    if (!item.cubagem) {
      pendencias.push({ idProduto: item.idProduto, codigoProduto: codigo, motivo: 'Sem cubagem cadastrada' });
      continue;
    }
    if (statusCubagemProduto(item.cubagem) === 'pendente') {
      pendencias.push({ idProduto: item.idProduto, codigoProduto: codigo, motivo: 'Dimensões incompletas' });
    }
  }
  return pendencias;
}

export function expandirItensParaVolumes(itens: ItemSimulacaoInput[]): VolumeExpandido[] {
  const volumes: VolumeExpandido[] = [];
  let itemIndex = 0;

  const ordenados = [...itens].sort((a, b) => (a.sequencia ?? 999) - (b.sequencia ?? 999));

  for (const item of ordenados) {
    if (!item.cubagem || statusCubagemProduto(item.cubagem) !== 'dimensionado') continue;

    const cub = item.cubagem;
    const qty = Math.max(1, Math.round(item.quantidade) || 1);
    const numVol = Math.max(1, cub.numVolumes ?? 1);

    for (let u = 0; u < qty; u++) {
      for (let v = 0; v < numVol; v++) {
        let alturaMm: number;
        let larguraMm: number;
        let profundidadeMm: number;
        let pesoKg: number | null;

        if (numVol > 1 && cub.volumes.length >= numVol) {
          const vol = cub.volumes.sort((a, b) => a.ordem - b.ordem)[v];
          alturaMm = vol.alturaMm!;
          larguraMm = vol.larguraMm!;
          profundidadeMm = vol.profundidadeMm!;
          pesoKg = vol.pesoKg ?? cub.pesoKg;
        } else {
          alturaMm = cub.alturaMm!;
          larguraMm = cub.larguraMm!;
          profundidadeMm = cub.profundidadeMm!;
          pesoKg = cub.pesoKg;
        }

        volumes.push({
          id: `${item.idProduto}-${itemIndex}-${u}-${v}`,
          idProduto: item.idProduto,
          codigoProduto: cub.codigoProduto,
          descricaoProduto: cub.descricaoProduto,
          alturaMm,
          larguraMm,
          profundidadeMm,
          pesoKg,
          volumeOrdem: v + 1,
          itemIndex,
          sequencia: item.sequencia ?? itemIndex + 1,
          idChave: item.idChave,
          pd: item.pd,
          valorUnitario: item.valorUnitario ?? null,
          empilhavel: cub.empilhavel,
          esteLadoParaCima: cub.esteLadoParaCima,
          fragilNaoSobrepor: cub.fragilNaoSobrepor,
        });
      }
      itemIndex++;
    }
  }

  return volumes;
}

export function calcularVolumeTotalMm3(volumes: VolumeExpandido[]): number {
  return volumes.reduce((s, v) => s + v.alturaMm * v.larguraMm * v.profundidadeMm, 0);
}

export function calcularCapacidadeVeiculo(veiculo: LogVeiculo): {
  volumeMm3: number;
  alturaUtilMm: number;
  larguraMm: number;
  profundidadeMm: number;
} | null {
  if (calcularStatusVeiculoDimensionado(veiculo) !== 'dimensionado') return null;

  const alturaUtilMm = veiculo.alturaEmpilhamentoMm ?? veiculo.alturaMm!;
  const larguraMm = veiculo.larguraMm!;
  const profundidadeMm = veiculo.profundidadeMm!;
  const fator = veiculo.fatorAproveitamento ?? 0.85;

  return {
    volumeMm3: Math.round(alturaUtilMm * larguraMm * profundidadeMm * fator),
    alturaUtilMm,
    larguraMm,
    profundidadeMm,
  };
}

export function calcularPesoTotal(volumes: VolumeExpandido[]): number | null {
  const comPeso = volumes.filter((v) => v.pesoKg != null && v.pesoKg > 0);
  if (comPeso.length === 0) return null;
  return comPeso.reduce((s, v) => s + (v.pesoKg ?? 0), 0);
}

export function detectarExcessos(
  volumeTotal: number,
  capacidadeVolume: number,
  pesoTotal: number | null,
  capacidadePeso: number | null
): ExcessosSimulacao {
  return {
    volume: volumeTotal > capacidadeVolume,
    peso: pesoTotal != null && capacidadePeso != null && pesoTotal > capacidadePeso,
  };
}

export function gerarAvisos(
  volumes: VolumeExpandido[],
  pctVolume: number,
  fatorAlvo: number
): AvisoSimulacao[] {
  const avisos: AvisoSimulacao[] = [];

  const fragil = volumes.filter((v) => v.fragilNaoSobrepor);
  if (fragil.length > 0) {
    avisos.push({
      tipo: 'fragil',
      mensagem: `${fragil.length} volume(s) marcado(s) como frágil / não sobrepor.`,
    });
  }

  const esteLado = volumes.filter((v) => v.esteLadoParaCima);
  if (esteLado.length > 0) {
    avisos.push({
      tipo: 'este_lado_cima',
      mensagem: `${esteLado.length} volume(s) com orientação "este lado para cima".`,
    });
  }

  const naoEmpilhavel = volumes.filter((v) => !v.empilhavel);
  if (naoEmpilhavel.length > 0) {
    avisos.push({
      tipo: 'empilhamento',
      mensagem: `${naoEmpilhavel.length} volume(s) não empilhável(is).`,
    });
  }

  if (pctVolume > 0 && pctVolume < fatorAlvo * 100) {
    avisos.push({
      tipo: 'aproveitamento',
      mensagem: `Aproveitamento (${pctVolume.toFixed(1)}%) abaixo do alvo (${(fatorAlvo * 100).toFixed(0)}%).`,
    });
  }

  return avisos;
}

export function gerarLayout2DSimples(
  volumes: VolumeExpandido[],
  veiculo: LogVeiculo,
  excessoVolume: boolean
): Layout2D {
  const cap = calcularCapacidadeVeiculo(veiculo);
  if (!cap || volumes.length === 0) {
    return { superior: [], lateral: [] };
  }

  const { larguraMm, profundidadeMm, alturaUtilMm } = cap;
  const corPorCodigo = new Map<string, string>();
  let corIdx = 0;

  const getCor = (codigo: string) => {
    if (!corPorCodigo.has(codigo)) {
      corPorCodigo.set(codigo, CORES[corIdx % CORES.length]);
      corIdx++;
    }
    return corPorCodigo.get(codigo)!;
  };

  // Vista superior: FFD por área de base, fileiras ao longo da profundidade
  const sorted = [...volumes].sort(
    (a, b) => b.larguraMm * b.profundidadeMm - a.larguraMm * a.profundidadeMm
  );

  const superior: RetanguloLayout2D[] = [];
  let cursorX = 0;
  let cursorZ = 0;
  let rowMaxDepth = 0;
  let overflow = false;

  for (const vol of sorted) {
    if (cursorX + vol.larguraMm > larguraMm) {
      cursorX = 0;
      cursorZ += rowMaxDepth;
      rowMaxDepth = 0;
    }

    const fits = cursorZ + vol.profundidadeMm <= profundidadeMm && vol.larguraMm <= larguraMm;
    if (!fits && !excessoVolume) {
      overflow = true;
    }

    const nx = cursorX / larguraMm;
    const ny = cursorZ / profundidadeMm;
    const nw = vol.larguraMm / larguraMm;
    const nh = vol.profundidadeMm / profundidadeMm;

    superior.push({
      id: vol.id,
      codigoProduto: vol.codigoProduto,
      x: Math.min(nx, 1),
      y: Math.min(ny, 1),
      w: Math.min(nw, 1 - nx),
      h: Math.min(nh, 1 - ny),
      overflow: !fits || excessoVolume,
      cor: getCor(vol.codigoProduto),
    });

    cursorX += vol.larguraMm;
    rowMaxDepth = Math.max(rowMaxDepth, vol.profundidadeMm);

    if (cursorZ + rowMaxDepth > profundidadeMm) {
      overflow = true;
    }
  }

  // Vista lateral: camadas por altura empilhada ao longo da profundidade
  const lateral: RetanguloLayout2D[] = [];
  let latZ = 0;
  let latAlturaAcum = 0;

  for (const vol of sorted) {
    if (latZ + vol.profundidadeMm > profundidadeMm) {
      latZ = 0;
      latAlturaAcum = 0;
    }

    const fitsAlt = latAlturaAcum + vol.alturaMm <= alturaUtilMm;
    const fitsProf = latZ + vol.profundidadeMm <= profundidadeMm;

    lateral.push({
      id: vol.id + '-lat',
      codigoProduto: vol.codigoProduto,
      x: latZ / profundidadeMm,
      y: 1 - (latAlturaAcum + vol.alturaMm) / alturaUtilMm,
      w: vol.profundidadeMm / profundidadeMm,
      h: vol.alturaMm / alturaUtilMm,
      overflow: !fitsAlt || !fitsProf || excessoVolume,
      cor: getCor(vol.codigoProduto),
    });

    latZ += vol.profundidadeMm;
    if (latZ >= profundidadeMm) {
      latZ = 0;
      latAlturaAcum += vol.alturaMm;
    }
  }

  return { superior, lateral };
}

export function calcularIndicadores(
  volumes: VolumeExpandido[],
  itens: ItemSimulacaoInput[],
  veiculo: LogVeiculo
): {
  indicadores: IndicadoresSimulacao;
  excessos: ExcessosSimulacao;
  avisos: AvisoSimulacao[];
} {
  const cap = calcularCapacidadeVeiculo(veiculo);
  const volumeTotalMm3 = calcularVolumeTotalMm3(volumes);
  const capacidadeVolumeMm3 = cap?.volumeMm3 ?? 0;
  const pctVolume = capacidadeVolumeMm3 > 0 ? (volumeTotalMm3 / capacidadeVolumeMm3) * 100 : 0;

  const pesoTotalKg = calcularPesoTotal(volumes);
  const capacidadePesoKg = veiculo.capacidadePesoKg;
  const pesoDisponivel = pesoTotalKg != null && capacidadePesoKg != null && capacidadePesoKg > 0;
  const pctPeso = pesoDisponivel ? (pesoTotalKg! / capacidadePesoKg!) * 100 : null;

  const excessos = detectarExcessos(
    volumeTotalMm3,
    capacidadeVolumeMm3,
    pesoTotalKg,
    capacidadePesoKg
  );

  let limitante: 'volume' | 'peso' | null = null;
  if (excessos.volume || excessos.peso) {
    const pctVolNorm = capacidadeVolumeMm3 > 0 ? volumeTotalMm3 / capacidadeVolumeMm3 : 0;
    const pctPesoNorm = pesoDisponivel ? pesoTotalKg! / capacidadePesoKg! : 0;
    limitante = pctVolNorm >= pctPesoNorm ? 'volume' : 'peso';
  } else if (pctVolume >= (pctPeso ?? 0)) {
    limitante = 'volume';
  } else if (pctPeso != null) {
    limitante = 'peso';
  }

  const valorTotal = itens.reduce((s, item) => {
    const qty = Math.max(0, item.quantidade);
    const val = item.valorUnitario ?? 0;
    return s + qty * val;
  }, 0);

  const fatorAlvo = veiculo.fatorAproveitamento ?? 0.85;
  const avisos = gerarAvisos(volumes, pctVolume, fatorAlvo);

  return {
    indicadores: {
      volumeTotalMm3,
      capacidadeVolumeMm3,
      pctVolume: Math.round(pctVolume * 10) / 10,
      pesoTotalKg,
      capacidadePesoKg,
      pctPeso: pctPeso != null ? Math.round(pctPeso * 10) / 10 : null,
      numVolumes: volumes.length,
      numItens: itens.length,
      valorTotal: Math.round(valorTotal * 100) / 100,
      limitante,
      pesoDisponivel,
      aproveitamentoAbaixoAlvo: pctVolume > 0 && pctVolume < fatorAlvo * 100,
    },
    excessos,
    avisos,
  };
}

export function executarSimulacao(
  veiculo: LogVeiculo,
  itens: ItemSimulacaoInput[]
): ResultadoSimulacao {
  if (calcularStatusVeiculoDimensionado(veiculo) !== 'dimensionado') {
    throw new Error('Veículo sem dimensões completas. Selecione um veículo dimensionado.');
  }

  const pendencias = detectarPendencias(itens);
  if (pendencias.length > 0) {
    const codigos = pendencias.map((p) => p.codigoProduto).join(', ');
    throw new Error(`Produtos pendentes de cubagem: ${codigos}`);
  }

  const volumes = expandirItensParaVolumes(itens);
  const { indicadores, excessos, avisos } = calcularIndicadores(volumes, itens, veiculo);
  const layout2D = gerarLayout2DSimples(volumes, veiculo, excessos.volume);

  return { indicadores, excessos, avisos, layout2D, volumes };
}
