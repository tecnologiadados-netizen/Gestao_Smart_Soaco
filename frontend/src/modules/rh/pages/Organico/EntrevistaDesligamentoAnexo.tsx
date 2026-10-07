import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Folder, FileText } from "lucide-react";
import { Label } from "@rh/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rh/components/ui/select";
import { isApiConfigured } from "@rh/lib/api-client";
import {
  arquivoEhPdf,
  entrevistasNoCard,
  type PastaEntrevista,
} from "@rh/lib/entrevista-desligamento";
import { rhFieldLabel, rhFieldSelectTrigger } from "@rh/lib/form-field-styles";
import {
  archiveFolderOptionKey,
  fetchOrganicoDocumentUrl,
  flattenArchiveFolderOptions,
  getOrganicoDocuments,
  parseArchiveFolderOptionKey,
} from "@rh/lib/organico-documents-api";
import { useToast } from "@rh/hooks/use-toast";

type EntrevistaDesligamentoAnexoProps = {
  matricula: string;
  colaboradorNome: string;
  arquivo: File | null;
  pasta: PastaEntrevista | null;
  disabled?: boolean;
  somenteLeitura?: boolean;
  campoId?: string;
  onArquivo: (arquivo: File | null) => void;
  onPasta: (pasta: PastaEntrevista | null) => void;
};

export function EntrevistaDesligamentoAnexo({
  matricula,
  colaboradorNome,
  arquivo,
  pasta,
  disabled,
  somenteLeitura = false,
  campoId,
  onArquivo,
  onPasta,
}: EntrevistaDesligamentoAnexoProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const campo = campoId ?? matricula;
  const { data: pastas = [], isLoading } = useQuery({
    queryKey: ["organico-documents", matricula],
    queryFn: () => getOrganicoDocuments(matricula, colaboradorNome),
    enabled: Boolean(matricula) && isApiConfigured(),
    staleTime: 15_000,
  });
  const opcoes = useMemo(() => flattenArchiveFolderOptions(pastas), [pastas]);
  const entrevistas = useMemo(() => entrevistasNoCard(pastas), [pastas]);
  const faltaPasta = Boolean(arquivo) && !pasta;
  const escolherArquivo = !somenteLeitura;

  useEffect(() => {
    if (!arquivo && inputRef.current) inputRef.current.value = "";
  }, [arquivo]);

  return (
    <div className="space-y-3">
      {escolherArquivo ? (
        <div className="space-y-1.5">
          <Label htmlFor={`entrevista-desligamento-${campo}`} className={rhFieldLabel}>
            Entrevista de desligamento (PDF)
          </Label>
          <input
            id={`entrevista-desligamento-${campo}`}
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            disabled={disabled}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            onChange={(evento) => {
              const file = evento.target.files?.[0] ?? null;
              if (file && !arquivoEhPdf(file)) {
                evento.target.value = "";
                onArquivo(null);
                onPasta(null);
                toast({ title: "Selecione um PDF.", variant: "destructive" });
                return;
              }
              onArquivo(file);
              if (!file) onPasta(null);
            }}
          />
        </div>
      ) : null}
      {escolherArquivo && arquivo ? (
        <div className="space-y-1.5">
          <Label htmlFor={`entrevista-pasta-${campo}`} className={rhFieldLabel}>
            Pasta de destino
          </Label>
          <Select
            value={pasta ? archiveFolderOptionKey(pasta) : undefined}
            onValueChange={(valor) => onPasta(parseArchiveFolderOptionKey(valor))}
            disabled={disabled || isLoading || opcoes.length === 0}
          >
            <SelectTrigger id={`entrevista-pasta-${campo}`} className={rhFieldSelectTrigger}>
              <SelectValue
                placeholder={
                  isLoading
                    ? "Carregando pastas…"
                    : opcoes.length === 0
                      ? "Nenhuma pasta no card deste colaborador"
                      : "Selecione a pasta de destino"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((opcao) => (
                <SelectItem key={archiveFolderOptionKey(opcao)} value={archiveFolderOptionKey(opcao)}>
                  <span className="inline-flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{opcao.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {faltaPasta ? (
            <p className="text-xs text-destructive">Selecione a pasta de destino da entrevista.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Selecionado: {arquivo.name}.</p>
          )}
        </div>
      ) : null}
      {entrevistas.length > 0 ? (
        <div className="space-y-1.5">
          {entrevistas.map((documento) => (
            <button
              key={documento.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 py-2 text-left text-sm text-foreground hover:border-primary/50"
              onClick={() => {
                void (async () => {
                  try {
                    const url = await fetchOrganicoDocumentUrl({
                      matricula,
                      documentId: documento.id,
                    });
                    window.open(url, "_blank", "noopener");
                  } catch (error) {
                    toast({
                      title: "Não foi possível abrir o PDF.",
                      description: error instanceof Error ? error.message : "Tente novamente.",
                      variant: "destructive",
                    });
                  }
                })();
              }}
            >
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{documento.fileName}</span>
              <span className="shrink-0 text-xs font-medium text-primary">Visualizar</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
