/** Cliente retornado pelo ERP Nomus (tabela pessoa). */
export interface ClienteErp {
  id: string;
  nome: string;
  razaoSocial: string;
  municipio: string;
  uf: string;
  endereco?: string;
  bairro?: string;
  telefone?: string;
  contato?: string;
  documento?: string;
}

export const CAMPOS_VINCULADOS_CLIENTE_RCC = [
  "nomeClienteConsumidor",
  "cidade",
  "estado",
  "contato",
  "telefone",
  "bairro",
  "endereco",
] as const;

export function formatarCidadeRcc(municipio: string, uf: string): string {
  const cidade = municipio.trim();
  const estado = uf.trim().toUpperCase();
  if (cidade && estado) return `${cidade}-${estado}`;
  return cidade || estado;
}

export function clienteErpParaCamposRcc(cliente: ClienteErp): {
  nomeClienteConsumidor: string;
  cidade: string;
  estado: string;
  contato: string;
  telefone: string;
  bairro: string;
  endereco: string;
} {
  return {
    nomeClienteConsumidor: cliente.nome,
    cidade: formatarCidadeRcc(cliente.municipio, cliente.uf),
    estado: cliente.uf.trim().toUpperCase(),
    contato: cliente.contato ?? "",
    telefone: cliente.telefone ?? "",
    bairro: cliente.bairro ?? "",
    endereco: cliente.endereco ?? "",
  };
}

export function clienteErpParaCamposRevendedorRcc(cliente: ClienteErp): {
  nomeRevendedor: string;
  cidadeRevendedor: string;
  estadoRevendedor: string;
} {
  return {
    nomeRevendedor: cliente.nome,
    cidadeRevendedor: formatarCidadeRcc(cliente.municipio, cliente.uf),
    estadoRevendedor: cliente.uf.trim().toUpperCase(),
  };
}
