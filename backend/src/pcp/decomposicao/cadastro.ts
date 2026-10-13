export type FilhoCadastro = {
  codigoNomus: string;
  descricao: string;
  quantidade: number;
  materiaPrimaCodigo: string | null;
  materiaPrimaDescricao: string | null;
};

export type PaiCadastro = {
  grupo: string;
  codigo: string;
  nome: string;
  observacao: string | null;
  filhos: FilhoCadastro[];
};

function texto(valor: unknown): string {
  return String(valor ?? '').trim();
}

export function gerarCodigoPai(): string {
  return `PAI-${Math.floor(Math.random() * 9000) + 1000}`;
}

export function normalizarGrupo(valor: unknown): string {
  const nome = texto(valor).toUpperCase();
  if (!nome) throw new Error('Selecione o setor.');
  if (nome.length > 80) throw new Error('O nome do setor é longo demais.');
  return nome;
}

export function normalizarPaiCadastro(body: unknown): PaiCadastro {
  const bruto = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const grupo = normalizarGrupo(bruto.grupo);
  const nome = texto(bruto.nome).toUpperCase();
  if (!nome) throw new Error('Informe a descrição do produto pai.');

  const codigoInformado = texto(bruto.codigo).toUpperCase();
  const codigo = codigoInformado || gerarCodigoPai();

  const observacao = texto(bruto.observacao);
  const lista = Array.isArray(bruto.filhos) ? bruto.filhos : [];
  const vistos = new Set<string>();
  const filhos: FilhoCadastro[] = [];

  for (const item of lista) {
    const linha = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const codigoNomus = texto(linha.codigoNomus);
    const descricao = texto(linha.descricao);
    if (!codigoNomus) continue;
    const chave = codigoNomus.toUpperCase();
    if (vistos.has(chave)) {
      throw new Error(`O produto ${codigoNomus} está vinculado mais de uma vez.`);
    }
    vistos.add(chave);
    const quantidade = Math.floor(Number(linha.quantidade));
    if (!Number.isFinite(quantidade) || quantidade < 1) {
      throw new Error(`Informe a quantidade no pai de ${codigoNomus}.`);
    }
    const materiaPrimaCodigo = texto(linha.materiaPrimaCodigo);
    const materiaPrimaDescricao = texto(linha.materiaPrimaDescricao);
    filhos.push({
      codigoNomus,
      descricao: descricao || codigoNomus,
      quantidade,
      materiaPrimaCodigo: materiaPrimaCodigo || null,
      materiaPrimaDescricao: materiaPrimaCodigo ? materiaPrimaDescricao || materiaPrimaCodigo : null,
    });
  }

  return {
    grupo,
    codigo,
    nome,
    observacao: observacao || null,
    filhos,
  };
}
