import { memo } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@rh/lib/utils";

export type OrganicoRepresentanteDraft = {
  fotoBase64: string;
  fotoMimeType: string;
  cpf: string;
  admissao: string;
  tempoEmpresa: string;
  cargo: string;
  setor: string;
  area: string;
  nascimento: string;
  idade: string;
  grauInstrucao: string;
  vinculo: string;
  telefone: string;
  telefoneEmergencial: string;
  agencia: string;
  conta: string;
  banco: string;
  chavePix: string;
  casoNaoTenhaPix: string;
};

export const ORGANICO_REPRESENTANTE_DEFAULT_SETOR = "VENDAS - REPRESENTANTES";

export const EMPTY_ORGANICO_REPRESENTANTE_DRAFT: OrganicoRepresentanteDraft = {
  fotoBase64: "",
  fotoMimeType: "",
  cpf: "",
  admissao: "",
  tempoEmpresa: "",
  cargo: "",
  setor: ORGANICO_REPRESENTANTE_DEFAULT_SETOR,
  area: "",
  nascimento: "",
  idade: "",
  grauInstrucao: "",
  vinculo: "",
  telefone: "",
  telefoneEmergencial: "",
  agencia: "",
  conta: "",
  banco: "",
  chavePix: "",
  casoNaoTenhaPix: "",
};

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—"
  );
}

export const OrganicoRepresentanteCard = memo(function OrganicoRepresentanteCard({
  nome,
  nomeRazaoSocial,
  draft,
  onEdit,
  onView,
}: {
  /** Nome fantasia exibido no card. */
  nome: string;
  nomeRazaoSocial: string;
  draft: OrganicoRepresentanteDraft;
  onEdit: () => void;
  onView: () => void;
}) {
  const razaoSocial = String(nomeRazaoSocial ?? "").trim();
  const nomeExibicao = String(nome ?? "").trim();
  const tituloCard = nomeExibicao || razaoSocial || "—";

  const infoRows = [
    { label: "CPF", value: draft.cpf },
    { label: "Admissão", value: draft.admissao },
    { label: "Tempo de empresa", value: draft.tempoEmpresa },
    { label: "Cargo", value: draft.cargo },
    { label: "ÁREA DE ATUAÇÃO DO REPRESENTANTE", value: draft.area },
    { label: "Nascimento", value: draft.nascimento },
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      className="border border-border bg-card rounded-lg px-3 py-3 shadow-sm hover:shadow transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-2">
        {draft.fotoBase64 ? (
          <img
            src={draft.fotoBase64}
            alt={`Foto de ${tituloCard}`}
            className="w-11 h-11 rounded-md shrink-0 object-contain bg-muted/30 border border-border/50"
          />
        ) : (
          <div className="w-11 h-11 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-semibold text-xs">{getInitials(tituloCard)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Representante
          </p>
          <h3 className="font-semibold text-sm text-foreground truncate">{tituloCard}</h3>
          {razaoSocial ? (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              Razão social: <span className="font-medium text-foreground">{razaoSocial}</span>
            </p>
          ) : null}
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 mt-1">
            Ativo
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded-md p-2 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          title="Editar representante"
          aria-label="Editar representante"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 text-[11px] mt-3 pt-3 border-t border-border/60">
        {infoRows.map((item) => (
          <div key={item.label}>
            <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">{item.label}</span>
            <span className={cn("font-medium truncate block", !item.value && "text-muted-foreground")}>
              {item.value || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
