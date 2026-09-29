import { formatarCidadeRcc } from "@qualidade/types/cliente-erp";

export interface PessoaErp {
  id: string;
  nome: string;
  documento?: string;
  municipio?: string;
  uf?: string;
  endereco?: string;
  bairro?: string;
  telefone?: string;
  contato?: string;
}

export const PESSOAS_INITIAL_LIMIT = 40;
export const PESSOAS_SEARCH_LIMIT = 100;
export const PESSOAS_MIN_SEARCH_CHARS = 2;

/** Preenche o cliente consumidor da RCC com o cadastro da pessoa no Nomus. */
export function pessoaErpParaCamposClienteRcc(pessoa: PessoaErp): {
  nomeClienteConsumidor: string;
  cidade: string;
  estado: string;
  contato: string;
  telefone: string;
  bairro: string;
  endereco: string;
  pontoReferencia: string;
} {
  return {
    nomeClienteConsumidor: pessoa.nome,
    cidade: formatarCidadeRcc(pessoa.municipio ?? "", pessoa.uf ?? ""),
    estado: (pessoa.uf ?? "").trim().toUpperCase(),
    contato: pessoa.contato ?? "",
    telefone: pessoa.telefone ?? "",
    bairro: pessoa.bairro ?? "",
    endereco: pessoa.endereco ?? "",
    pontoReferencia: "",
  };
}
