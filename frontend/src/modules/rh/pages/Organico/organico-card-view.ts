/**
 * Modos de exibição dos cards do Orgânico (inspirado no “Visualizar” do Explorer).
 */

export type OrganicoCardViewMode =
  | "extra-large"
  | "large"
  | "medium"
  | "small"
  | "list"
  | "details";

export const ORGANICO_CARD_VIEW_STORAGE_KEY = "people-s-rh:organico-card-view";

export const ORGANICO_CARD_VIEW_OPTIONS: {
  value: OrganicoCardViewMode;
  label: string;
}[] = [
  { value: "extra-large", label: "Ícones extra grandes" },
  { value: "large", label: "Ícones grandes" },
  { value: "medium", label: "Ícones médios" },
  { value: "small", label: "Ícones pequenos" },
  { value: "list", label: "Lista" },
  { value: "details", label: "Detalhes" },
];

const ALL_MODES = new Set<OrganicoCardViewMode>(
  ORGANICO_CARD_VIEW_OPTIONS.map((o) => o.value)
);

export function parseOrganicoCardViewMode(raw: string | null): OrganicoCardViewMode | null {
  if (!raw || !ALL_MODES.has(raw as OrganicoCardViewMode)) return null;
  return raw as OrganicoCardViewMode;
}

/** Classes do container que envolve todos os cards (grade ou coluna). */
export function organicoListContainerClass(mode: OrganicoCardViewMode): string {
  switch (mode) {
    case "extra-large":
      return "grid grid-cols-1 lg:grid-cols-2 gap-5";
    case "large":
      return "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4";
    case "medium":
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";
    case "small":
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2";
    case "list":
      return "flex flex-col gap-2";
    case "details":
      return "flex flex-col gap-1.5";
    default:
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";
  }
}
