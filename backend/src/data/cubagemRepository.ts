import type { LogProdutoCubagem, LogProdutoVolume, LogVeiculo } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export type StatusDimensionado = 'dimensionado' | 'pendente';

export type VolumeCubagemInput = {
  ordem: number;
  descricao?: string | null;
  alturaMm?: number | null;
  larguraMm?: number | null;
  profundidadeMm?: number | null;
  pesoKg?: number | null;
};

export type ProdutoCubagemInput = {
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  pesoKg?: number | null;
  alturaMm?: number | null;
  larguraMm?: number | null;
  profundidadeMm?: number | null;
  numVolumes?: number;
  empilhavel?: boolean;
  pesoMaxTopoKg?: number | null;
  podeDeitar?: boolean;
  podeVirar?: boolean;
  esteLadoParaCima?: boolean;
  fragilNaoSobrepor?: boolean;
  volumes?: VolumeCubagemInput[];
};

export type VeiculoInput = {
  placa: string;
  modelo?: string | null;
  alturaMm?: number | null;
  larguraMm?: number | null;
  profundidadeMm?: number | null;
  capacidadePesoKg?: number | null;
  taraKg?: number | null;
  pbtKg?: number | null;
  alturaEmpilhamentoMm?: number | null;
  aberturas?: string | null;
  fatorAproveitamento?: number;
  ano?: number | null;
  motoristaPadrao?: string | null;
  ativo?: boolean;
};

