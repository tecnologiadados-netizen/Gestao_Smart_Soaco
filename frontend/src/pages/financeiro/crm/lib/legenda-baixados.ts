export type LegendaBaixadosItem =
  | {
      tipo: "texto-colorido";
      rotulo: string;
      corRotuloClass: string;
      corBolinhaClass: string;
      corRgb: [number, number, number];
      descricao: string;
    }
  | {
      tipo: "bolinha";
      corBolinhaClass: string;
      corRgb: [number, number, number];
      descricao: string;
    };

export const LEGENDA_CORES_BAIXADOS: LegendaBaixadosItem[] = [
  {
    tipo: "texto-colorido",
    rotulo: "Letras em laranja",
    corRotuloClass: "text-orange-500",
    corBolinhaClass: "bg-orange-500",
    corRgb: [249, 115, 22],
    descricao: "finais de semana/feriados",
  },
  {
    tipo: "bolinha",
    corBolinhaClass: "bg-red-500",
    corRgb: [239, 68, 68],
    descricao: "pagamento em atraso",
  },
  {
    tipo: "bolinha",
    corBolinhaClass: "bg-slate-400",
    corRgb: [148, 163, 184],
    descricao: "atraso desconsiderado",
  },
];
