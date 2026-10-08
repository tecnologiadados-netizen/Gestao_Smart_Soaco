import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import {
  buscarSetorProducaoProduto,
  classificacaoCatalogoProduto,
  listarReclamacoesProduto,
  type ReclamacaoProdutoCadastro,
} from "@qualidade/lib/api/qualidadeApi";

const OPCAO_SELECIONE = "Selecione...";

interface CatalogoSetorTextos {
  doSetor: (setores: string) => string;
  doTipo: (tipos: string) => string;
  buscando: string;
  erro: string;
  semSetor: string;
  semProdutoAntes: string;
  linkTo: string;
}

const TEXTOS_RECLAMACAO: CatalogoSetorTextos = {
  doSetor: (setores) => `Reclamações do setor ${setores}.`,
  doTipo: (tipos) => `Reclamações do tipo de produto ${tipos}.`,
  buscando: "Consultando o setor ou o tipo de produto...",
  erro: "Não foi possível consultar o setor ou o tipo de produto deste item.",
  semSetor:
    "O produto não tem setor de produção nem tipo de produto no ERP, então não há reclamações para selecionar.",
  semProdutoAntes: "Informe o produto para listar as reclamações do setor ou do tipo. O cadastro fica em",
  linkTo: "/qualidade/configuracoes/reclamacoes",
};

export const TEXTOS_CAUSA_PROBLEMA: CatalogoSetorTextos = {
  doSetor: (setores) => `Causas do setor ${setores}.`,
  doTipo: (tipos) => `Causas do tipo de produto ${tipos}.`,
  buscando: "Consultando o setor ou o tipo de produto...",
  erro: "Não foi possível consultar o setor ou o tipo de produto deste item.",
  semSetor:
    "O produto não tem setor de produção nem tipo de produto no ERP, então não há causas para selecionar.",
  semProdutoAntes: "Informe o produto para listar as causas do setor ou do tipo. O cadastro fica em",
  linkTo: "/qualidade/configuracoes/causas-problema",
};

export const TEXTOS_SERVICO_REALIZADO: CatalogoSetorTextos = {
  doSetor: (setores) => `Serviços do setor ${setores}.`,
  doTipo: (tipos) => `Serviços do tipo de produto ${tipos}.`,
  buscando: "Consultando o setor ou o tipo de produto...",
  erro: "Não foi possível consultar o setor ou o tipo de produto deste item.",
  semSetor:
    "O produto não tem setor de produção nem tipo de produto no ERP, então não há serviços para selecionar.",
  semProdutoAntes: "Informe o produto para listar os serviços cadastrados do setor ou do tipo. O cadastro fica em",
  linkTo: "/qualidade/configuracoes/servicos-realizados",
};

function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\s+/g, "").toUpperCase();
}

interface RccReclamacaoCatalogoSelectProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  codigosProduto: string[];
  disabled?: boolean;
  ocultarRotulo?: boolean;
  ocultarAjuda?: boolean;
  carregarCatalogo?: () => Promise<ReclamacaoProdutoCadastro[]>;
  textos?: CatalogoSetorTextos;
}

