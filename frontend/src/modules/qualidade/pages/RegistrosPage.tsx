import { Suspense, useMemo, useState } from "react";
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { AvaliacaoFornecedorForm } from "@qualidade/components/avaliacao-fornecedor/avaliacao-fornecedor-form";
import { Button } from "@qualidade/components/ui/button";
import { RccForm } from "@qualidade/components/registros/rcc-form";
import { RncForm } from "@qualidade/components/registros/rnc-form";
import { RegistroTipoSeletor } from "@qualidade/components/registros/registro-tipo-seletor";
import {
  type ModuloRegistroTipo,
} from "@qualidade/lib/registros/constants";
import { validarRcc } from "@qualidade/lib/registros/validacao-rcc";
import { validarRnc } from "@qualidade/lib/registros/validacao-rnc";
import { useRegistrosStore } from "@qualidade/lib/store/registros-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { persistQualidadeRegistro } from "@qualidade/lib/qualidadePersistence";
import { criarRccDadosVazio } from "@qualidade/types/rcc";
import {
  criarRncDadosVazio,
  normalizarRncDados,
  sincronizarAcoesApartadasLegado,
} from "@qualidade/types/rnc";

function consultaHref(tipo: ModuloRegistroTipo | null): string {
  if (!tipo) return "/qualidade/registros/consulta";
  return `/qualidade/registros/consulta?tipo=${tipo}`;
}

