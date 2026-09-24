import { useNavigate } from 'react-router-dom';
import { useState } from "react";
import { Button } from "@qualidade/components/ui/button";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { DocumentoArquivoField } from "@qualidade/components/documentos/documento-arquivo-field";
import {
  anexosPreenchidos,
  defaultAnexoRows,
  EquipamentoAnexosField,
  type AnexoItem,
} from "@qualidade/components/calibracoes/equipamento-anexos-field";
import { PageBackLink } from "@qualidade/components/layout/page-back-link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { FornecedorSearchField } from "@qualidade/components/avaliacao-fornecedor/fornecedor-search-field";
import { PessoaSearchField } from "@qualidade/components/registros/pessoa-search-field";
import { useCalibrationsStore } from "@qualidade/lib/store/calibrations-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  departmentSelectLabel,
  tipoCalibracaoSelectLabel,
  userSelectLabel,
} from "@qualidade/lib/utils/select-display";
import { useLoading } from "@qualidade/components/providers/loading-provider";
import {
  flushQualidadeCalibrationsSync,
  markQualidadeCalibrationFilesPending,
} from "@qualidade/lib/qualidadePersistence";
import type { Fornecedor } from "@qualidade/types/avaliacao-fornecedor";

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

export function CadastroEquipamentosPage() {
  const navigate = useNavigate();
  const { withLoading } = useLoading();
  const createEquipment = useCalibrationsStore((s) => s.createEquipment);
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const users = useConfigStore((s) => s.users);
  const departments = useConfigStore((s) => s.departments);
  const activeUsers = users.filter((u) => u.ativo);

  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState(currentUserId);
  const [responsavelPosseId, setResponsavelPosseId] = useState("");
  const [responsavelPosseNome, setResponsavelPosseNome] = useState("");
  const [possuiLocalFixo, setPossuiLocalFixo] = useState<boolean | null>(null);
  const [setorId, setSetorId] = useState("");
  const [fornecedorSelecionado, setFornecedorSelecionado] =
    useState<Fornecedor | null>(null);
  const [tipoCalibracao, setTipoCalibracao] = useState<"interna" | "externa" | "ambos">("interna");
  const [freqCal, setFreqCal] = useState("365");
  const [ultimaCalibracao, setUltimaCalibracao] = useState("");
  const [laudoNome, setLaudoNome] = useState("");
  const [laudoDataUrl, setLaudoDataUrl] = useState("");
  const [anexos, setAnexos] = useState<AnexoItem[]>(() => defaultAnexoRows());
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
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
    const pendentes: string[] = [];
    if (!codigo.trim()) pendentes.push("Código");
    if (!descricao.trim()) pendentes.push("Descrição");
    if (possuiLocalFixo === null) pendentes.push("Possui local fixo de uso");
    if (possuiLocalFixo && !setorId) pendentes.push("Setor do equipamento");
    if (possuiLocalFixo === false && !responsavelPosseId) {
      pendentes.push("Responsável pela posse do equipamento");
    }
    if (!responsavelId) pendentes.push("Responsável pela calibração");
    if (!fornecedorSelecionado?.nome?.trim()) pendentes.push("Fornecedor");
    if (!tipoCalibracao) pendentes.push("Tipo calibração");
    if (!Number.isFinite(Number(freqCal)) || Number(freqCal) < 1) {
      pendentes.push("Freq. calibração (dias)");
    }
    if (!ultimaCalibracao) pendentes.push("Última calibração");
    if (!laudoNome.trim() || !laudoDataUrl.trim()) pendentes.push("Laudo");
    if (pendentes.length > 0) {
      setErro(`Preencha os campos obrigatórios: ${pendentes.join(", ")}.`);
      return;
    }
    if (saving) return;
    setErro("");
    const localFixo = possuiLocalFixo === true;

    setSaving(true);
    await withLoading(async () => {
      const id = createEquipment({
        codigo,
        descricao,
        local: "",
        setorId: localFixo ? setorId : "",
        possuiLocalFixo: localFixo,
        fornecedor: fornecedorSelecionado?.nome,
        responsavelId,
        responsavelPosseId: localFixo ? undefined : responsavelPosseId,
        responsavelPosseNome: localFixo ? undefined : responsavelPosseNome,
        tipoCalibracao,
        frequenciaCalibracaoDias: Number(freqCal),
        ultimaCalibracao: ultimaCalibracao
          ? new Date(ultimaCalibracao).toISOString()
          : undefined,
        laudoNome: laudoNome || undefined,
        laudoDataUrl: laudoDataUrl || undefined,
        anexos: anexosPreenchidos(anexos),
      });

      if (laudoDataUrl || anexosPreenchidos(anexos).length) {
        markQualidadeCalibrationFilesPending(id);
      }

      await flushQualidadeCalibrationsSync();
      navigate("/qualidade/calibracoes");
    }, "Salvando equipamento...");
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageBackLink to="/qualidade/calibracoes" label="Voltar para calibrações" />

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
              <div className="space-y-3 sm:col-span-2">
                <Label>Possui local fixo de uso? *</Label>
                <div className="flex flex-wrap gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="possui-local-fixo"
                      className="size-4 accent-brand-blue"
                      checked={possuiLocalFixo === true}
                      onChange={() => {
                        setPossuiLocalFixo(true);
                        setResponsavelPosseId("");
                        setResponsavelPosseNome("");
                      }}
                    />
                    Sim
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="possui-local-fixo"
                      className="size-4 accent-brand-blue"
                      checked={possuiLocalFixo === false}
                      onChange={() => {
                        setPossuiLocalFixo(false);
                        setSetorId("");
                      }}
                    />
                    Não
                  </label>
                </div>
              </div>
              {possuiLocalFixo === true ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="setor-equipamento">Setor do equipamento *</Label>
                  <Select value={setorId || undefined} onValueChange={(v) => v && setSetorId(v)}>
                    <SelectTrigger id="setor-equipamento" className={selectTriggerClass}>
                      <SelectValue placeholder="Selecione o setor">
                        {departmentSelectLabel(departments, setorId, "nome") ?? null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dep) => (
                        <SelectItem key={dep.id} value={dep.id}>
                          {dep.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {possuiLocalFixo === false ? (
                <div className="sm:col-span-2">
                  <PessoaSearchField
                    id="responsavel-posse"
                    label="Responsável pela posse do equipamento *"
                    value={responsavelPosseNome}
                    apenasFuncionarios
                    placeholder="Digite o nome do funcionário..."
                    onValueChange={(nome) => {
                      setResponsavelPosseNome(nome);
                      if (!nome.trim()) setResponsavelPosseId("");
                    }}
                    onPessoaSelect={(pessoa) => {
                      setResponsavelPosseId(String(pessoa.id));
                      setResponsavelPosseNome(pessoa.nome);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="brand-fieldset space-y-4">
            <legend>Responsabilidade</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável pela calibração *</Label>
                <Select
                  value={responsavelId}
                  onValueChange={(v) => v && setResponsavelId(v)}
                >
                  <SelectTrigger id="responsavel" className={selectTriggerClass}>
                    <SelectValue placeholder="Selecione o usuário">
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
                <FornecedorSearchField
                  id="fornecedor"
                  label="Fornecedor *"
                  value={fornecedorSelecionado}
                  onSelect={setFornecedorSelecionado}
                  onClear={() => setFornecedorSelecionado(null)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="brand-fieldset space-y-4">
            <legend>Calibração</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo calibração *</Label>
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
                <Label htmlFor="freqCal">Freq. calibração (dias) *</Label>
                <Input
                  id="freqCal"
                  type="number"
                  min={1}
                  value={freqCal}
                  onChange={(e) => setFreqCal(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ultCal">Última calibração *</Label>
                <Input
                  id="ultCal"
                  type="date"
                  value={ultimaCalibracao}
                  onChange={(e) => setUltimaCalibracao(e.target.value)}
                  required
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="brand-fieldset space-y-4">
            <legend>Documentação</legend>
            <DocumentoArquivoField
              label="Laudo *"
              arquivoNome={laudoNome}
              arquivoDataUrl={laudoDataUrl}
              onFileSelect={handleLaudoSelect}
              onRemove={handleRemoveLaudo}
              hint="PDF ou imagem do laudo de calibração · máx. 5 MB"
            />
            <EquipamentoAnexosField value={anexos} onChange={setAnexos} />
          </fieldset>
          {erro ? (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="sgq-form-footer">
          <Button type="submit" loading={saving}>
            Salvar equipamento
          </Button>
        </div>
      </form>
    </div>
  );
}