export function RccReclamacaoCatalogoSelect({
  id,
  label,
  value,
  onChange,
  codigosProduto,
  disabled = false,
  ocultarRotulo = false,
  ocultarAjuda = false,
  carregarCatalogo = listarReclamacoesProduto,
  textos = TEXTOS_RECLAMACAO,
}: RccReclamacaoCatalogoSelectProps) {
  const [catalogo, setCatalogo] = useState<ReclamacaoProdutoCadastro[]>([]);
  const [classificacoes, setClassificacoes] = useState<
    { valor: string; origem: "setor" | "tipo" }[]
  >([]);
  const [erroSetor, setErroSetor] = useState(false);
  const [buscandoSetor, setBuscandoSetor] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const codigosChave = useMemo(
    () => [...new Set(codigosProduto.map((codigo) => codigo.trim()).filter(Boolean))].sort().join("|"),
    [codigosProduto]
  );

  useEffect(() => {
    let ativo = true;
    carregarCatalogo()
      .then((lista) => {
        if (ativo) setCatalogo(lista);
      })
      .catch(() => {
        if (ativo) setCatalogo([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [carregarCatalogo]);

  useEffect(() => {
    const codigos = codigosChave ? codigosChave.split("|") : [];
    if (codigos.length === 0) {
      setClassificacoes([]);
      setErroSetor(false);
      setBuscandoSetor(false);
      return;
    }
    let ativo = true;
    setErroSetor(false);
    setBuscandoSetor(true);
    Promise.all(
      codigos.map(async (codigo) => {
        const produtos = await buscarSetorProducaoProduto(codigo);
        const alvo = normalizarCodigo(codigo);
        const exato =
          produtos.find((item) => normalizarCodigo(item.codigo) === alvo) ?? produtos[0];
        return classificacaoCatalogoProduto(exato);
      })
    )
      .then((encontrados) => {
        if (!ativo) return;
        const unicos = new Map<string, { valor: string; origem: "setor" | "tipo" }>();
        for (const item of encontrados) {
          if (!item.valor || item.origem === "") continue;
          unicos.set(item.valor.toLowerCase(), { valor: item.valor, origem: item.origem });
        }
        setClassificacoes([...unicos.values()]);
      })
      .catch(() => {
        if (!ativo) return;
        setClassificacoes([]);
        setErroSetor(true);
      })
      .finally(() => {
        if (ativo) setBuscandoSetor(false);
      });
    return () => {
      ativo = false;
    };
  }, [codigosChave]);

  const doSetor = useMemo(() => {
    if (classificacoes.length === 0) return [];
    const chaves = new Set(classificacoes.map((item) => item.valor.toLowerCase()));
    return catalogo.filter((item) => chaves.has(item.setorProducao.toLowerCase()));
  }, [catalogo, classificacoes]);

  const opcoes = useMemo(() => {
    const nomes = doSetor.map((item) => item.descricao);
    if (value.trim() && !nomes.some((nome) => nome.toLowerCase() === value.trim().toLowerCase())) {
      return [value.trim(), ...nomes];
    }
    return nomes;
  }, [doSetor, value]);

  const variosSetores = classificacoes.length > 1;
  const ajudaClassificacao = useMemo(() => {
    const setores = classificacoes.filter((item) => item.origem === "setor").map((item) => item.valor);
    const tipos = classificacoes.filter((item) => item.origem === "tipo").map((item) => item.valor);
    return [
      setores.length > 0 ? textos.doSetor(setores.join(", ")) : "",
      tipos.length > 0 ? textos.doTipo(tipos.join(", ")) : "",
    ]
      .filter(Boolean)
      .join(" ");
  }, [classificacoes, textos]);

  return (
    <div className="space-y-2">
      {ocultarRotulo || !label ? null : <Label htmlFor={id}>{label}</Label>}
      <Select
        value={value || undefined}
        onValueChange={(escolha) => onChange(!escolha || escolha === OPCAO_SELECIONE ? "" : escolha)}
        disabled={disabled || carregando}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={carregando ? "Carregando..." : OPCAO_SELECIONE} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={OPCAO_SELECIONE}>{OPCAO_SELECIONE}</SelectItem>
          {opcoes.map((opcao) => {
            const cadastro = doSetor.find(
              (item) => item.descricao.toLowerCase() === opcao.toLowerCase()
            );
            const rotulo =
              variosSetores && cadastro ? `${opcao} — ${cadastro.setorProducao}` : opcao;
            return (
              <SelectItem key={opcao} value={opcao}>
                {rotulo}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {ocultarAjuda ? null : codigosChave && classificacoes.length > 0 ? (
        <p className="text-xs text-muted-foreground">{ajudaClassificacao}</p>
      ) : codigosChave && buscandoSetor ? (
        <p className="text-xs text-muted-foreground">{textos.buscando}</p>
      ) : codigosChave && erroSetor ? (
        <p className="text-xs text-muted-foreground">{textos.erro}</p>
      ) : codigosChave && !carregando ? (
        <p className="text-xs text-muted-foreground">{textos.semSetor}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {textos.semProdutoAntes}{" "}
          <Link to={textos.linkTo} className="underline">
            Configurações
          </Link>
          .
        </p>
      )}
    </div>
  );
}