function temDimensoesCompletas(
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

export function calcularStatusDimensionado(
  cubagem: Pick<LogProdutoCubagem, 'numVolumes' | 'alturaMm' | 'larguraMm' | 'profundidadeMm'>,
  volumes: Pick<LogProdutoVolume, 'ordem' | 'alturaMm' | 'larguraMm' | 'profundidadeMm'>[]
): StatusDimensionado {
  const numVolumes = Math.max(1, cubagem.numVolumes ?? 1);
  if (numVolumes <= 1) {
    return temDimensoesCompletas(cubagem.alturaMm, cubagem.larguraMm, cubagem.profundidadeMm)
      ? 'dimensionado'
      : 'pendente';
  }
  if (volumes.length < numVolumes) return 'pendente';
  const ordenados = [...volumes].sort((a, b) => a.ordem - b.ordem).slice(0, numVolumes);
  return ordenados.every((v) => temDimensoesCompletas(v.alturaMm, v.larguraMm, v.profundidadeMm))
    ? 'dimensionado'
    : 'pendente';
}

export function calcularStatusVeiculoDimensionado(
  v: Pick<LogVeiculo, 'alturaMm' | 'larguraMm' | 'profundidadeMm'>
): StatusDimensionado {
  return temDimensoesCompletas(v.alturaMm, v.larguraMm, v.profundidadeMm)
    ? 'dimensionado'
    : 'pendente';
}

export function serializarProdutoCubagem(
  row: LogProdutoCubagem & { volumes: LogProdutoVolume[] }
) {
  const status = calcularStatusDimensionado(row, row.volumes);
  return {
    ...row,
    status,
    volumes: [...row.volumes].sort((a, b) => a.ordem - b.ordem),
  };
}

export function serializarVeiculo(row: LogVeiculo) {
  return {
    ...row,
    status: calcularStatusVeiculoDimensionado(row),
  };
}

function veiculoDataPayload(data: VeiculoInput) {
  return {
    placa: data.placa.trim().toUpperCase(),
    modelo: data.modelo?.trim() || null,
    alturaMm: data.alturaMm ?? null,
    larguraMm: data.larguraMm ?? null,
    profundidadeMm: data.profundidadeMm ?? null,
    capacidadePesoKg: data.capacidadePesoKg ?? null,
    taraKg: data.taraKg ?? null,
    pbtKg: data.pbtKg ?? null,
    alturaEmpilhamentoMm: data.alturaEmpilhamentoMm ?? null,
    aberturas: data.aberturas?.trim() || null,
    fatorAproveitamento: data.fatorAproveitamento ?? 0.85,
    ano: data.ano ?? null,
    motoristaPadrao: data.motoristaPadrao?.trim() || null,
    ativo: data.ativo ?? true,
  };
}

// --- Veículos (placa + dimensões da carroceria) ---

export async function listarVeiculos(apenasAtivos = false) {
  const rows = await prisma.logVeiculo.findMany({
    where: apenasAtivos ? { ativo: true } : undefined,
    orderBy: [{ ativo: 'desc' }, { placa: 'asc' }],
  });
  return rows.map(serializarVeiculo);
}

export async function obterVeiculo(id: number) {
  const row = await prisma.logVeiculo.findUnique({ where: { id } });
  return row ? serializarVeiculo(row) : null;
}

export async function obterVeiculoPorPlaca(placa: string) {
  const row = await prisma.logVeiculo.findUnique({
    where: { placa: placa.trim().toUpperCase() },
  });
  return row ? serializarVeiculo(row) : null;
}

export async function criarVeiculo(data: VeiculoInput) {
  const row = await prisma.logVeiculo.create({ data: veiculoDataPayload(data) });
  return serializarVeiculo(row);
}

export async function atualizarVeiculo(id: number, data: VeiculoInput) {
  const row = await prisma.logVeiculo.update({
    where: { id },
    data: veiculoDataPayload(data),
  });
  return serializarVeiculo(row);
}

export async function upsertVeiculoPorPlaca(data: VeiculoInput) {
  const placa = data.placa.trim().toUpperCase();
  const row = await prisma.logVeiculo.upsert({
    where: { placa },
    create: veiculoDataPayload(data),
    update: veiculoDataPayload(data),
  });
  return serializarVeiculo(row);
}

export async function excluirVeiculo(id: number) {
  return prisma.logVeiculo.delete({ where: { id } });
}

// --- Produtos cubagem ---

export async function listarCubagensLocais() {
  return prisma.logProdutoCubagem.findMany({
    include: { volumes: { orderBy: { ordem: 'asc' } } },
  });
}

export async function obterCubagemPorIdProduto(idProduto: number) {
  const row = await prisma.logProdutoCubagem.findUnique({
    where: { idProduto },
    include: { volumes: { orderBy: { ordem: 'asc' } } },
  });
  return row ? serializarProdutoCubagem(row) : null;
}

export async function salvarProdutoCubagem(data: ProdutoCubagemInput) {
  const numVolumes = Math.max(1, data.numVolumes ?? 1);
  const volumes = data.volumes ?? [];

  return prisma.$transaction(async (tx) => {
    const existente = await tx.logProdutoCubagem.findUnique({ where: { idProduto: data.idProduto } });

    const payload = {
      codigoProduto: data.codigoProduto.trim(),
      descricaoProduto: data.descricaoProduto.trim(),
      pesoKg: data.pesoKg ?? null,
      alturaMm: numVolumes <= 1 ? (data.alturaMm ?? null) : null,
      larguraMm: numVolumes <= 1 ? (data.larguraMm ?? null) : null,
      profundidadeMm: numVolumes <= 1 ? (data.profundidadeMm ?? null) : null,
      numVolumes,
      empilhavel: data.empilhavel ?? true,
      pesoMaxTopoKg: data.pesoMaxTopoKg ?? null,
      podeDeitar: data.podeDeitar ?? true,
      podeVirar: data.podeVirar ?? true,
      esteLadoParaCima: data.esteLadoParaCima ?? false,
      fragilNaoSobrepor: data.fragilNaoSobrepor ?? false,
    };

    let cubagem: LogProdutoCubagem;
    if (existente) {
      cubagem = await tx.logProdutoCubagem.update({
        where: { id: existente.id },
        data: payload,
      });
      await tx.logProdutoVolume.deleteMany({ where: { produtoCubagemId: cubagem.id } });
    } else {
      cubagem = await tx.logProdutoCubagem.create({
        data: { idProduto: data.idProduto, ...payload },
      });
    }

    if (numVolumes > 1 && volumes.length > 0) {
      await tx.logProdutoVolume.createMany({
        data: volumes.map((v, idx) => ({
          produtoCubagemId: cubagem.id,
          ordem: v.ordem ?? idx + 1,
          descricao: v.descricao?.trim() || null,
          alturaMm: v.alturaMm ?? null,
          larguraMm: v.larguraMm ?? null,
          profundidadeMm: v.profundidadeMm ?? null,
          pesoKg: v.pesoKg ?? null,
        })),
      });
    }

    const completo = await tx.logProdutoCubagem.findUniqueOrThrow({
      where: { id: cubagem.id },
      include: { volumes: { orderBy: { ordem: 'asc' } } },
    });
    return serializarProdutoCubagem(completo);
  });
}

export async function excluirProdutoCubagem(idProduto: number) {
  const row = await prisma.logProdutoCubagem.findUnique({ where: { idProduto } });
  if (!row) return null;
  await prisma.logProdutoCubagem.delete({ where: { idProduto } });
  return row;
}
