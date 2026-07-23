import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoadingOverlay from "./crm/components/LoadingOverlay";
import PdfGeneratingOverlay from "./crm/components/PdfGeneratingOverlay";
import FiltroPessoa from "./crm/components/FiltroPessoa";
import FiltroEmpresa from "./crm/components/FiltroEmpresa";
import MembrosGrupoPanel from "./crm/components/MembrosGrupoPanel";
import TabelaBaixados from "./crm/components/TabelaBaixados";
import TabelaContas from "./crm/components/TabelaContas";
import TabelaIndicadores from "./crm/components/TabelaIndicadores";
import ModalDetalheIndicador, {
  type ResumoDetalheModal,
} from "./crm/components/ModalDetalheIndicador";

import SaudeClienteGauges from "./crm/components/SaudeClienteGauges";
import type {
  ContaFinanceira,
  DashboardDetalhesData,
  DashboardGlobalData,
  IndicadorClassificacao,
  IndicadorDetalheClickPayload,
  IndicadoresResumo,
  Recebimento,
  SelecaoClienteCrm,
} from "./crm/lib/types";
import {
  filtrarDetalheLocal,
  recebimentosParaRecuperado,
  tituloModalDetalhe,
} from "./crm/lib/indicador-detalhe";
import { downloadDashboardPdf } from "./crm/lib/generate-dashboard-pdf";
import { captureSaudeGaugesForPdf } from "./crm/lib/pdf-capture";
import { calcularSaudeCliente, type SaudeClienteResult } from "./crm/lib/saude-cliente";
import {
  fetchCrmDashboard,
  fetchCrmDetalhe,
  fetchCrmSaudeEmpresa,
} from "../../api/crmFinanceiro";
import type { ColunaIndicador } from "./crm/lib/types";
import { useAuth } from "../../contexts/AuthContext";
import {
  PERMISSOES_ACESSO_FINANCEIRO_CRM_EMPRESA,
  PERMISSOES_ACESSO_FINANCEIRO_CRM_CLIENTE,
  PERMISSOES_ACESSO_FINANCEIRO_CRM_PENDENCIAS,
  PERMISSOES_EDITAR_CRM_PENDENCIAS_DESTINATARIOS,
} from "../../utils/financeiroPermissoes";
import PendenciasCreditoPanel from "./crm/components/PendenciasCreditoPanel";
import RegistroInadimplentesPanel from "./crm/components/RegistroInadimplentesPanel";
import { useSearchParams } from "react-router-dom";

function chaveSelecao(s: SelecaoClienteCrm | null): string | null {
  if (!s) return null;
  return s.tipo === "pessoa" ? `p:${s.nome}` : `g:${s.id}`;
}

function labelSelecao(s: SelecaoClienteCrm | null): string | null {
  if (!s) return null;
  return s.nome;
}

function selecaoSincronizada(
  s: SelecaoClienteCrm,
  data: DashboardDetalhesData | DashboardGlobalData,
): boolean {
  if (s.tipo === "pessoa") {
    return data.pessoaFiltrada === s.nome;
  }
  return data.grupoFiltrado?.id === s.id;
}

type Aba = "receber" | "pagar";
type GuiaPainel = "empresa" | "cliente" | "pendencias" | "inadimplentes";

const CACHE_STORAGE_KEY = "crm-financeiro:indicadores-globais:v13";
const CACHE_SAUDE_EMPRESA_KEY = "crm-financeiro:saude-empresa:v6";

function cacheSuffixEmpresa(empresaId: number | null): string {
  return empresaId != null ? `:emp:${empresaId}` : "";
}

function lerCacheSaudeEmpresa(empresaId: number | null): SaudeClienteResult | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(
      `${CACHE_SAUDE_EMPRESA_KEY}${cacheSuffixEmpresa(empresaId)}`,
    );
    if (!cached) return null;
    return JSON.parse(cached) as SaudeClienteResult;
  } catch {
    return null;
  }
}

function salvarCacheSaudeEmpresa(
  data: SaudeClienteResult,
  empresaId: number | null,
): void {
  try {
    sessionStorage.setItem(
      `${CACHE_SAUDE_EMPRESA_KEY}${cacheSuffixEmpresa(empresaId)}`,
      JSON.stringify(data),
    );
  } catch {
    // Ignora quota ou modo privado
  }
}

