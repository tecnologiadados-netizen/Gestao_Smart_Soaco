"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentoArquivoField } from "@/components/documentos/documento-arquivo-field";
import {
  anexosPreenchidos,
  defaultAnexoRows,
  EquipamentoAnexosField,
  type AnexoItem,
} from "@/components/calibracoes/equipamento-anexos-field";
import { PageBackLink } from "@/components/layout/page-back-link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalibrationsStore } from "@/lib/store/calibrations-store";
import { useConfigStore } from "@/lib/store/config-store";
import { tipoCalibracaoSelectLabel, userSelectLabel } from "@/lib/utils/select-display";
import { useLoading } from "@/components/providers/loading-provider";

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

export default function CadastroEquipamentosPage() {
  const router = useRouter();
  const { withLoading } = useLoading();
  const createEquipment = useCalibrationsStore((s) => s.createEquipment);
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const users = useConfigStore((s) => s.users);
  const activeUsers = users.filter((u) => u.ativo);

  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [responsavelId, setResponsavelId] = useState(currentUserId);
  const [fornecedor, setFornecedor] = useState("");
  const [tipoCalibracao, setTipoCalibracao] = useState<"interna" | "externa" | "ambos">("interna");
  const [freqCal, setFreqCal] = useState("365");
  const [ultimaCalibracao, setUltimaCalibracao] = useState("");
  const [laudoNome, setLaudoNome] = useState("");
  const [laudoDataUrl, setLaudoDataUrl] = useState("");
  const [anexos, setAnexos] = useState<AnexoItem[]>(() => defaultAnexoRows());
  const [saving, setSaving] = useState(false);
  const laudoInputId = useId();

  function handleLaudoSelect(file: File) {
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLaudoNome(file.name);
      setLaudoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveLaudo() {
    setLaudoNome("");
    setLaudoDataUrl("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo || !descricao || !responsavelId || saving) return;

    setSaving(true);
    await withLoading(async () => {
      createEquipment({
        codigo,
        descricao,
        local,
        fornecedor,
        responsavelId,
        tipoCalibracao,
        frequenciaCalibracaoDias: Number(freqCal),
        ultimaCalibracao: ultimaCalibracao
          ? new Date(ultimaCalibracao).toISOString()
          : undefined,
        laudoNome: laudoNome || undefined,
        laudoDataUrl: laudoDataUrl || undefined,
        anexos: anexosPreenchidos(anexos),
      });

      router.push("/calibracoes");
    }, "Salvando equipamento...");
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageBackLink href="/calibracoes" label="Voltar para calibrações" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadastro de equipamentos</h1>
        <p className="text-sm text-muted-foreground">
          Registre equipamentos de medição e controle
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="modal-header-bar px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">Novo equipamento</h2>
          <p className="mt-0.5 text-xs text-white/80">
            Preencha a última calibração para migrar histórico manualmente
          </p>
        </div>

        <div className="space-y-6 p-6">
          <fieldset className="brand-fieldset space-y-4">
            <legend>Identificação</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  placeholder="Ex: EQ-010"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Input
                  id="descricao"
                  placeholder="Ex: Paquímetro digital 300 mm"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="local">Localização</Label>
                <Input
                  id="local"
                  placeholder="Ex: Produção — Inspeção final"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="brand-fieldset space-y-4">
            <legend>Responsabilidade</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Select
                  value={responsavelId}
                  onValueChange={(v) => v && setResponsavelId(v)}
                >
                  <SelectTrigger id="responsavel" className={selectTriggerClass}>
                    <SelectValue placeholder="Selecione o responsável">
                      {userSelectLabel(activeUsers, responsavelId) ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Input
                  id="fornecedor"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Ex: Laboratório de calibração"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="brand-fieldset space-y-4">
            <legend>Calibração</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo calibração</Label>
                <Select
                  value={tipoCalibracao}
                  onValueChange={(v) =>
                    setTipoCalibracao(v as "interna" | "externa" | "ambos")
                  }
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue>
                      {tipoCalibracaoSelectLabel(tipoCalibracao) ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interna">Interna</SelectItem>
                    <SelectItem value="externa">Externa</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="freqCal">Freq. calibração (dias)</Label>
                <Input
                  id="freqCal"
                  type="number"
                  min={1}
                  value={freqCal}
                  onChange={(e) => setFreqCal(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ultCal">Última calibração</Label>
                <Input
                  id="ultCal"
                  type="date"
                  value={ultimaCalibracao}
                  onChange={(e) => setUltimaCalibracao(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="brand-fieldset space-y-4">
            <legend>Documentação</legend>
            <DocumentoArquivoField
              inputId={laudoInputId}
              label="Laudo"
              arquivoNome={laudoNome}
              arquivoDataUrl={laudoDataUrl}
              onFileSelect={handleLaudoSelect}
              onRemove={handleRemoveLaudo}
              hint="PDF ou imagem do laudo de calibração · máx. 5 MB"
            />
            <EquipamentoAnexosField value={anexos} onChange={setAnexos} />
          </fieldset>
        </div>

        <div className="sgq-form-footer justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Salvar equipamento
          </Button>
        </div>
      </form>
    </div>
  );
}
