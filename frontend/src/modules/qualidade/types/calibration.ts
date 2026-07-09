export type CalibrationType = "interna" | "externa" | "ambos";

export type DueStatus = "em_dia" | "proximo" | "vencido";

export interface Equipment {
  id: string;
  codigo: string;
  descricao: string;
  local: string;
  setorId: string;
  responsavelId: string;
  fornecedor?: string;
  tipoCalibracao: CalibrationType;
  frequenciaCalibracaoDias: number;
  frequenciaVerificacaoDias: number;
  ultimaCalibracao?: string;
  ultimaVerificacao?: string;
  proximaCalibracao?: string;
  laudoNome?: string;
  laudoDataUrl?: string;
  laudoAnexos?: EquipmentAnexo[];
  anexos?: EquipmentAnexo[];
  versaoLaudoAtual?: string;
  ativo: boolean;
}

export interface EquipmentAnexo {
  nome: string;
  dataUrl: string;
}

export interface CalibrationRecord {
  id: string;
  equipmentId: string;
  versao: string;
  data: string;
  tipo: "interna" | "externa";
  resultado: "aprovado" | "reprovado";
  responsavelId: string;
  laboratorio?: string;
  laudoNome?: string;
  laudoDataUrl?: string;
  anexos?: EquipmentAnexo[];
  observacoes?: string;
}

export interface VerificationRecord {
  id: string;
  equipmentId: string;
  data: string;
  resultado: "aprovado" | "reprovado";
  responsavelId: string;
  observacoes?: string;
}

export interface EquipmentWithDue extends Equipment {
  proximaCalibracao?: string;
  proximaVerificacao?: string;
  statusCalibracao: DueStatus;
  statusVerificacao: DueStatus;
}
