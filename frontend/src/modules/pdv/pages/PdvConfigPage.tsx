import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { enviarCertificado, pdvJson } from '@pdv/pdvApi';

type Opcao = { id: number; nome: string };
type Empresa = Opcao & { uf: string; crt: string };
type Usuario = { id: number; nome: string; login: string; idEmpresa: number | null };
type Config = {
  idEmpresa: number;
  nomeEmpresa: string;
  uf: string;
  crt: string;
  idTabelaPreco: number | null;
  idTipoMovimentacao: number | null;
  idTipoPedido: number | null;
  idSetorSaida: number | null;
  idCondicaoPagamento: number | null;
  idFormaPagamento: number | null;
  idPessoaConsumidor: number | null;
  idContaBancaria: number | null;
  idPessoaVendedor: number | null;
  ignorarEstoque: boolean;
};
type Cert = {
  idEmpresa: number;
  cnpj: string;
  titular: string;
  validoAte: string | null;
  ambiente: string;
  temCertificado: boolean;
  temCsc: boolean;
  cscId: string;
  serieNfce: number;
  serieNfe: number;
  proximoNfce: number;
  proximoNfe: number;
};
type Opcoes = {
  empresas: Empresa[];
  tabelas: Opcao[];
  formas: Opcao[];
  condicoes: Opcao[];
  tipos: Opcao[];
  setores: Opcao[];
  usuarios: Usuario[];
  configs: Config[];
  certificados: Cert[];
};

const vazio: Omit<Config, 'idEmpresa'> = {
  nomeEmpresa: '',
  uf: '',
  crt: '',
  idTabelaPreco: null,
  idTipoMovimentacao: null,
  idTipoPedido: null,
  idSetorSaida: null,
  idCondicaoPagamento: null,
  idFormaPagamento: null,
  idPessoaConsumidor: null,
  idContaBancaria: null,
  idPessoaVendedor: null,
  ignorarEstoque: false,
};

