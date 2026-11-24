import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import {
  fetchDoubleCheckInComparativoPc,
  listarCondicoesPagamento,
  listarFormasPagamento,
  salvarPagamentoXmlPreEntrada,
  type DoubleCheckInComparativoLinha,
  type OpcaoNomus,
} from '../../api/compras';
import { gerarParcelasDaRegra } from '../../utils/regraParcelasNomus';

const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';
const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 w-full';

const nfBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type ParcelaDraft = { dataVencimento: string; valor: string; paga: boolean | null };

type Props = {
  idDocumento: number;
  linhas: DoubleCheckInComparativoLinha[];
  somenteLeitura?: boolean;
  evidencia?: boolean;
  /** Aberto pelo botão Editar: entra direto no formulário e fecha ao gravar ou cancelar. */
  editarAoAbrir?: boolean;
  onFechar?: () => void;
  onLinhasChange?: (linhas: DoubleCheckInComparativoLinha[]) => void;
};

function fmtYmdBr(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(ymd);
}

function parseValor(texto: string): number | null {
  const s = texto.trim();
  if (!s) return null;
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Máscara de real: os dígitos entram pelos centavos (23000 → 230,00). */
function mascaraMoeda(texto: string): string {
  const digitos = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digitos) return '';
  const n = Number(digitos) / 100;
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatValor(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parcelaVazia(): ParcelaDraft {
  return { dataVencimento: '', valor: '', paga: null };
}

/** Só dígitos e vírgula. A vírgula separa os dias, como 30,60,90. */
function mascaraRegra(texto: string): string {
  return texto.replace(/[^\d,]/g, '').replace(/,{2,}/g, ',').replace(/^,/, '');
}

/** A regra do Nomus vira a lista de dias. "0 50%,15 50%" fica "0,15". */
function regraNomusParaCampo(regra: string | null | undefined): string {
  const dias = String(regra ?? '')
    .split(/[,;/]+/)
    .map((parte) => parte.trim().match(/^(\d+)/)?.[1])
    .filter((dia): dia is string => Boolean(dia));
  return dias.join(',');
}

export default function PagamentoXmlPreEntradaPanel({
  idDocumento,
  linhas,
  somenteLeitura = false,
  evidencia = false,
  editarAoAbrir = false,
  onFechar,
  onLinhasChange,
}: Props) {
  const linha = useMemo(
    () => linhas.find((l) => l.origemParcelasNF && l.origemParcelasNF !== 'nomus') ?? null,
    [linhas]
  );
  const [editando, setEditando] = useState(false);
  const [escolha, setEscolha] = useState<'ja_paga' | 'boleto_externo' | null>(null);
  const [condicao, setCondicao] = useState('');
  const [forma, setForma] = useState('');
  const [regra, setRegra] = useState('');
  const [dataBase, setDataBase] = useState('');
  const [diasPermitidos, setDiasPermitidos] = useState<number[] | null>(null);
  const gerarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (gerarTimerRef.current) clearTimeout(gerarTimerRef.current);
    },
    []
  );
  const regraRef = useRef(regra);
  regraRef.current = regra;
  const dataBaseRef = useRef(dataBase);
  dataBaseRef.current = dataBase;
  const [condicoes, setCondicoes] = useState<OpcaoNomus[]>([]);
  const [formas, setFormas] = useState<OpcaoNomus[]>([]);
  const [carregandoListas, setCarregandoListas] = useState(false);
  const [parcelas, setParcelas] = useState<ParcelaDraft[]>([parcelaVazia()]);
  const parcelasRef = useRef(parcelas);
  parcelasRef.current = parcelas;
  const [erro, setErro] = useState<string | null>(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);

  useEffect(() => {
    setParcelas((atual) => {
      let mudou = false;
      const proximo = atual.map((p) => {
        if (!p.valor || p.valor.includes(',')) return p;
        const n = parseValor(p.valor);
        if (n == null) return p;
        mudou = true;
        return { ...p, valor: formatValor(n) };
      });
      return mudou ? proximo : atual;
    });
  }, []);
  const [salvando, setSalvando] = useState(false);

  const pedidos = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; condicao: string | null; regra: string | null; prazos: string | null }
    >();
    for (const l of linhas) {
      const key = String(l.idPedidoCompra ?? l.nomePedidoCompra ?? 'pedido');
      if (map.has(key)) continue;
      map.set(key, {
        nome: l.nomePedidoCompra ?? (l.idPedidoCompra != null ? `PC ${l.idPedidoCompra}` : 'Pedido'),
        condicao: l.condicaoPagamentoPC,
        regra: l.regraPagamentoPC,
        prazos: l.prazosLabelPC ?? null,
      });
    }
    return [...map.values()];
  }, [linhas]);

  const origem = linha?.origemParcelasNF;
  const podeEditar = !somenteLeitura && !evidencia;
  const mostrarFormulario =
    podeEditar && linha != null && (editando || origem === 'pendente' || origem === 'sem_xml');

  const preencherBoleto = (base: DoubleCheckInComparativoLinha) => {
    const nomeCondicao =
      base.condicaoPagamentoNF && base.condicaoPagamentoNF !== 'Boleto informado'
        ? base.condicaoPagamentoNF
        : '';
    setCondicao(nomeCondicao);
    setForma(base.formaPagamentoNF ?? '');
    setRegra(regraNomusParaCampo(base.regraPagamentoNF ?? ''));
    setDataBase((base.dataBaseParcelasNF ?? '').slice(0, 10));
    if (base.parcelasNF?.length) {
      setParcelas(
        base.parcelasNF.map((p) => ({
          dataVencimento: p.dataVencimento ?? '',
          valor: p.valor == null ? '' : formatValor(p.valor),
          paga: p.paga === true ? true : p.paga === false ? false : null,
        }))
      );
    } else {
      setParcelas([parcelaVazia()]);
    }
  };

  useEffect(() => {
    if (!editarAoAbrir) return;
    setEditando(true);
    if (origem === 'ja_paga') setEscolha('ja_paga');
  }, [editarAoAbrir, idDocumento, origem]);

  useEffect(() => {
    if (!linha || !mostrarFormulario || escolha != null) return;
    const temRascunho =
      Boolean(linha.formaPagamentoNF) ||
      (linha.parcelasNF?.length ?? 0) > 0 ||
      (origem === 'boleto_externo' && Boolean(linha.condicaoPagamentoNF));
    if (origem === 'boleto_externo' || (origem === 'pendente' && temRascunho)) {
      setEscolha('boleto_externo');
      preencherBoleto(linha);
    }
  }, [idDocumento, origem, mostrarFormulario, escolha, linha]);

  useEffect(() => {
    if (escolha !== 'boleto_externo') return;
    let cancelado = false;
    setCarregandoListas(true);
    void Promise.all([listarCondicoesPagamento(), listarFormasPagamento()]).then(([c, f]) => {
      if (cancelado) return;
      setCondicoes(c.data);
      setFormas(f.data);
      setCarregandoListas(false);
      if (c.error || f.error) setErro(c.error || f.error || 'Não foi possível carregar condição e forma.');
    });
    return () => {
      cancelado = true;
    };
  }, [escolha]);

  useEffect(() => {
    if (!linha || !condicao || condicoes.length === 0) return;
    const op = condicoes.find((c) => c.nome === condicao);
    if (!op) return;
    setDiasPermitidos(op.diasPermitidos ?? null);
    const regraCampo = regraNomusParaCampo(op.regra);
    if (regraRef.current.trim() || !regraCampo) return;
    setRegra(regraCampo);
    const vazias = parcelasRef.current.every((p) => !p.dataVencimento && !parseValor(p.valor));
    if (!vazias) return;
    const baseData = (dataBaseRef.current || linha.dataBaseParcelasNF || '').slice(0, 10);
    const total = linha.valorNfXml;
    if (total == null || !Number.isFinite(total)) return;
    const gerado = gerarParcelasDaRegra({
      regra: regraCampo,
      dataBase: baseData,
      valorTotal: total,
      diasPermitidos: op.diasPermitidos,
    });
    if ('erro' in gerado) return;
    setParcelas(
      gerado.parcelas.map((p) => ({
        dataVencimento: p.dataVencimento,
        valor: formatValor(p.valor),
        paga: p.paga,
      }))
    );
  }, [condicao, condicoes, linha]);

  useEffect(() => {
    if (!condicao || condicoes.length === 0 || formas.length === 0) return;
    const op = condicoes.find((c) => c.nome === condicao);
    if (!op || op.idsFormaPagamento == null) return;
    const permitidas = formas.filter((f) => op.idsFormaPagamento?.includes(f.id));
    setForma((atual) => {
      if (atual && permitidas.some((f) => f.nome === atual)) return atual;
      return permitidas.length === 1 ? (permitidas[0]?.nome ?? '') : '';
    });
  }, [condicao, condicoes, formas]);

  const documentoRef = useRef(idDocumento);
  useEffect(() => {
    const base = (linha?.dataBaseParcelasNF ?? '').slice(0, 10);
    if (documentoRef.current !== idDocumento) {
      documentoRef.current = idDocumento;
      setDataBase(base);
      return;
    }
    setDataBase((atual) => atual || base);
  }, [idDocumento, linha?.dataBaseParcelasNF]);

  if (!linha || !origem) return null;

  const gerarParcelas = (texto: string, dias: number[] | null, baseInformada = dataBase) => {
    const baseData = baseInformada.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(baseData)) {
      setErro('Informe a data base para calcular o vencimento.');
      return;
    }
    const total = linha.valorNfXml;
    if (total == null || !Number.isFinite(total)) {
      setErro('Sem total da nota para gerar as parcelas.');
      return;
    }
    const gerado = gerarParcelasDaRegra({
      regra: texto,
      dataBase: baseData,
      valorTotal: total,
      diasPermitidos: dias,
    });
    if ('erro' in gerado) {
      setErro(gerado.erro);
      return;
    }
    setErro(null);
    setParcelas(
      gerado.parcelas.map((p) => ({
        dataVencimento: p.dataVencimento,
        valor: formatValor(p.valor),
        paga: p.paga,
      }))
    );
  };

  const aoEscolherCondicao = (nome: string) => {
    setCondicao(nome);
    const op = condicoes.find((c) => c.nome === nome);
    const nova = regraNomusParaCampo(op?.regra ?? '');
    const dias = op?.diasPermitidos ?? null;
    if (gerarTimerRef.current) clearTimeout(gerarTimerRef.current);
    setRegra(nova);
    setDiasPermitidos(dias);
    if (nova) gerarParcelas(nova, dias);
    else setParcelas([parcelaVazia()]);
  };

  const aoEditarRegra = (textoBruto: string) => {
    const texto = mascaraRegra(textoBruto);
    setRegra(texto);
    if (gerarTimerRef.current) clearTimeout(gerarTimerRef.current);
    if (!texto) {
      setErro(null);
      setParcelas([parcelaVazia()]);
      return;
    }
    if (texto.endsWith(',')) return;
    gerarTimerRef.current = setTimeout(() => gerarParcelas(texto, diasPermitidos), 250);
  };

  const aoMudarDataBase = (valor: string) => {
    setDataBase(valor);
    if (gerarTimerRef.current) clearTimeout(gerarTimerRef.current);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !regra.trim() || regra.endsWith(',')) return;
    gerarParcelas(regra, diasPermitidos, valor);
  };

  const abrirEdicao = (proxima: 'ja_paga' | 'boleto_externo') => {
    setErro(null);
    setEscolha(proxima);
    setEditando(true);
    if (proxima === 'boleto_externo') preencherBoleto(linha);
  };

  const salvar = async () => {
    if (!escolha) {
      setErro('Informe se a nota já foi paga ou se há boleto a vencer.');
      return;
    }
    if (escolha === 'boleto_externo') {
      if (!condicao.trim()) {
        setErro('Informe a condição de pagamento.');
        return;
      }
      if (!forma.trim()) {
        setErro('Informe a forma de pagamento.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataBase)) {
        setErro('Informe a data base para gerar as parcelas.');
        return;
      }
      if (!regra.trim()) {
        setErro('Informe a regra para gerar parcelas.');
        return;
      }
      if (parcelas.length === 0) {
        setErro('Lance todas as parcelas da condição.');
        return;
      }
      if (parcelas.some((p) => !p.dataVencimento || parseValor(p.valor) == null || (parseValor(p.valor) ?? 0) <= 0)) {
        setErro('Informe vencimento e valor de cada parcela.');
        return;
      }
      if (parcelas.some((p) => p.paga !== true && p.paga !== false)) {
        setErro('Classifique cada parcela como já paga ou ainda a vencer.');
        return;
      }
      if (!parcelas.some((p) => p.paga === false)) {
        setErro('Se todas as parcelas já foram pagas, marque Já foi paga.');
        return;
      }
    }
    setSalvando(true);
    setErro(null);
    try {
      const salvo = await salvarPagamentoXmlPreEntrada({
        idDocumento,
        situacao: escolha,
        condicaoPagamento: escolha === 'boleto_externo' ? condicao : undefined,
        formaPagamento: escolha === 'boleto_externo' ? forma : undefined,
        regra: escolha === 'boleto_externo' ? regra.trim() : undefined,
        dataBase: escolha === 'boleto_externo' ? dataBase : undefined,
        parcelas:
          escolha === 'boleto_externo'
            ? parcelas.map((p) => ({
                dataVencimento: p.dataVencimento,
                valor: parseValor(p.valor) ?? 0,
                paga: p.paga === true,
              }))
            : [],
      });
      if (!salvo.ok) {
        setErro(salvo.erro ?? 'Não foi possível gravar.');
        return;
      }
      const atualizado = await fetchDoubleCheckInComparativoPc(idDocumento);
      if (atualizado.erro) {
        setErro(atualizado.erro);
        return;
      }
      onLinhasChange?.(atualizado.linhas);
      setEditando(false);
      setEscolha(null);
      onFechar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const condicaoAtual = condicoes.find((c) => c.nome === condicao);
  const formasVisiveis =
    !condicao || condicaoAtual?.idsFormaPagamento == null
      ? formas
      : formas.filter((f) => condicaoAtual.idsFormaPagamento?.includes(f.id));

  const total =
    linha.valorNfXml != null && Number.isFinite(linha.valorNfXml) ? nfBrl.format(linha.valorNfXml) : null;
  const somaParcelas = parcelas.reduce((s, p) => s + (parseValor(p.valor) ?? 0), 0);
  const somaFecha =
    linha.valorNfXml == null || Math.round(somaParcelas * 100) === Math.round(linha.valorNfXml * 100);
  const alerta = origem === 'pendente' || origem === 'sem_xml' || mostrarFormulario;
  const escolhaClasse = (ativa: boolean) =>
    `rounded-lg border px-3 py-2 text-sm font-medium ${
      ativa
        ? 'border-primary-600 bg-primary-600 text-white'
        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
    }`;

  return (
    <section
      className={`rounded-xl border px-3 py-3 ${
        editarAoAbrir
          ? 'border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900'
          : alerta
            ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950'
            : 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4
          className={`text-xs font-semibold uppercase tracking-wide ${
            alerta ? 'text-amber-900 dark:text-amber-100' : 'text-sky-800 dark:text-sky-200'
          }`}
        >
          Pagamento da nota
          {total ? <span className="ml-2 normal-case tracking-normal">{total}</span> : null}
        </h4>
        <div className="flex shrink-0 items-center gap-1">
        {onFechar ? (
          <button type="button" className={btnSecondary} onClick={onFechar}>
            Fechar
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setAjudaAberta((v) => !v)}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Para que serve este bloco?"
          aria-label="Para que serve este bloco?"
          aria-expanded={ajudaAberta}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
        </button>
        </div>
      </div>
      {ajudaAberta ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Para que serve este bloco?</p>
          <p className="mt-1.5">
            Use quando a nota está em pré-entrada, ainda não foi paga e vai gerar contas. O XML não trouxe as parcelas,
            então os prazos precisam ser informados aqui.
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>
              Se não precisamos gerar contas a pagar, escolha <strong className="font-semibold">Já foi paga</strong>.
            </li>
            <li>
              Se ainda precisamos gerar contas e a nota não destaca no XML as parcelas a vencer, escolha <strong className="font-semibold">Há parcelas a vencer</strong> e
              lance a condição completa. A data base é o dia de onde os prazos começam, e a regra (como 30,60,90)
              gera vencimento e valor a partir dela, do mesmo jeito que no Nomus. A forma lista só as que essa condição
              permite. Depois classifique cada parcela como já paga ou a vencer. A soma fecha o total da nota.
            </li>
          </ol>
          <p className="mt-1.5">
            Ao comparar, o sistema olha esses prazos contra o pedido. Se forem iguais, a condição está correta. Se
            forem diferentes, a divergência aparece no card. Isso não gera financeiro.
          </p>
        </div>
      ) : null}
      {pedidos.length > 0 ? (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
          {pedidos.map((pedido) => pedido.nome).join(' · ')}
        </p>
      ) : null}

      {origem === 'xml' ? (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">Parcelas lidas da fatura do XML.</p>
      ) : null}
      {origem === 'ja_paga' && !mostrarFormulario ? (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">Nota já paga. Compara como à vista.</p>
      ) : null}
      {origem === 'boleto_externo' && !mostrarFormulario ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-800 dark:text-slate-100">
          <li>
            {linha.condicaoPagamentoNF ?? '—'}
            {linha.regraPagamentoNF ? ` · ${linha.regraPagamentoNF}` : ''}
            {linha.formaPagamentoNF ? ` · ${linha.formaPagamentoNF}` : ''}
          </li>
          {(linha.parcelasNF ?? []).map((p) => (
            <li key={p.numero} className="tabular-nums">
              {p.numero}. {fmtYmdBr(p.dataVencimento)}
              {p.valor != null ? ` · ${nfBrl.format(p.valor)}` : ''}
              {p.paga === true ? ' · paga' : p.paga === false ? ' · a vencer' : ''}
            </li>
          ))}
        </ul>
      ) : null}

      {podeEditar && !mostrarFormulario && (origem === 'ja_paga' || origem === 'boleto_externo') ? (
        <button type="button" className={`${btnSecondary} mt-2`} onClick={() => abrirEdicao(origem)}>
          Alterar
        </button>
      ) : null}

      {mostrarFormulario ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={escolhaClasse(escolha === 'ja_paga')} onClick={() => setEscolha('ja_paga')}>
              Já foi paga
            </button>
            <button
              type="button"
              className={escolhaClasse(escolha === 'boleto_externo')}
              onClick={() => {
                if (escolha !== 'boleto_externo') abrirEdicao('boleto_externo');
              }}
            >
              Há parcelas a vencer
            </button>
          </div>
          {escolha === 'boleto_externo' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  Condição de pagamento
                  <select
                    className={`${inputClass} mt-1`}
                    value={condicao}
                    disabled={carregandoListas}
                    onChange={(e) => aoEscolherCondicao(e.target.value)}
                  >
                    <option value="">{carregandoListas ? 'Carregando…' : 'Selecione'}</option>
                    {condicoes.map((o) => (
                      <option key={o.id} value={o.nome}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  Forma de pagamento
                  <select
                    className={`${inputClass} mt-1`}
                    value={formasVisiveis.some((f) => f.nome === forma) ? forma : ''}
                    disabled={carregandoListas || !condicao}
                    onChange={(e) => setForma(e.target.value)}
                  >
                    <option value="">
                      {carregandoListas ? 'Carregando…' : !condicao ? 'Selecione a condição' : 'Selecione'}
                    </option>
                    {condicao
                      ? formasVisiveis.map((o) => (
                          <option key={o.id} value={o.nome}>
                            {o.nome}
                          </option>
                        ))
                      : null}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[11rem_1fr]">
              <label className="block text-xs text-slate-600 dark:text-slate-300">
                Data base
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={dataBase}
                  onChange={(e) => aoMudarDataBase(e.target.value)}
                />
              </label>
              <label className="block text-xs text-slate-600 dark:text-slate-300">
                Regra para gerar parcelas
                <input
                  className={`${inputClass} mt-1`}
                  value={regra}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="30,60,90"
                  onChange={(e) => aoEditarRegra(e.target.value)}
                  onBlur={() => {
                    if (!regra.endsWith(',')) return;
                    const texto = regra.replace(/,+$/, '');
                    setRegra(texto);
                    if (texto) gerarParcelas(texto, diasPermitidos);
                    else setParcelas([parcelaVazia()]);
                  }}
                />
              </label>
              </div>
              {parcelas.map((p, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-2 dark:border-slate-600">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="block text-xs text-slate-600 dark:text-slate-300">
                      Vencimento
                      <input
                        type="date"
                        className={`${inputClass} mt-1`}
                        value={p.dataVencimento}
                        onChange={(e) =>
                          setParcelas((atual) =>
                            atual.map((item, idx) =>
                              idx === i ? { ...item, dataVencimento: e.target.value } : item
                            )
                          )
                        }
                      />
                    </label>
                    <label className="block text-xs text-slate-600 dark:text-slate-300">
                      Valor
                      <span className="relative mt-1 block">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400">
                          R$
                        </span>
                        <input
                          inputMode="numeric"
                          autoComplete="off"
                          className={`${inputClass} pl-10 text-right tabular-nums`}
                          value={p.valor}
                          placeholder="0,00"
                          onChange={(e) =>
                            setParcelas((atual) =>
                              atual.map((item, idx) =>
                                idx === i ? { ...item, valor: mascaraMoeda(e.target.value) } : item
                              )
                            )
                          }
                        />
                      </span>
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={p.paga === true ? btnPrimary : btnSecondary}
                        onClick={() =>
                          setParcelas((atual) =>
                            atual.map((item, idx) => (idx === i ? { ...item, paga: true } : item))
                          )
                        }
                      >
                        Já paga
                      </button>
                      <button
                        type="button"
                        className={p.paga === false ? btnPrimary : btnSecondary}
                        onClick={() =>
                          setParcelas((atual) =>
                            atual.map((item, idx) => (idx === i ? { ...item, paga: false } : item))
                          )
                        }
                      >
                        A vencer
                      </button>
                    </div>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={parcelas.length === 1}
                      onClick={() => setParcelas((atual) => atual.filter((_, idx) => idx !== i))}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setParcelas((atual) => [...atual, parcelaVazia()])}
                >
                  Adicionar parcela
                </button>
                <p
                  className={`text-sm font-medium ${
                    somaFecha ? 'text-slate-700 dark:text-slate-200' : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  Soma: {nfBrl.format(somaParcelas)}
                  {total ? ` · Nota: ${total}` : ''}
                </p>
              </div>
            </div>
          ) : null}
          {erro ? (
            <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">
              {erro}
            </p>
          ) : null}
          {escolha ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={salvando} onClick={() => void salvar()}>
              {salvando ? 'Salvando…' : 'Comparar'}
            </button>
            {editando && origem !== 'pendente' && origem !== 'sem_xml' ? (
              <button
                type="button"
                className={btnSecondary}
                disabled={salvando}
                onClick={() => {
                  if (onFechar) {
                    onFechar();
                    return;
                  }
                  setEditando(false);
                  setEscolha(null);
                  setErro(null);
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