function RegistrosPageContent() {
  const navigate = useNavigate();
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const getCurrentUser = useConfigStore((s) => s.getCurrentUser);
  const registros = useRegistrosStore((s) => s.registros);
  const criarRegistro = useRegistrosStore((s) => s.criarRegistro);
  const getRegistroById = useRegistrosStore((s) => s.getRegistroById);

  const [tipoSelecionado, setTipoSelecionado] =
    useState<ModuloRegistroTipo | null>(null);
  const [rncDados, setRncDados] = useState(criarRncDadosVazio());
  const [rccDados, setRccDados] = useState(criarRccDadosVazio());
  const [errosRnc, setErrosRnc] = useState<
    Partial<Record<keyof typeof rncDados, string>>
  >({});
  const [errosRcc, setErrosRcc] = useState<
    Partial<Record<keyof typeof rccDados, string>>
  >({});
  const [error, setError] = useState("");
  const [salvando, setSalvando] = useState(false);

  const usuarioAtual = getCurrentUser();

  const proximoNumeroRnc = useMemo(() => {
    const prefixo = "RNC-";
    let maiorSequencia = 0;
    for (const registro of registros) {
      if (registro.tipo !== "rnc" || registro.origemNomus) continue;
      if (!registro.numero.startsWith(prefixo)) continue;
      const sequencia = Number.parseInt(registro.numero.slice(prefixo.length), 10);
      if (!Number.isNaN(sequencia)) maiorSequencia = Math.max(maiorSequencia, sequencia);
    }
    return `${prefixo}${String(maiorSequencia + 1).padStart(4, "0")}`;
  }, [registros]);

  const proximoNumeroRcc = useMemo(() => {
    const prefixo = "RCC-";
    let maiorSequencia = 0;
    for (const registro of registros) {
      if (registro.tipo !== "rcc" || registro.origemNomus) continue;
      if (!registro.numero.startsWith(prefixo)) continue;
      const sequencia = Number.parseInt(registro.numero.slice(prefixo.length), 10);
      if (!Number.isNaN(sequencia)) maiorSequencia = Math.max(maiorSequencia, sequencia);
    }
    return `${prefixo}${String(maiorSequencia + 1).padStart(4, "0")}`;
  }, [registros]);

  function reiniciar() {
    setTipoSelecionado(null);
    setRncDados(criarRncDadosVazio());
    setRccDados(criarRccDadosVazio());
    setErrosRnc({});
    setErrosRcc({});
    setError("");
  }

  function handleTipoChange(tipo: ModuloRegistroTipo) {
    setTipoSelecionado(tipo);
    setError("");
    setErrosRnc({});
    setErrosRcc({});
    if (tipo === "rnc") {
      setRncDados({
        ...criarRncDadosVazio(),
        responsavel: usuarioAtual?.nome ?? "",
      });
    }
    if (tipo === "rcc") {
      setRccDados(criarRccDadosVazio());
    }
  }

  async function handleSalvar() {
    if (!tipoSelecionado || tipoSelecionado === "avaliacao-fornecedor") {
      setError("Selecione o tipo de registro.");
      return;
    }

    if (tipoSelecionado === "rnc") {
      const validacao = validarRnc(rncDados);
      if (!validacao.valido) {
        setErrosRnc(validacao.erros);
        setError("Corrija os campos obrigatórios antes de salvar.");
        return;
      }

      const id = criarRegistro({
        tipo: "rnc",
        responsavelId: currentUserId,
        rnc: sincronizarAcoesApartadasLegado(
          normalizarRncDados({
            ...rncDados,
            usuarioCriacao: usuarioAtual?.nome ?? "",
          })
        ),
      });
      const registro = getRegistroById(id);
      if (!registro) {
        setError("Não foi possível preparar o registro para salvar.");
        return;
      }

      setSalvando(true);
      setError("");
      try {
        await persistQualidadeRegistro(registro);
        navigate(consultaHref("rnc"));
      } catch (err) {
        useRegistrosStore.setState((state) => ({
          registros: state.registros.filter((item) => item.id !== id),
        }));
        setError(
          err instanceof Error
            ? err.message
            : "Falha ao salvar o RNC no servidor. Tente novamente."
        );
      } finally {
        setSalvando(false);
      }
      return;
    }

    const validacao = validarRcc(rccDados);
    if (!validacao.valido) {
      setErrosRcc(validacao.erros);
      setError("Corrija os campos obrigatórios antes de salvar.");
      return;
    }

    const id = criarRegistro({
      tipo: "rcc",
      responsavelId: currentUserId,
      rcc: {
        ...rccDados,
        usuarioCriacao: usuarioAtual?.nome ?? "",
      },
    });
    const registro = getRegistroById(id);
    if (!registro) {
      setError("Não foi possível preparar o registro para salvar.");
      return;
    }

    setSalvando(true);
    setError("");
    try {
      await persistQualidadeRegistro(registro);
      navigate(consultaHref("rcc"));
    } catch (err) {
      useRegistrosStore.setState((state) => ({
        registros: state.registros.filter((item) => item.id !== id),
      }));
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao salvar o RCC no servidor. Tente novamente."
      );
    } finally {
      setSalvando(false);
    }
  }

  const isAvaliacao = tipoSelecionado === "avaliacao-fornecedor";
  const isRegistroRncRcc =
    tipoSelecionado === "rnc" || tipoSelecionado === "rcc";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo registro</h1>
          <p className="text-sm text-muted-foreground">
            {tipoSelecionado
              ? "Preencha os dados do registro selecionado"
              : "Selecione o tipo de registro para exibir o formulário"}
          </p>
        </div>
        <Link to={consultaHref(tipoSelecionado)}>
          <Button variant="outline" type="button">
            Consultar registros
          </Button>
        </Link>
      </div>

      <div className="sgq-table-surface space-y-6 overflow-visible rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-foreground/6">
        <fieldset className="brand-fieldset space-y-3">
          <legend>Tipo de registro</legend>
          <RegistroTipoSeletor
            value={tipoSelecionado}
            onChange={handleTipoChange}
          />
        </fieldset>

        {!tipoSelecionado ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Escolha RNC, RCC ou Avaliação de fornecedor no campo acima para
            continuar.
          </p>
        ) : null}

        {tipoSelecionado === "rnc" ? (
          <RncForm
            dados={rncDados}
            onChange={setRncDados}
            erros={errosRnc}
            codigoDocumentoPreview={proximoNumeroRnc}
            usuarioCriacaoNome={usuarioAtual?.nome ?? ""}
          />
        ) : null}

        {tipoSelecionado === "rcc" ? (
          <RccForm
            dados={rccDados}
            onChange={setRccDados}
            erros={errosRcc}
            codigoDocumentoPreview={proximoNumeroRcc}
            usuarioCriacaoNome={usuarioAtual?.nome ?? ""}
          />
        ) : null}

        {isAvaliacao ? (
          <AvaliacaoFornecedorForm
            onSuccess={() => navigate(consultaHref("avaliacao-fornecedor"))}
          />
        ) : null}

        {error && isRegistroRncRcc ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {isRegistroRncRcc ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={reiniciar} disabled={salvando}>
              Trocar tipo
            </Button>
            <Button type="button" onClick={() => void handleSalvar()} disabled={salvando}>
              {salvando
                ? "Salvando..."
                : tipoSelecionado === "rnc"
                  ? "Salvar RNC"
                  : "Salvar RCC"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RegistrosPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Carregando...</p>
      }
    >
      <RegistrosPageContent />
    </Suspense>
  );
}