function num(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function configurada(config: Config | undefined) {
  return Boolean(config?.idTabelaPreco && config.idSetorSaida);
}

const OPCOES_CRT = [
  '1 - Simples Nacional',
  '2 - Simples Nacional, excesso de sublimite de receita bruta',
  '3 - Regime normal',
  '4 - Simples Nacional - MEI',
];

function valorCrt(atual: string) {
  const codigo = atual.trim().match(/^[1-4]/)?.[0];
  return OPCOES_CRT.find((opcao) => opcao.startsWith(`${codigo} `)) ?? atual;
}

export default function PdvConfigPage() {
  const { login } = useAuth();
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [aba, setAba] = useState<AbaConfig>('venda');
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(vazio);
  const [usuarioId, setUsuarioId] = useState(0);
  const [senha, setSenha] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [csc, setCsc] = useState('');
  const [cscId, setCscId] = useState('');
  const [serieNfce, setSerieNfce] = useState(1);
  const [serieNfe, setSerieNfe] = useState(1);
  const [proximoNfce, setProximoNfce] = useState(1);
  const [proximoNfe, setProximoNfe] = useState(1);
  const [ambiente, setAmbiente] = useState<'homologacao' | 'producao'>('homologacao');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    const q = aberta ? `?idEmpresa=${aberta}` : '';
    pdvJson<Opcoes>(`/api/pdv/config/opcoes${q}`)
      .then((data) => {
        if (!ativo) return;
        setOpcoes(data);
        setErro('');
        setUsuarioId((atual) => {
          if (atual) return atual;
          const eu = data.usuarios.find((u) => u.login === login);
          return eu?.id ?? 0;
        });
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Sem permissão para configurar o PDV.');
      });
    return () => {
      ativo = false;
    };
  }, [aberta, login]);

  const configAtual = useMemo(
    () => (aberta ? opcoes?.configs.find((c) => c.idEmpresa === aberta) ?? null : null),
    [opcoes, aberta],
  );
  const certAtual = useMemo(
    () => (aberta ? opcoes?.certificados.find((c) => c.idEmpresa === aberta) ?? null : null),
    [opcoes, aberta],
  );
  const empresaAberta = opcoes?.empresas.find((e) => e.id === aberta) ?? null;

  useEffect(() => {
    if (!aberta) return;
    if (configAtual) {
      setForm({ ...vazio, ...configAtual });
    } else if (empresaAberta) {
      setForm({ ...vazio, nomeEmpresa: empresaAberta.nome, uf: empresaAberta.uf, crt: empresaAberta.crt });
    }
    if (certAtual) {
      setCscId(certAtual.cscId);
      setSerieNfce(certAtual.serieNfce);
      setSerieNfe(certAtual.serieNfe);
      setProximoNfce(certAtual.proximoNfce);
      setProximoNfe(certAtual.proximoNfe);
      setAmbiente(certAtual.ambiente === 'producao' ? 'producao' : 'homologacao');
    } else {
      setCscId('');
      setSerieNfce(1);
      setSerieNfe(1);
      setProximoNfce(1);
      setProximoNfe(1);
      setAmbiente('homologacao');
    }
  }, [configAtual, certAtual, aberta, empresaAberta]);

  useEffect(() => {
    if (!aberta) return;
    const fecharEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setAberta(null);
    };
    window.addEventListener('keydown', fecharEsc);
    return () => window.removeEventListener('keydown', fecharEsc);
  }, [aberta]);

  const empresas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = opcoes?.empresas ?? [];
    if (!termo) return lista;
    return lista.filter((e) => `${e.nome} ${e.uf} ${e.id}`.toLowerCase().includes(termo));
  }, [opcoes, busca]);

  function abrirEmpresa(id: number) {
    setMsg('');
    setErro('');
    setSenha('');
    setCsc('');
    setArquivo(null);
    setAba('venda');
    setAberta(id);
  }

  async function salvarEmpresa() {
    if (!aberta) return;
    setMsg('');
    try {
      await pdvJson(`/api/pdv/config/empresas/${aberta}`, { method: 'PUT', body: { ...form, idEmpresa: aberta } });
      setMsg('Configuração da empresa salva.');
      setOpcoes(await pdvJson<Opcoes>(`/api/pdv/config/opcoes?idEmpresa=${aberta}`));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    }
  }

  async function vincular() {
    if (!aberta) return;
    setMsg('');
    try {
      await pdvJson(`/api/pdv/config/usuarios/${usuarioId}`, { method: 'PUT', body: { idEmpresa: aberta } });
      setMsg('Usuário vinculado a esta empresa.');
      setOpcoes(await pdvJson<Opcoes>(`/api/pdv/config/opcoes?idEmpresa=${aberta}`));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao vincular.');
    }
  }

  async function enviarPfx() {
    if (!aberta) return;
    if (!arquivo || !senha) {
      setErro('Escolha o arquivo .pfx e informe a senha.');
      return;
    }
    setErro('');
    try {
      const meta = await enviarCertificado(aberta, arquivo, senha);
      setMsg(`Certificado lido. CNPJ ${meta.cnpj || '—'}, válido até ${meta.validoAte ? new Date(meta.validoAte).toLocaleDateString('pt-BR') : '—'}.`);
      setSenha('');
      setOpcoes(await pdvJson<Opcoes>(`/api/pdv/config/opcoes?idEmpresa=${aberta}`));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Certificado recusado.');
    }
  }

  async function salvarFiscal() {
    if (!aberta) return;
    setMsg('');
    try {
      await pdvJson(`/api/pdv/config/empresas/${aberta}/fiscal`, {
        method: 'PUT',
        body: {
          ambiente,
          csc: csc || undefined,
          cscId,
          serieNfce,
          serieNfe,
          proximoNfce,
          proximoNfe,
        },
      });
      setCsc('');
      setMsg(ambiente === 'producao' ? 'Ambiente de produção gravado.' : 'Dados fiscais gravados em homologação.');
      setOpcoes(await pdvJson<Opcoes>(`/api/pdv/config/opcoes?idEmpresa=${aberta}`));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar o fiscal.');
    }
  }

  if (erro && !opcoes) return <div className="p-6 text-sm text-red-700">{erro}</div>;
  if (!opcoes) return <div className="p-6 text-sm text-slate-500">Carregando empresas do Nomus…</div>;

  return (
    <div className="flex w-full flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Configuração do PDV</h1>
          <p className="mt-1 text-slate-500">Escolha a empresa do Nomus para definir venda, operador e nota.</p>
        </div>
        <Link to="/pdv" className="text-primary-700">Voltar ao balcão</Link>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar empresa"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
      />

      {empresas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500">
          Nenhuma empresa encontrada.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {empresas.map((empresa) => {
            const config = opcoes.configs.find((c) => c.idEmpresa === empresa.id);
            const cert = opcoes.certificados.find((c) => c.idEmpresa === empresa.id);
            const operadores = opcoes.usuarios.filter((u) => u.idEmpresa === empresa.id);
            const pronta = configurada(config);
            return (
              <button
                key={empresa.id}
                type="button"
                onClick={() => abrirEmpresa(empresa.id)}
                className="flex min-h-[9.5rem] flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-primary-400 hover:shadow dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{empresa.nome}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${pronta ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {pronta ? 'Configurada' : 'Pendente'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {empresa.uf || 'UF não informada'}
                  {empresa.crt ? ` · CRT ${empresa.crt}` : ''}
                </p>
                <p className="mt-auto pt-4 text-xs text-slate-600 dark:text-slate-300">
                  {cert?.temCertificado ? 'Certificado cadastrado' : 'Sem certificado'}
                  {' · '}
                  {operadores.length === 1 ? '1 operador' : `${operadores.length} operadores`}
                  {config?.ignorarEstoque ? ' · vende sem saldo' : ''}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {aberta && empresaAberta
        ? createPortal(
        <div
          className="fixed inset-0 z-[16000] flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setAberta(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdv-config-titulo"
            className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 id="pdv-config-titulo" className="text-lg font-semibold">{empresaAberta.nome}</h2>
                <p className="text-xs text-slate-500">
                  {empresaAberta.uf || 'UF não informada'}
                  {empresaAberta.crt ? ` · CRT ${empresaAberta.crt}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setAberta(null)} className="rounded-lg border px-3 py-1.5 text-xs dark:border-slate-700">
                Fechar
              </button>
            </div>
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-3 dark:border-slate-800" role="tablist">
              {ABAS_CONFIG.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={aba === item.id}
                  onClick={() => {
                    setAba(item.id);
                    setMsg('');
                    setErro('');
                  }}
                  className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
                    aba === item.id
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {erro ? <p className="mb-3 text-red-700">{erro}</p> : null}
              {aba === 'venda' ? (
              <section className="grid content-start gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.ignorarEstoque}
                      onChange={(e) => setForm({ ...form, ignorarEstoque: e.target.checked })}
                    />
                    Vender sem considerar o saldo de estoque
                  </label>
                  <Campo label="UF" value={form.uf} onChange={(uf) => setForm({ ...form, uf })} />
                  <label className="block">
                    CRT
                    <select
                      value={valorCrt(form.crt)}
                      onChange={(e) => setForm({ ...form, crt: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1 dark:bg-slate-900"
                    >
                      <option value="">Selecione</option>
                      {OPCOES_CRT.map((opcao) => (
                        <option key={opcao} value={opcao}>{opcao}</option>
                      ))}
                    </select>
                  </label>
                  <Select label="Tabela de preço" value={form.idTabelaPreco} opcoes={opcoes.tabelas} onChange={(idTabelaPreco) => setForm({ ...form, idTabelaPreco })} />
                  <Select label="Tipo de movimentação" value={form.idTipoMovimentacao} opcoes={opcoes.tipos} onChange={(idTipoMovimentacao) => setForm({ ...form, idTipoMovimentacao })} />
                  <CampoBusca label="Tipo de pedido" tipo="tipoPedido" idEmpresa={aberta ?? 0} value={form.idTipoPedido} onSelect={(idTipoPedido) => setForm({ ...form, idTipoPedido })} />
                  <Select label="Setor de saída" value={form.idSetorSaida} opcoes={opcoes.setores} onChange={(idSetorSaida) => setForm({ ...form, idSetorSaida })} />
                  <Select label="Condição à vista" value={form.idCondicaoPagamento} opcoes={opcoes.condicoes} onChange={(idCondicaoPagamento) => setForm({ ...form, idCondicaoPagamento })} />
                  <Select label="Forma padrão" value={form.idFormaPagamento} opcoes={opcoes.formas} onChange={(idFormaPagamento) => setForm({ ...form, idFormaPagamento })} />
                  <CampoBusca label="Cliente consumidor" tipo="cliente" idEmpresa={aberta ?? 0} value={form.idPessoaConsumidor} onSelect={(idPessoaConsumidor) => setForm({ ...form, idPessoaConsumidor })} />
                  <CampoBusca label="Conta bancária" tipo="conta" idEmpresa={aberta ?? 0} value={form.idContaBancaria} onSelect={(idContaBancaria) => setForm({ ...form, idContaBancaria })} />
                  <button type="button" onClick={() => void salvarEmpresa()} className="btn-primary mt-1 justify-self-start">Salvar empresa</button>
                </section>
              ) : null}

              {aba === 'operador' ? (
                  <section className="grid max-w-lg gap-2">
                    <p className="text-xs text-slate-500">Este é o usuário que entra em /pdv. A venda usa só a empresa vinculada aqui.</p>
                    <select value={usuarioId} onChange={(e) => setUsuarioId(Number(e.target.value))} className="rounded border px-2 py-1 dark:bg-slate-900">
                      <option value={0}>Selecione</option>
                      {opcoes.usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome} ({u.login}){u.idEmpresa ? ` · empresa ${u.idEmpresa}` : ' · sem vínculo'}
                        </option>
                      ))}
                    </select>
                    <button type="button" disabled={!usuarioId} onClick={() => void vincular()} className="justify-self-start rounded border px-3 py-2">
                      Vincular à empresa
                    </button>
                  </section>
              ) : null}

              {aba === 'certificado' ? (
                  <section className="grid max-w-lg gap-2">
                    {certAtual?.temCertificado ? (
                      <p>
                        CNPJ {certAtual.cnpj || '—'} · {certAtual.titular || 'sem titular'} · válido até{' '}
                        {certAtual.validoAte ? new Date(certAtual.validoAte).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    ) : (
                      <p>Nenhum certificado desta empresa.</p>
                    )}
                    <input type="file" accept=".pfx,.p12" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
                    <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha do certificado" className="rounded border px-2 py-1 dark:bg-slate-900" />
                    <button type="button" onClick={() => void enviarPfx()} className="justify-self-start rounded border px-3 py-2">Enviar certificado</button>
                  </section>
              ) : null}

              {aba === 'nota' ? (
                  <section className="grid gap-2">
                    <p className="text-xs text-slate-500">O ambiente inicial é homologação. Produção só depois do certificado, do CSC e do credenciamento.</p>
                    <Campo label="Id do CSC" value={cscId} onChange={setCscId} />
                    <input
                      type="password"
                      value={csc}
                      onChange={(e) => setCsc(e.target.value)}
                      placeholder={certAtual?.temCsc ? 'CSC já cadastrado — preencha só para trocar' : 'CSC'}
                      className="rounded border px-2 py-1 dark:bg-slate-900"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Campo label="Série NFC-e" value={String(serieNfce)} onChange={(v) => setSerieNfce(Number(v) || 1)} />
                      <Campo label="Próximo número NFC-e" value={String(proximoNfce)} onChange={(v) => setProximoNfce(Number(v) || 1)} />
                      <Campo label="Série NF-e" value={String(serieNfe)} onChange={(v) => setSerieNfe(Number(v) || 1)} />
                      <Campo label="Próximo número NF-e" value={String(proximoNfe)} onChange={(v) => setProximoNfe(Number(v) || 1)} />
                    </div>
                    <label>
                      Ambiente
                      <select value={ambiente} onChange={(e) => setAmbiente(e.target.value === 'producao' ? 'producao' : 'homologacao')} className="mt-1 w-full rounded border px-2 py-1 dark:bg-slate-900">
                        <option value="homologacao">Homologação</option>
                        <option value="producao">Produção</option>
                      </select>
                    </label>
                    <button type="button" onClick={() => void salvarFiscal()} className="btn-primary justify-self-start">Salvar fiscal</button>
                  </section>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
      {msg
        ? createPortal(
            <div className="fixed inset-0 z-[17000] flex items-center justify-center bg-black/45 p-4" onClick={() => setMsg('')}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="pdv-sucesso-titulo"
                className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-2xl dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <p id="pdv-sucesso-titulo" className="text-sm font-semibold text-slate-900 dark:text-slate-100">{msg}</p>
                <button type="button" className="btn-primary mt-4" onClick={() => setMsg('')}>
                  Ok
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

type AbaConfig = 'venda' | 'operador' | 'certificado' | 'nota';

const ABAS_CONFIG: { id: AbaConfig; label: string }[] = [
  { id: 'venda', label: 'Parâmetros da venda' },
  { id: 'operador', label: 'Operador' },
  { id: 'certificado', label: 'Certificado A1' },
  { id: 'nota', label: 'NFC-e e NF-e' },
];

function CampoBusca({
  label,
  tipo,
  idEmpresa,
  value,
  onSelect,
}: {
  label: string;
  tipo: 'tipoPedido' | 'cliente' | 'conta' | 'vendedor';
  idEmpresa: number;
  value: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [rotulo, setRotulo] = useState('');
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Opcao[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!value) {
      setRotulo('');
      return;
    }
    let ativo = true;
    const params = new URLSearchParams({ tipo, id: String(value), idEmpresa: String(idEmpresa) });
    pdvJson<{ itens: Opcao[] }>(`/api/pdv/config/consulta?${params}`)
      .then((data) => {
        if (!ativo) return;
        setRotulo(data.itens.find((item) => item.id === value)?.nome ?? '');
      })
      .catch(() => {
        if (ativo) setRotulo('');
      });
    return () => {
      ativo = false;
    };
  }, [value, tipo, idEmpresa]);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const t = window.setTimeout(() => {
      setCarregando(true);
      const params = new URLSearchParams({ tipo, q: texto.trim(), idEmpresa: String(idEmpresa) });
      pdvJson<{ itens: Opcao[] }>(`/api/pdv/config/consulta?${params}`)
        .then((data) => {
          if (ativo) setItens(data.itens);
        })
        .catch(() => {
          if (ativo) setItens([]);
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    }, 250);
    return () => {
      ativo = false;
      window.clearTimeout(t);
    };
  }, [aberto, texto, tipo, idEmpresa]);

  return (
    <label className="relative block">
      {label}
      <input
        value={aberto ? texto : rotulo}
        onFocus={() => {
          setAberto(true);
          setTexto('');
        }}
        onBlur={() => window.setTimeout(() => setAberto(false), 150)}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        placeholder={rotulo || 'Buscar'}
        className="mt-1 w-full rounded border px-2 py-1 dark:bg-slate-900"
        autoComplete="off"
      />
      {aberto ? (
        <ul className="mt-1 max-h-44 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {carregando ? <li className="px-2 py-2 text-xs text-slate-500">Buscando…</li> : null}
          {!carregando && itens.length === 0 ? <li className="px-2 py-2 text-xs text-slate-500">Nenhum resultado.</li> : null}
          {itens.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(item.id);
                  setRotulo(item.nome);
                  setTexto('');
                  setAberto(false);
                }}
              >
                {item.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value ? (
        <button
          type="button"
          className="mt-1 text-xs text-slate-500"
          onClick={() => {
            onSelect(null);
            setRotulo('');
            setTexto('');
          }}
        >
          Limpar
        </button>
      ) : null}
    </label>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border px-2 py-1 dark:bg-slate-900" />
    </label>
  );
}

function Select({
  label,
  value,
  opcoes,
  onChange,
}: {
  label: string;
  value: number | null;
  opcoes: Opcao[];
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      {label}
      <select value={value ?? ''} onChange={(e) => onChange(num(e.target.value))} className="mt-1 w-full rounded border px-2 py-1 dark:bg-slate-900">
        <option value="">Selecione</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>{o.nome}</option>
        ))}
      </select>
    </label>
  );
}
