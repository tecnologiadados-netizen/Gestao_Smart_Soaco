import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2, Upload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rh/components/ui/alert-dialog";
import { Button } from "@rh/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@rh/components/ui/dialog";
import { useToast } from "@rh/hooks/use-toast";
import { getCurrentUser } from "@rh/lib/auth";
import { deleteOrganicoFoto, getOrganicoFoto, setOrganicoFoto } from "@rh/lib/api-client";
import { organicoFotoToDataUrl } from "@rh/lib/organico-foto-data-url";

function formatTimestamp(value: string | null): string {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function initialsFromName(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "RH"
  );
}

interface OrganicoFotoUploadProps {
  open: boolean;
  matricula: string;
  nome: string;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function OrganicoFotoUpload({
  open,
  matricula,
  nome,
  canView = true,
  canEdit = true,
  canDelete = true,
}: OrganicoFotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = useMemo(() => getCurrentUser()?.trim() || "Usuário", []);
  const queryKey = ["organico-foto", matricula];
  const [confirmState, setConfirmState] = useState<"replace" | "delete" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fotoQuery = useQuery({
    queryKey,
    queryFn: () => getOrganicoFoto({ matricula, nome }),
    enabled: canView && open && Boolean(matricula),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const fotoMutation = useMutation({
    mutationFn: async (payload: { fotoBase64: string; mimeType: string | null }) =>
      setOrganicoFoto({
        matricula,
        nome,
        fotoBase64: payload.fotoBase64,
        mimeType: payload.mimeType,
        updatedBy: currentUser,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["organico-fotos-resumo"] });
      toast({ title: "Foto salva", description: "A foto do colaborador foi atualizada." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar foto",
        description: error instanceof Error ? error.message : "Não foi possível salvar a foto do colaborador.",
        variant: "destructive",
      });
    },
  });

  const deleteFotoMutation = useMutation({
    mutationFn: async () => deleteOrganicoFoto({ matricula }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["organico-fotos-resumo"] });
      toast({ title: "Foto excluída", description: "A foto do colaborador foi removida." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir foto",
        description: error instanceof Error ? error.message : "Não foi possível excluir a foto do colaborador.",
        variant: "destructive",
      });
    },
  });

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Selecione uma imagem válida.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Use uma imagem de até 2 MB.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const fotoBase64 = typeof reader.result === "string" ? reader.result : "";
      if (!fotoBase64) {
        toast({ title: "Erro ao ler imagem", description: "Não foi possível processar a foto.", variant: "destructive" });
        return;
      }
      fotoMutation.mutate({ fotoBase64, mimeType: file.type || null });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const foto = fotoQuery.data;
  const fotoSrc = useMemo(
    () => organicoFotoToDataUrl(foto?.fotoBase64, foto?.mimeType ?? null),
    [foto?.fotoBase64, foto?.mimeType],
  );
  const updatedAt = formatTimestamp(foto?.updatedAt ?? null);
  const isBusy = fotoMutation.isPending || deleteFotoMutation.isPending;

  const handleConfirmAction = () => {
    if (confirmState === "replace") {
      inputRef.current?.click();
    } else if (confirmState === "delete") {
      deleteFotoMutation.mutate();
    }
    setConfirmState(null);
  };

  if (!canView && !canEdit && !canDelete) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-border/90 bg-background/70 p-4 md:col-span-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/35">
            {fotoSrc ? (
              <button
                type="button"
                className="h-full w-full"
                onClick={() => setPreviewOpen(true)}
                title="Visualizar foto ampliada"
              >
                <img src={fotoSrc} alt={`Foto de ${nome}`} className="h-full w-full object-cover" />
              </button>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initialsFromName(nome)}
                </div>
                <span className="text-[11px]">Sem foto</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Foto do colaborador</h4>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Faça upload de uma foto para ser vinculada a esse colaborador.
            </p>
            {updatedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Atualizada em {updatedAt}
                {foto?.updatedBy ? ` por ${foto.updatedBy}` : ""}.
              </p>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleSelectFile}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {foto ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmState("replace")}
                    disabled={!canEdit || isBusy || !matricula}
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    {fotoMutation.isPending ? "Enviando..." : "Substituir foto"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmState("delete")}
                    disabled={!canDelete || isBusy || !matricula}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {deleteFotoMutation.isPending ? "Excluindo..." : "Excluir foto"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={!canEdit || isBusy || !matricula}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {fotoMutation.isPending ? "Enviando..." : "Enviar foto"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmState !== null} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState === "replace" ? "Confirmar substituição da foto" : "Confirmar exclusão da foto"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState === "replace"
                ? "Ao continuar, você poderá selecionar uma nova imagem para substituir a foto atual deste colaborador."
                : "Tem certeza que deseja excluir a foto deste colaborador? Essa ação removerá a imagem atualmente vinculada ao cadastro."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              {confirmState === "replace" ? "Continuar" : "Excluir foto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl p-4">
          <DialogHeader>
            <DialogTitle>Foto do colaborador</DialogTitle>
          </DialogHeader>
          {fotoSrc ? (
            <div className="flex justify-center">
              <img
                src={fotoSrc}
                alt={`Foto ampliada de ${nome}`}
                className="max-h-[75dvh] w-auto max-w-full rounded-lg object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
