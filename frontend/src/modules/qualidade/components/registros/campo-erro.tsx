export function CampoErro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p className="text-xs font-medium text-destructive" role="alert" data-campo-pendente="">
      {mensagem}
    </p>
  );
}

export function mensagemCamposObrigatorios(
  erros: Partial<Record<string, string | undefined>>
): string {
  const lista = [
    ...new Set(
      Object.values(erros).filter((item): item is string => Boolean(item?.trim()))
    ),
  ];
  if (lista.length === 0) return "Preencha os campos obrigatórios destacados.";
  if (lista.length === 1) return `Preencha o campo obrigatório. ${lista[0]}`;
  return `Preencha os ${lista.length} campos obrigatórios destacados no formulário.`;
}

export function rolarAtePrimeiroCampoPendente() {
  const marcador = document.querySelector<HTMLElement>(
    "[data-slot='dialog-content'] [data-campo-pendente]"
  );
  if (!marcador) return;
  const alvo =
    marcador.tagName === "P" && marcador.parentElement
      ? marcador.parentElement
      : marcador;
  alvo.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function destacarCamposPendentes() {
  window.setTimeout(() => rolarAtePrimeiroCampoPendente(), 0);
}
