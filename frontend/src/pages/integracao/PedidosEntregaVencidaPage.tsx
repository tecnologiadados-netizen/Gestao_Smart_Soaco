import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMensagemPedidosEntregaVencida, enviarPedidosEntregaVencida } from '../../api/integracao';
import { getSmsTipos, getSmsUsuarios } from '../../api/integracaoSms';
import { cronExpressaoParaHorarios, descreverHorariosAgendamento } from '../../utils/smsCronHorarios';

export default function PedidosEntregaVencidaPage() {
  const [numero, setNumero] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [numerosOpcoes, setNumerosOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [horariosAgendamento, setHorariosAgendamento] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [{ tipos }, usuarios] = await Promise.all([getSmsTipos(), getSmsUsuarios()]);
        const tipo = tipos.find((t) => t.code === 'pedidos_entrega_vencida');
        if (!tipo) return;
        const horarios = cronExpressaoParaHorarios(tipo.cronExpressao);
        setHorariosAgendamento(descreverHorariosAgendamento(horarios));
        const opts = tipo.destinatarioIds
          .map((id) => usuarios.find((u) => u.id === id))
          .filter((u): u is NonNullable<typeof u> => !!u && !!u.telefone?.trim())
          .map((u) => {
            const tel = u.telefone!.replace(/\D/g, '');
            const local = tel.startsWith('55') ? tel.slice(2) : tel;
            return { value: local, label: `${u.login} (${u.telefone})` };
          });
        setNumerosOpcoes(opts);
      } catch {
        // mantém lista vazia; usuário pode configurar em SMS
      }
    })();
  }, []);

  const semDestinatarios = useMemo(() => numerosOpcoes.length === 0, [numerosOpcoes]);

  const handleEnviar = async () => {
    if (!numero.trim()) {
      setErro('Selecione um número para envio.');
      return;
    }
    setErro(null);
    setMensagemSucesso(null);
    setEnviando(true);
    try {
      await enviarPedidosEntregaVencida(numero.trim());
      setMensagemSucesso(`Mensagem enviada para ${numero}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const handlePreview = async () => {
    setErro(null);
    setPreview(null);
    setCarregandoPreview(true);
    try {
      const { mensagem } = await getMensagemPedidosEntregaVencida();
      setPreview(mensagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar preview.');
    } finally {
      setCarregandoPreview(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Pedidos com previsão de entrega vencida – WhatsApp
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Todos os dias
        {horariosAgendamento ? ` às ${horariosAgendamento}` : ' nos horários configurados'} é enviada automaticamente
        a lista de pedidos do Gerenciador (Entrega G. The e Retirada) cuja <strong>Previsão atual</strong> é igual ou
        anterior a hoje e que possuem <strong>card no Comunicador de Pedidos</strong>, com bolinha verde/vermelha
        conforme disponibilidade. Destinatários e horário em{' '}
        <Link to="/integracao/sms" className="text-primary-600 hover:underline">
          Integração → SMS
        </Link>
        . Use esta tela para testar o envio.
      </p>

      {semDestinatarios && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Nenhum destinatário com telefone configurado para &quot;Pedidos com previsão de entrega vencida&quot;. Configure em{' '}
          <Link to="/integracao/sms" className="underline">
            SMS
          </Link>
          .
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 space-y-4">
        <div>
          <label
            htmlFor="numero-entrega-vencida"
            className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            Destinatário para teste
          </label>
          <select
            id="numero-entrega-vencida"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="w-full max-w-xs rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Selecione...</option>
            {numerosOpcoes.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || !numero.trim()}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
          >
            {enviando ? 'Enviando...' : 'Enviar mensagem de teste'}
          </button>
          <button
            type="button"
            onClick={handlePreview}
            disabled={carregandoPreview}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {carregandoPreview ? 'Carregando...' : 'Ver preview da mensagem'}
          </button>
        </div>

        {mensagemSucesso && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
            {mensagemSucesso}
          </div>
        )}
        {erro && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 space-y-2">
            <p>{erro}</p>
            {/whatsapp|evolution|desconectad/i.test(erro) && (
              <p>
                <a href="/whatsapp" className="underline font-medium text-primary-700 dark:text-primary-300">
                  Abrir configuração do WhatsApp
                </a>
              </p>
            )}
          </div>
        )}
      </div>

      {preview != null && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Preview da mensagem</h2>
          <pre className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100 font-sans">{preview}</pre>
        </div>
      )}
    </div>
  );
}
