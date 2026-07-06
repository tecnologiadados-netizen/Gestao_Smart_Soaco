import { Suspense, useEffect, useMemo, useState } from "react";
import { Link } from 'react-router-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AvaliacaoFornecedorForm } from "@qualidade/components/avaliacao-fornecedor/avaliacao-fornecedor-form";
import { Button } from "@qualidade/components/ui/button";
import { RccForm } from "@qualidade/components/registros/rcc-form";
import { RncForm } from "@qualidade/components/registros/rnc-form";
import { RegistroTipoSeletor } from "@qualidade/components/registros/registro-tipo-seletor";
import {
  isModuloRegistroTipo,
  type ModuloRegistroTipo,
} from "@qualidade/lib/registros/constants";
import { validarRcc } from "@qualidade/lib/registros/validacao-rcc";
import { validarRnc } from "@qualidade/lib/registros/validacao-rnc";
import { useRegistrosStore } from "@qualidade/lib/store/registros-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { criarRccDadosVazio } from "@qualidade/types/rcc";
import { criarRncDadosVazio } from "@qualidade/types/rnc";

function consultaHref(tipo: ModuloRegistroTipo | null): string {
  if (!tipo) return "/qualidade/registros/consulta";
  return `/qualidade/registros/consulta?tipo=${tipo}`;
}

function RegistrosPageContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const getCurrentUser = useConfigStore((s) => s.getCurrentUser);
  const registros = useRegistrosStore((s) => s.registros);
  const criarRegistro = useRegistrosStore((s) => s.criarRegistro);

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

  const usuarioAtual = getCurrentUser();

  const proximoNumeroRnc = useMemo(() => {
    const sequencia =
      registros.filter((r) => r.tipo === "rnc" && !r.origemNomus).length + 1;
    return `RNC-${String(sequencia).padStart(4, "0")}`;
  }, [registros]);

  const proximoNumeroRcc = useMemo(() => {
    const sequencia =
      registros.filter((r) => r.tipo === "rcc" && !r.origemNomus).length + 1;
    return `RCC-${String(sequencia).padStart(4, "0")}`;
  }, [registros]);

  useEffect(() => {
    const tipoParam = searchParams.get("tipo");
    if (isModuloRegistroTipo(tipoParam)) {
      setTipoSelecionado(tipoParam);
      if (tipoParam === "rnc") {
        setRncDados({
          ...criarRncDadosVazio(),
          responsavel: usuarioAtual?.nome ?? "",
        });
      }
      if (tipoParam === "rcc") {
        setRccDados(criarRccDadosVazio());
      }
    }
  }, [searchParams, usuarioAtual?.nome]);

  function reiniciar() {
    setTipoSelecionado(null);
    setRncDados(criarRncDadosVazio());
    setRccDados(criarRccDadosVazio());
    setErrosRnc({});
    setErrosRcc({});
    setError("");
    navigate("/qualidade/registros");
  }

  function handleTipoChange(tipo: ModuloRegistroTipo) {
    setTipoSelecionado(tipo);
    setError("");
    setErrosRnc({});
    setErrosRcc({});
    navigate(`/qualidade/registros?tipo=${tipo}`);
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

  function handleSalvar() {
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

      criarRegistro({
        tipo: "rnc",
        responsavelId: currentUserId,
        rnc: {
          ...rncDados,
          usuarioCriacao: usuarioAtual?.nome ?? "",
        },
      });
      navigate(consultaHref("rnc"));
      return;
    }

    const validacao = validarRcc(rccDados);
    if (!validacao.valido) {
      setErrosRcc(validacao.erros);
      setError("Corrija os campos obrigatórios antes de salvar.");
      return;
    }

    criarRegistro({
      tipo: "rcc",
      responsavelId: currentUserId,
      rcc: {
        ...rccDados,
        usuarioCriacao: usuarioAtual?.nome ?? "",
      },
    });
    navigate(consultaHref("rcc"));
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
            Selecione o tipo e preencha os dados do registro
          </p>
        </div>
        <Link to={consultaHref(tipoSelecionado)}>
          <Button variant="outline" type="button">
            Consultar registros
          </Button>
        </Link>
      </div>

      <div className="sgq-table-surface space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-foreground/6">
        <fieldset className="brand-fieldset space-y-4">
          <legend>Tipo de registro</legend>
          <RegistroTipoSeletor
            value={tipoSelecionado}
            onChange={handleTipoChange}
          />
        </fieldset>

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
            <Button type="button" variant="outline" onClick={reiniciar}>
              Limpar
            </Button>
            <Button type="button" onClick={handleSalvar}>
              {tipoSelecionado === "rnc" ? "Salvar RNC" : "Salvar RCC"}
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