function lerCacheLocal(empresaId: number | null): DashboardGlobalData | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(
      `${CACHE_STORAGE_KEY}${cacheSuffixEmpresa(empresaId)}`,
    );
    if (!cached) return null;
    return JSON.parse(cached) as DashboardGlobalData;
  } catch {
    return null;
  }
}

function salvarCacheLocal(
  data: DashboardGlobalData,
  empresaId: number | null,
): void {
  try {
    sessionStorage.setItem(
      `${CACHE_STORAGE_KEY}${cacheSuffixEmpresa(empresaId)}`,
      JSON.stringify(data),
    );
  } catch {
    // Ignora quota ou modo privado
  }
}

function ResumoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="h-12 animate-pulse bg-blue-700/80" />
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SaudeEmpresaSkeleton() {
  return (
    <section className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 space-y-2">
        <div className="h-6 w-96 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-52 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
          />
        ))}
      </div>
    </section>
  );
}

function AbasResumo({
  aba,
  onChange,
}: {
  aba: Aba;
  onChange: (aba: Aba) => void;
}) {
  return (
    <section className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-1 p-1">
        <button
          type="button"
          onClick={() => onChange("receber")}
          className={`rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
            aba === "receber"
              ? "bg-blue-700 text-white shadow"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Contas a receber e recebimentos
        </button>
        <button
          type="button"
          onClick={() => onChange("pagar")}
          className={`rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
            aba === "pagar"
              ? "bg-blue-700 text-white shadow"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Contas a pagar e pagamentos
        </button>
      </div>
    </section>
  );
}

function GuiasPainel({
  guia,
  onChange,
  podeVerEmpresa,
  podeVerCliente,
  podeVerPendencias,
}: {
  guia: GuiaPainel;
  onChange: (guia: GuiaPainel) => void;
  podeVerEmpresa: boolean;
  podeVerCliente: boolean;
  podeVerPendencias: boolean;
}) {
  return (
    <section className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-1 p-1">
        {podeVerEmpresa && (
          <button
            type="button"
            onClick={() => onChange("empresa")}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
              guia === "empresa"
                ? "bg-blue-700 text-white shadow"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Situação geral da empresa
          </button>
        )}
        {podeVerCliente && (
          <button
            type="button"
            onClick={() => onChange("cliente")}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
              guia === "cliente"
                ? "bg-blue-700 text-white shadow"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Análise de crédito por cliente
          </button>
        )}
        {podeVerPendencias && (
          <button
            type="button"
            onClick={() => onChange("pendencias")}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
              guia === "pendencias"
                ? "bg-blue-700 text-white shadow"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Pendências de crédito com PD em carteira
          </button>
        )}
        {podeVerPendencias && (
          <button
            type="button"
            onClick={() => onChange("inadimplentes")}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
              guia === "inadimplentes"
                ? "bg-blue-700 text-white shadow"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Registro de Inadimplentes
          </button>
        )}
      </div>
    </section>
  );
}

export default function CrmFinanceiroPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const podeVerEmpresa = PERMISSOES_ACESSO_FINANCEIRO_CRM_EMPRESA.some((p) =>
    hasPermission(p),
  );
  const podeVerCliente = PERMISSOES_ACESSO_FINANCEIRO_CRM_CLIENTE.some((p) =>
    hasPermission(p),
  );
  const podeVerPendencias = PERMISSOES_ACESSO_FINANCEIRO_CRM_PENDENCIAS.some((p) =>
    hasPermission(p),
  );
  const podeEditarDestinatariosPendencias =
    PERMISSOES_EDITAR_CRM_PENDENCIAS_DESTINATARIOS.some((p) => hasPermission(p));

  const guiaFromUrl = searchParams.get("guia");
  const clienteFromUrl = searchParams.get("cliente");
  const situacaoFromUrl = searchParams.get("situacao");

  const guiaInicial: GuiaPainel = (() => {
    if (guiaFromUrl === "pendencias" && podeVerPendencias) return "pendencias";
    if (guiaFromUrl === "inadimplentes" && podeVerPendencias) return "inadimplentes";
    if (guiaFromUrl === "cliente" && podeVerCliente) return "cliente";
    if (guiaFromUrl === "empresa" && podeVerEmpresa) return "empresa";
    if (podeVerEmpresa) return "empresa";
    if (podeVerCliente) return "cliente";
    return "pendencias";
  })();

  const situacaoPendenciasInicial =
    guiaInicial === "pendencias" &&
    (situacaoFromUrl === "INADIMPLENTES" ||
      situacaoFromUrl === "REGULARIZADOS" ||
      situacaoFromUrl === "FINALIZADOS")
      ? situacaoFromUrl
      : null;

  const [guiaPainel, setGuiaPainel] = useState<GuiaPainel>(guiaInicial);
  const [clientePendenciasFiltro, setClientePendenciasFiltro] = useState<string | null>(
    guiaInicial === "pendencias" && clienteFromUrl ? clienteFromUrl : null,
  );
  const [aba, setAba] = useState<Aba>("receber");
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
  const [selecao, setSelecao] = useState<SelecaoClienteCrm | null>(null);
  const [indicadoresGlobais, setIndicadoresGlobais] =
    useState<DashboardGlobalData | null>(null);
  const [saudeQuadroEmpresa, setSaudeQuadroEmpresa] =
    useState<SaudeClienteResult | null>(null);
  const [carregandoSaudeEmpresa, setCarregandoSaudeEmpresa] = useState(true);
  const [detalhes, setDetalhes] = useState<DashboardDetalhesData | null>(null);
  const [carregandoGlobal, setCarregandoGlobal] = useState(true);
  const [cacheClienteRestaurado, setCacheClienteRestaurado] = useState(false);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalDetalhe, setModalDetalhe] =
    useState<IndicadorDetalheClickPayload | null>(null);
  const [modalModo, setModalModo] = useState<"contas" | "recebimentos">(
    "contas",
  );
  const [modalContas, setModalContas] = useState<ContaFinanceira[]>([]);
  const [modalRecebimentos, setModalRecebimentos] = useState<Recebimento[]>([]);
  const [modalResumoDetalhe, setModalResumoDetalhe] =
    useState<ResumoDetalheModal | null>(null);
  const [modalRecebimentosRecuperado, setModalRecebimentosRecuperado] = useState<
    Recebimento[]
  >([]);
  const [modalCarregando, setModalCarregando] = useState(false);
  const filtroAtivoRef = useRef<string | null>(null);
  const empresaIdRef = useRef<number | null>(null);
  filtroAtivoRef.current = chaveSelecao(selecao);
  empresaIdRef.current = empresaId;
  const requisicaoGlobalRef = useRef(0);
  const requisicaoDetalhesRef = useRef(0);
  const abortGlobalRef = useRef<AbortController | null>(null);
  const abortSaudeEmpresaRef = useRef<AbortController | null>(null);
  const abortDetalhesRef = useRef<AbortController | null>(null);
  const baixadosOrdenadosRef = useRef<Recebimento[] | null>(null);

  const carregarGlobal = useCallback(async (refresh = false) => {
    abortGlobalRef.current?.abort();
    const controller = new AbortController();
    abortGlobalRef.current = controller;

    const requestId = ++requisicaoGlobalRef.current;
    const empresaAtual = empresaId;
    const cached = !refresh ? lerCacheLocal(empresaAtual) : null;
    if (cached) {
      setIndicadoresGlobais(cached);
      setCarregandoGlobal(false);
    } else {
      setCarregandoGlobal(true);
    }
    setErro(null);

    try {
      const json = await fetchCrmDashboard({
        empresaId: empresaAtual,
        refresh,
      }) as DashboardGlobalData;

      if (requestId !== requisicaoGlobalRef.current) return;
      if (filtroAtivoRef.current) return;
      if (empresaIdRef.current !== empresaAtual) return;

      setIndicadoresGlobais(json);
      salvarCacheLocal(json, empresaAtual);
    } catch {
      if (controller.signal.aborted) return;
      if (requestId !== requisicaoGlobalRef.current) return;
      if (filtroAtivoRef.current) return;
      if (empresaIdRef.current !== empresaAtual) return;

      setIndicadoresGlobais((prev) => {
        if (!prev) {
          setErro(
            "Não foi possível conectar ao banco de dados. Verifique o arquivo .env e a conexão.",
          );
        }
        return prev;
      });
    } finally {
      if (
        requestId === requisicaoGlobalRef.current &&
        !filtroAtivoRef.current &&
        empresaIdRef.current === empresaAtual &&
        abortGlobalRef.current === controller
      ) {
        setCarregandoGlobal(false);
      }
    }
  }, [empresaId]);

  const carregarSaudeEmpresa = useCallback(async (refresh = false) => {
    abortSaudeEmpresaRef.current?.abort();
    const controller = new AbortController();
    abortSaudeEmpresaRef.current = controller;

    const empresaAtual = empresaId;
    const cached = !refresh ? lerCacheSaudeEmpresa(empresaAtual) : null;
    if (cached) {
      setSaudeQuadroEmpresa(cached);
      setCarregandoSaudeEmpresa(false);
    } else {
      setCarregandoSaudeEmpresa(true);
    }

    try {
      const json = await fetchCrmSaudeEmpresa({
        empresaId: empresaAtual,
        refresh,
      });
      if (filtroAtivoRef.current) return;
      if (empresaIdRef.current !== empresaAtual) return;

      setSaudeQuadroEmpresa(json);
      salvarCacheSaudeEmpresa(json, empresaAtual);
    } catch {
      if (controller.signal.aborted) return;
      if (filtroAtivoRef.current) return;
      if (empresaIdRef.current !== empresaAtual) return;
      setSaudeQuadroEmpresa((prev) => prev);
    } finally {
      if (
        !filtroAtivoRef.current &&
        empresaIdRef.current === empresaAtual &&
        abortSaudeEmpresaRef.current === controller
      ) {
        setCarregandoSaudeEmpresa(false);
      }
    }
  }, [empresaId]);

  const carregarDetalhes = useCallback(async (selecaoFiltro: SelecaoClienteCrm) => {
    abortDetalhesRef.current?.abort();
    const controller = new AbortController();
    abortDetalhesRef.current = controller;

    const requestId = ++requisicaoDetalhesRef.current;
    const empresaAtual = empresaId;
    const chave = chaveSelecao(selecaoFiltro);
    setCarregandoDetalhes(true);
    setDetalhes(null);
    setErro(null);

    try {
      const json = (await fetchCrmDashboard({
        pessoa: selecaoFiltro.tipo === "pessoa" ? selecaoFiltro.nome : undefined,
        grupoId: selecaoFiltro.tipo === "grupo" ? selecaoFiltro.id : undefined,
        empresaId: empresaAtual,
      })) as DashboardDetalhesData;

      if (requestId !== requisicaoDetalhesRef.current) return;
      if (filtroAtivoRef.current !== chave) return;
      if (empresaIdRef.current !== empresaAtual) return;

      setDetalhes(json);
      setIndicadoresGlobais({
        indicadoresGlobais: json.indicadoresGlobais,
        indicadoresPorClassificacao: json.indicadoresPorClassificacao,
        pessoaFiltrada: json.pessoaFiltrada,
        grupoFiltrado: json.grupoFiltrado ?? null,
      });
    } catch {
      if (controller.signal.aborted) return;
      if (requestId !== requisicaoDetalhesRef.current) return;
      if (filtroAtivoRef.current !== chave) return;
      if (empresaIdRef.current !== empresaAtual) return;

      setErro(
        selecaoFiltro.tipo === "grupo"
          ? "Não foi possível carregar os detalhes do grupo selecionado."
          : "Não foi possível carregar os detalhes do cliente selecionado.",
      );
      setDetalhes(null);
    } finally {
      if (
        requestId === requisicaoDetalhesRef.current &&
        filtroAtivoRef.current === chave &&
        empresaIdRef.current === empresaAtual &&
        abortDetalhesRef.current === controller
      ) {
        setCarregandoDetalhes(false);
      }
    }
  }, [empresaId]);

  useEffect(() => {
    const cachedIndicadores = lerCacheLocal(null);
    const cachedSaude = lerCacheSaudeEmpresa(null);
    if (cachedIndicadores) {
      setIndicadoresGlobais(cachedIndicadores);
      setCarregandoGlobal(false);
    }
    if (cachedSaude) {
      setSaudeQuadroEmpresa(cachedSaude);
      setCarregandoSaudeEmpresa(false);
    }
    setCacheClienteRestaurado(true);
  }, []);

  useEffect(() => {
    if (!cacheClienteRestaurado) return;

    if (guiaPainel === "cliente") {
      abortGlobalRef.current?.abort();
      abortSaudeEmpresaRef.current?.abort();
      requisicaoGlobalRef.current += 1;
      setCarregandoGlobal(false);
      setCarregandoSaudeEmpresa(false);
      if (selecao) {
        carregarDetalhes(selecao);
      } else {
        abortDetalhesRef.current?.abort();
        requisicaoDetalhesRef.current += 1;
        setCarregandoDetalhes(false);
        setDetalhes(null);
        setIndicadoresGlobais(null);
      }
      return;
    }

    abortDetalhesRef.current?.abort();
    requisicaoDetalhesRef.current += 1;
    setCarregandoDetalhes(false);
    setDetalhes(null);

    void carregarGlobal();
    void carregarSaudeEmpresa();
  }, [
    guiaPainel,
    selecao,
    empresaId,
    cacheClienteRestaurado,
    carregarDetalhes,
    carregarGlobal,
    carregarSaudeEmpresa,
  ]);

  const handleAtualizar = () => {
    if (guiaPainel === "cliente" && !selecao) {
      return;
    }
    if (selecao) {
      carregarDetalhes(selecao);
      return;
    }

    void carregarGlobal(true);
    void carregarSaudeEmpresa(true);
  };

  const carregando =
    guiaPainel === "cliente"
      ? selecao
        ? carregandoDetalhes && !detalhes
        : false
      : carregandoGlobal && !indicadoresGlobais;

  const dadosClienteProntos =
    !!selecao &&
    !!detalhes &&
    !!indicadoresGlobais &&
    selecaoSincronizada(selecao, indicadoresGlobais);

  const exibirOverlayCliente =
    guiaPainel === "cliente" &&
    !!selecao &&
    (carregandoDetalhes || !dadosClienteProntos) &&
    !erro;

  const resumoSincronizadoComFiltro =
    !!indicadoresGlobais &&
    (!selecao || dadosClienteProntos) &&
    !carregandoDetalhes;

  const exibirResumo =
    guiaPainel === "cliente"
      ? !!selecao && resumoSincronizadoComFiltro
      : resumoSincronizadoComFiltro && (!carregandoGlobal || !!indicadoresGlobais);

  const classificacoes: IndicadorClassificacao[] =
    aba === "receber"
      ? indicadoresGlobais?.indicadoresPorClassificacao.receber ?? []
      : indicadoresGlobais?.indicadoresPorClassificacao.pagar ?? [];

  const totalGeral: IndicadoresResumo | undefined =
    aba === "receber"
      ? indicadoresGlobais?.indicadoresGlobais.receber
      : indicadoresGlobais?.indicadoresGlobais.pagar;

  const resumoIndicadores = useMemo((): IndicadoresResumo | undefined => {
    if (totalGeral) return totalGeral;
    if (classificacoes.length === 0) return undefined;
    return classificacoes.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        emAtraso: acc.emAtraso + row.emAtraso,
        emDia: acc.emDia + row.emDia,
        recebido30d: acc.recebido30d + row.recebido30d,
        recebido90d: acc.recebido90d + row.recebido90d,
        recebidoAno: acc.recebidoAno + row.recebidoAno,
        recebidoHistorico: acc.recebidoHistorico + row.recebidoHistorico,
      }),
      {
        total: 0,
        emAtraso: 0,
        emDia: 0,
        recebido30d: 0,
        recebido90d: 0,
        recebidoAno: 0,
        recebidoHistorico: 0,
      },
    );
  }, [totalGeral, classificacoes]);

  const contasAtraso =
    aba === "receber"
      ? detalhes?.contasReceberAtraso ?? []
      : detalhes?.contasPagarAtraso ?? [];

  const contasEmDia =
    aba === "receber"
      ? detalhes?.contasReceberEmDia ?? []
      : detalhes?.contasPagarEmDia ?? [];

  const baixados =
    aba === "receber"
      ? detalhes?.recebimentos ?? []
      : detalhes?.pagamentos ?? [];

  const saudeCliente = useMemo(() => {
    if (!dadosClienteProntos || !detalhes || !indicadoresGlobais) return null;

    return calcularSaudeCliente({
      indicadoresReceber: indicadoresGlobais.indicadoresGlobais.receber,
      contasReceberAtraso: detalhes.contasReceberAtraso,
      contasReceberEmDia: detalhes.contasReceberEmDia,
      recebimentos: detalhes.recebimentos,
    });
  }, [dadosClienteProntos, detalhes, indicadoresGlobais]);

  const podeExtrairRelatorio =
    guiaPainel === "cliente" && !!selecao && dadosClienteProntos && !gerandoRelatorio;

  const handleClickCelula = useCallback(
    async (payload: IndicadorDetalheClickPayload) => {
      if (payload.valor <= 0) return;

      setModalDetalhe(payload);
      setModalContas([]);
      setModalRecebimentos([]);
      setModalResumoDetalhe(null);
      setModalRecebimentosRecuperado([]);
      setModalCarregando(true);

      const precisaRecuperado =
        aba === "receber" && payload.coluna === "emAtraso";

      try {
        if (selecao && detalhes) {
          const local = filtrarDetalheLocal(
            detalhes,
            aba,
            payload.coluna,
            payload.classificacao,
          );
          setModalModo(local.modo);
          if (local.modo === "contas") {
            setModalContas(local.dados);
          } else {
            setModalRecebimentos(local.dados);
            setModalResumoDetalhe({
              quantidadeTotal: local.dados.length,
              valorTotal: local.dados.reduce(
                (acc, item) => acc + item.valorRecebido,
                0,
              ),
              quantidadeCarregada: local.dados.length,
              limite: local.dados.length,
            });
          }
          if (precisaRecuperado) {
            setModalRecebimentosRecuperado(
              recebimentosParaRecuperado(
                detalhes,
                aba,
                payload.classificacao,
              ),
            );
          }
          setModalCarregando(false);
          return;
        }

        const [json, jsonReceb] = await Promise.all([
          fetchCrmDetalhe({
            tipo: aba,
            coluna: payload.coluna as ColunaIndicador,
            classificacao: payload.classificacao,
            pessoa: selecao?.tipo === "pessoa" ? selecao.nome : undefined,
            grupoId: selecao?.tipo === "grupo" ? selecao.id : undefined,
            empresaId,
          }),
          precisaRecuperado
            ? fetchCrmDetalhe({
                tipo: aba,
                coluna: "recebidoHistorico",
                classificacao: payload.classificacao,
                pessoa: selecao?.tipo === "pessoa" ? selecao.nome : undefined,
                grupoId: selecao?.tipo === "grupo" ? selecao.id : undefined,
                empresaId,
              })
            : Promise.resolve(null),
        ]);

        setModalModo(json.modo);
        if (json.modo === "contas") {
          setModalContas(json.dados ?? []);
          setModalResumoDetalhe(null);
        } else {
          setModalRecebimentos(json.dados ?? []);
          setModalResumoDetalhe(json.resumo ?? null);
        }

        if (precisaRecuperado && jsonReceb?.modo === "recebimentos") {
          setModalRecebimentosRecuperado(jsonReceb.dados ?? []);
        }
      } catch {
        setErro("Não foi possível carregar o detalhamento dos registros.");
        setModalDetalhe(null);
      } finally {
        setModalCarregando(false);
      }
    },
    [aba, detalhes, selecao, empresaId],
  );

  const fecharModalDetalhe = useCallback(() => {
    setModalDetalhe(null);
    setModalContas([]);
    setModalRecebimentos([]);
    setModalResumoDetalhe(null);
    setModalRecebimentosRecuperado([]);
    setModalCarregando(false);
  }, []);

  const handleTrocarGuia = useCallback(
    (guia: GuiaPainel) => {
      setGuiaPainel(guia);
      fecharModalDetalhe();
      if (guia === "empresa") {
        setSelecao(null);
        setClientePendenciasFiltro(null);
      } else if (guia === "cliente") {
        setAba("receber");
        setClientePendenciasFiltro(null);
      } else if (guia === "inadimplentes") {
        setClientePendenciasFiltro(null);
      }
      const next = new URLSearchParams(searchParams);
      next.set("guia", guia);
      if (guia !== "pendencias") {
        next.delete("cliente");
        next.delete("situacao");
      }
      setSearchParams(next, { replace: true });
    },
    [fecharModalDetalhe, searchParams, setSearchParams],
  );

  const handleExtrairRelatorio = async () => {
    if (!selecao || !detalhes || !dadosClienteProntos) return;

    setGerandoRelatorio(true);
    setErro(null);

    try {
      const saudeCaptura = saudeCliente
        ? await captureSaudeGaugesForPdf("saude-cliente-relatorio")
        : null;

      if (saudeCliente && !saudeCaptura) {
        setErro(
          selecao.tipo === "grupo"
            ? "Não foi possível capturar os indicadores de saúde do grupo para o PDF."
            : "Não foi possível capturar os indicadores de saúde do cliente para o PDF.",
        );
        return;
      }

      await downloadDashboardPdf({
        aba,
        pessoa:
          selecao.tipo === "grupo"
            ? `Grupo: ${selecao.nome}`
            : selecao.nome,
        classificacoes,
        totalGeral,
        contasAtraso,
        contasEmDia,
        baixados: baixadosOrdenadosRef.current ?? baixados,
        saudeCliente: saudeCliente ?? undefined,
        saudeClienteImagem: saudeCaptura?.dataUrl,
        saudeClienteImagemWidth: saudeCaptura?.width,
        saudeClienteImagemHeight: saudeCaptura?.height,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setErro("Não foi possível gerar o relatório em PDF.");
    } finally {
      setGerandoRelatorio(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 dark:text-primary-400">
            Financeiro
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            CRM Financeiro
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Visão consolidada de contas a receber e contas a pagar, com filtro por
            cliente e indicadores de desempenho.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {guiaPainel !== "pendencias" && guiaPainel !== "inadimplentes" && (
            <>
          <button
            type="button"
            onClick={handleExtrairRelatorio}
            disabled={!podeExtrairRelatorio}
            title={
              selecao
                ? "Gerar PDF com todas as tabelas e linhas do painel"
                : "Selecione um cliente ou grupo para extrair o relatório"
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:border-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 13h6" />
                  <path d="M9 17h4" />
                  <path d="M8 11h2.5v5" />
                </svg>
                {gerandoRelatorio ? "Gerando PDF..." : "Extrair relatório"}
              </button>
              <button
                type="button"
                onClick={handleAtualizar}
                disabled={carregando}
                className="btn-primary disabled:opacity-60"
              >
                {carregando ? "Atualizando..." : "Atualizar painel"}
              </button>
            </>
          )}
            </div>
          </div>

      <div className="crm-dashboard-panel space-y-6">
        {(
          (podeVerEmpresa ? 1 : 0) +
          (podeVerCliente ? 1 : 0) +
          (podeVerPendencias ? 2 : 0)
        ) > 1 && (
          <GuiasPainel
            guia={guiaPainel}
            onChange={handleTrocarGuia}
            podeVerEmpresa={podeVerEmpresa}
            podeVerCliente={podeVerCliente}
            podeVerPendencias={podeVerPendencias}
          />
        )}

        {guiaPainel === "inadimplentes" ? (
          podeVerPendencias ? (
            <RegistroInadimplentesPanel />
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
              Você não tem permissão para a guia Registro de Inadimplentes.
            </div>
          )
        ) : guiaPainel === "pendencias" ? (
          podeVerPendencias ? (
            <PendenciasCreditoPanel
              podeEditarDestinatarios={podeEditarDestinatariosPendencias}
              clienteInicial={clientePendenciasFiltro}
              situacaoInicial={situacaoPendenciasInicial}
            />
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
              Você não tem permissão para a guia Pendências de crédito com PD em carteira.
            </div>
          )
        ) : (
          <>
        <section className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div
            className={`grid gap-4 ${
              guiaPainel === "cliente" ? "lg:grid-cols-2" : "lg:grid-cols-1"
            }`}
          >
            <FiltroEmpresa
              empresaSelecionada={empresaId}
              onSelect={(id, nome) => {
                setEmpresaId(id);
                setEmpresaNome(nome);
              }}
            />
            {guiaPainel === "cliente" && (
              <FiltroPessoa
                selecao={selecao}
                empresaId={empresaId}
                onSelect={setSelecao}
              />
            )}
          </div>
          {(empresaNome || (guiaPainel === "cliente" && selecao)) && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <strong>Filtro ativo:</strong>
              {empresaNome && (
                <>
                  {" "}
                  empresa <span className="font-semibold">{empresaNome}</span>
                </>
              )}
              {empresaNome && guiaPainel === "cliente" && selecao && " · "}
              {guiaPainel === "cliente" && selecao && (
                <>
                  {selecao.tipo === "grupo" ? "grupo" : "pessoa"}{" "}
                  <span className="font-semibold">{selecao.nome}</span>
                </>
              )}
            </div>
          )}
        </section>

        {exibirOverlayCliente && (
          <LoadingOverlay
            mensagem={
              selecao?.tipo === "grupo"
                ? "Carregando dados do grupo"
                : "Carregando dados do cliente"
            }
            subtitulo={labelSelecao(selecao)}
          />
        )}

        {gerandoRelatorio && (
          <PdfGeneratingOverlay
            mensagem="Gerando relatório em PDF..."
            subtitulo={labelSelecao(selecao) ?? undefined}
          />
        )}

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
            {erro}
          </div>
        )}

        {guiaPainel === "cliente" && !selecao ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-600 dark:bg-slate-900">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Selecione um cliente ou grupo econômico para iniciar a análise
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Esta guia mostra dados do cliente ou do grupo filtrado: saúde,
              indicadores, pendências, recebimentos e relatório em PDF. Na
              pesquisa, grupos econômicos aparecem no topo quando houver vínculo
              no Nomus.
            </p>
          </div>
        ) : carregandoGlobal && !indicadoresGlobais && guiaPainel === "empresa" ? (
          <ResumoSkeleton />
        ) : exibirResumo ? (
          <>
            {carregandoGlobal && guiaPainel === "empresa" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
                Atualizando indicadores em segundo plano...
              </div>
            )}

            <AbasResumo aba={aba} onChange={setAba} />

            {guiaPainel === "cliente" &&
              selecao &&
              aba === "receber" &&
              saudeCliente &&
              !exibirOverlayCliente && (
                <SaudeClienteGauges
                  saude={saudeCliente}
                  exportId="saude-cliente-relatorio"
                  variant={selecao.tipo === "grupo" ? "grupo" : "cliente"}
                />
              )}

            {guiaPainel === "empresa" &&
              aba === "receber" &&
              carregandoSaudeEmpresa &&
              !saudeQuadroEmpresa && <SaudeEmpresaSkeleton />}

            {guiaPainel === "empresa" && aba === "receber" && saudeQuadroEmpresa && (
              <SaudeClienteGauges
                saude={saudeQuadroEmpresa}
                exportId="saude-empresa-quadro-receber"
                variant="empresa"
              />
            )}

            {guiaPainel === "cliente" &&
              selecao?.tipo === "grupo" &&
              detalhes?.grupoFiltrado &&
              !exibirOverlayCliente && (
                <MembrosGrupoPanel
                  grupo={detalhes.grupoFiltrado}
                  onSelecionarPessoa={(nome) =>
                    setSelecao({ tipo: "pessoa", nome })
                  }
                />
              )}

            <TabelaIndicadores
              dados={classificacoes}
              tipo={aba}
              totalGeral={totalGeral}
              onClickCelula={handleClickCelula}
            />

            <ModalDetalheIndicador
              aberto={!!modalDetalhe}
              onFechar={fecharModalDetalhe}
              titulo={
                modalDetalhe
                  ? tituloModalDetalhe(aba, modalDetalhe.coluna)
                  : ""
              }
              subtitulo={
                modalDetalhe
                  ? modalDetalhe.nomeClassificacao === "Total"
                    ? "Todas as classificações"
                    : modalDetalhe.nomeClassificacao
                  : undefined
              }
              coluna={modalDetalhe?.coluna ?? "total"}
              tipo={aba}
              modo={modalModo}
              dadosContas={modalContas}
              dadosRecebimentos={modalRecebimentos}
              resumoDetalhe={modalResumoDetalhe}
              recebimentosRecuperado={modalRecebimentosRecuperado}
              carregando={modalCarregando}
            />

            {guiaPainel === "cliente" && selecao && detalhes && (
              <div className="crm-dashboard-detail-grid">
                <TabelaContas
                  titulo={
                    aba === "receber"
                      ? "Contas a receber em atraso"
                      : "Contas a pagar em atraso"
                  }
                  valorSecao={resumoIndicadores?.emAtraso ?? 0}
                  subtitulo="Agendamentos com vencimento anterior à data de hoje"
                  dados={contasAtraso}
                  destaque="danger"
                />
                <TabelaContas
                  titulo={
                    aba === "receber"
                      ? "Contas a vencer"
                      : "Contas a pagar a vencer"
                  }
                  valorSecao={resumoIndicadores?.emDia ?? 0}
                  subtitulo="Agendamentos dentro do prazo ou sem vencimento definido"
                  dados={contasEmDia}
                  destaque="success"
                />
                <TabelaBaixados
                  titulo={
                    aba === "receber"
                      ? "Recebimentos"
                      : "Pagamentos realizados"
                  }
                  valorSecao={resumoIndicadores?.recebidoHistorico ?? 0}
                  tipo={aba}
                  dados={baixados}
                  sortedDataRef={baixadosOrdenadosRef}
                />
              </div>
            )}
          </>
        ) : !carregando && !erro ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Não foi possível exibir os indicadores.
            </p>
            <button
              type="button"
              onClick={handleAtualizar}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}
          </>
        )}
      </div>
    </div>
  );
}
