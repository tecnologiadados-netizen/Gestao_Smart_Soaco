export type FilhoTratativa = {
  id: number;
  nome: string;
  /** Só aparece na fila Prioridade (títulos não prescritos). */
  soPrioridade?: boolean;
};

export type CategoriaTratativa = {
  id: number;
  nome: string;
  filhos: FilhoTratativa[];
};

export const CATEGORIAS_TRATATIVA: CategoriaTratativa[] = [
  {
    id: 1,
    nome: 'Tentativa de contato',
    filhos: [
      { id: 11, nome: 'Ligou e não atendeu' },
      { id: 12, nome: 'Caixa postal / ocupado' },
      { id: 13, nome: 'WhatsApp enviado, sem resposta' },
      { id: 14, nome: 'E-mail enviado, sem resposta' },
      { id: 15, nome: 'Telefone inválido / não existe' },
      { id: 16, nome: 'Cliente recusou falar / desligou' },
      { id: 19, nome: 'Outro' },
    ],
  },
  {
    id: 2,
    nome: 'Conseguiu falar',
    filhos: [
      { id: 21, nome: 'Previsão de pagamento' },
      { id: 22, nome: 'Pediu 2ª via / boleto' },
      { id: 23, nome: 'Contestou valor / NF' },
      { id: 24, nome: 'Pediu prazo / renegociação' },
      { id: 25, nome: 'Pediu desconto' },
      { id: 26, nome: 'Quer parcelar' },
      { id: 27, nome: 'Disse que já pagou' },
      { id: 28, nome: 'Pediu para retornar em outra data' },
      { id: 29, nome: 'Outro' },
    ],
  },
  {
    id: 3,
    nome: 'Impedimento',
    filhos: [
      { id: 31, nome: 'Sem telefone / e-mail no cadastro' },
      { id: 32, nome: 'Cadastro desatualizado' },
      { id: 33, nome: 'Título prescrito — não negativar' },
      { id: 34, nome: 'Cliente em RJ / falência' },
      { id: 35, nome: 'Aguardando retorno interno (comercial / jurídico)' },
      { id: 39, nome: 'Outro' },
    ],
  },
  {
    id: 4,
    nome: 'Encerramento',
    filhos: [
      { id: 41, nome: 'Pagamento confirmado' },
      { id: 42, nome: 'Acordo cumprido' },
      { id: 43, nome: 'Encaminhado ao jurídico' },
      { id: 44, nome: 'Cliente sem interesse / recusou acordo' },
      {
        id: 45,
        nome: 'Inadimplente reiterado — próxima ação (negativar / protestar)',
        soPrioridade: true,
      },
      { id: 49, nome: 'Outro' },
    ],
  },
  {
    id: 5,
    nome: 'Negociar com cliente',
    filhos: [{ id: 51, nome: 'Acordo' }],
  },
];

export const CATEGORIA_NEGOCIAR_ID = 5;
export const FILHO_ACORDO_NEGOCIACAO_ID = 51;
export const TIPO_TRATATIVA_PADRAO = 'padrao';
export const TIPO_TRATATIVA_NEGOCIACAO = 'negociacao';

export const SEPARADOR_TRATATIVA = ' › ';

export function filhosDaCategoria(
  categoriaId: number | null,
  opts?: { tituloPrescrito?: boolean; filhoAtualId?: number | null },
): FilhoTratativa[] {
  const cat = CATEGORIAS_TRATATIVA.find((c) => c.id === categoriaId);
  if (!cat) return [];
  return cat.filhos.filter((f) => {
    if (!f.soPrioridade) return true;
    if (!opts?.tituloPrescrito) return true;
    return opts.filhoAtualId === f.id;
  });
}

export function montarTextoTratativa(categoria: string, justificativa: string, detalhe: string): string {
  const base = `${categoria}${SEPARADOR_TRATATIVA}${justificativa}`;
  const extra = detalhe.trim();
  return extra ? `${base}\n${extra}` : base;
}

export function parseTextoTratativa(texto: string): {
  categoriaId: number | null;
  filhoId: number | null;
  detalhe: string;
} {
  const raw = texto.replace(/\r\n/g, '\n').trim();
  if (!raw) return { categoriaId: null, filhoId: null, detalhe: '' };

  const [primeira, ...resto] = raw.split('\n');
  const detalheLinhas = resto.join('\n').trim();

  const cats = [...CATEGORIAS_TRATATIVA].sort((a, b) => b.nome.length - a.nome.length);
  for (const cat of cats) {
    const prefix = `${cat.nome}${SEPARADOR_TRATATIVA}`;
    if (!primeira.startsWith(prefix)) continue;
    const restoFilho = primeira.slice(prefix.length).trim();
    const filhos = [...cat.filhos].sort((a, b) => b.nome.length - a.nome.length);
    const filho = filhos.find((f) => restoFilho === f.nome);
    if (filho) {
      return { categoriaId: cat.id, filhoId: filho.id, detalhe: detalheLinhas };
    }
    return { categoriaId: cat.id, filhoId: null, detalhe: [restoFilho, detalheLinhas].filter(Boolean).join('\n') };
  }

  return { categoriaId: null, filhoId: null, detalhe: raw };
}
