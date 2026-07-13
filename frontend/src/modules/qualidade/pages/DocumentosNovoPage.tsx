import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from "react";
import { Button } from "@qualidade/components/ui/button";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qualidade/components/ui/card";
import { flushQualidadeDocumentsSync } from "@qualidade/lib/qualidadePersistence";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  departmentSelectLabel,
  documentTypeSelectLabel,
} from "@qualidade/lib/utils/select-display";

export function NovoDocumentoPage() {
  const navigate = useNavigate();
  const createDocument = useDocumentsStore((s) => s.createDocument);
  const getNextDocumentCode = useDocumentsStore((s) => s.getNextDocumentCode);
  const departments = useConfigStore((s) => s.departments);
  const documentTypes = useConfigStore((s) => s.documentTypes);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const [titulo, setTitulo] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [setorId, setSetorId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const tipo = documentTypes.find((t) => t.id === tipoId);
  const tipoLabel = documentTypeSelectLabel(documentTypes, tipoId);
  const setorLabel = departmentSelectLabel(departments, setorId, "nome");
  const codigo = useMemo(
    () => (tipo ? getNextDocumentCode(tipo.sigla) : ""),
    [tipo, getNextDocumentCode]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !tipoId || !setorId || !tipo) return;

    createDocument({
      tipoSigla: tipo.sigla,
      titulo,
      tipoId,
      setorId,
      elaboradorId: currentUserId,
      origem: "interno",
      observacoes: observacoes || undefined,
    });

    try {
      await flushQualidadeDocumentsSync();
      navigate("/qualidade/documentos/consulta");
    } catch (err) {
      console.error("[qualidade] falha ao salvar novo documento:", err);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo documento</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre um novo documento no SGQ
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do documento</CardTitle>
          <CardDescription>
            O documento será criado em status Rascunho
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo">Categoria *</Label>
                <Select value={tipoId} onValueChange={(v) => v && setTipoId(v)} required>
                  <SelectTrigger id="tipo">
                    <SelectValue placeholder="Selecione">
                      {tipoLabel ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.sigla} — {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  readOnly
                  placeholder="Selecione o tipo"
                  className="bg-muted text-muted-foreground"
                  tabIndex={-1}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                placeholder="Título do documento"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setor">Setor *</Label>
              <Select value={setorId} onValueChange={(v) => v && setSetorId(v)} required>
                <SelectTrigger id="setor">
                  <SelectValue placeholder="Selecione o setor">
                    {setorLabel ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                placeholder="Motivo da criação ou revisão..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit">Criar documento</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
