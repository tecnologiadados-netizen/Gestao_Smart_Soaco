export interface RncPainelItem {
  id: number;
  codigoDocumento: string;
  dataOcorrencia: string | null;
  statusRnc: string;
  prazoExecucao: string | null;
  responsavel: string | null;
}

export interface RncPainelIndicadores {
  total: number;
  noPrazo: number;
  vencidas: number;
  semPrazo: number;
  responsaveis: number;
}

export interface RncPainelResponse {
  itens: RncPainelItem[];
  indicadores: RncPainelIndicadores;
  source: "erp" | "indisponivel";
}
