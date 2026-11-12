import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  enviarParaAprovacao,
  listarAprovadoresColetaWhatsapp,
  reenviarLinkAprovacaoColeta,
  type AprovadorColetaWhatsapp,
  type ResultadoEnvioLinkAprovacao,
} from '../../api/compras';

export interface ModalEnviarLinkAprovacaoColetaProps {
  coletaId: number;
  /** true na primeira ida para Em Aprovação; false só reenvia o link. */
  alterarStatus: boolean;
  /** Nova rodada depois de Reavaliar: o link leva só os itens ainda em aberto. */
  novaRodada?: boolean;
  onClose: () => void;
  onEnviado: (resultado: ResultadoEnvioLinkAprovacao) => void;
}

export default function ModalEnviarLinkAprovacaoColeta({
  coletaId,
  alterarStatus,
  novaRodada = false,
  onClose,
  onEnviado,
}: ModalEnviarLinkAprovacaoColetaProps) {
  const [aprovadores, setAprovadores] = useState<AprovadorColetaWhatsapp[]>([]);
  const [usuarioId, setUsuarioId] = useState<number | ''>('');
  const [carregando, setCarregando] = useState(alterarStatus);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<'escolha' | 'pessoa'>(alterarStatus ? 'escolha' : 'pessoa');
  const [modo, setModo] = useState<'virtual' | 'manual'>('virtual');

  useEffect(() => {
    if (etapa !== 'pessoa') return;
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    listarAprovadoresColetaWhatsapp().then((res) => {
      if (cancelado) return;
      setCarregando(false);
      if (res.error) {
        setErro(res.error);
        setAprovadores([]);
        return;
      }
      setAprovadores(res.data);
      if (res.data.length === 1) setUsuarioId(res.data[0].id);
    });
    return () => {
      cancelado = true;
    };
  }, [etapa]);

  const overlay = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-link-aprovacao-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-link-aprovacao-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
          {etapa === 'escolha'
            ? novaRodada
              ? 'Enviar para nova aprovação'
              : 'Enviar para aprovação'
            : modo === 'manual'
              ? 'Aprovação manual'
              : novaRodada
                ? 'Aprovação virtual'
                : alterarStatus
                  ? 'Aprovação virtual'
                  : 'Enviar link no WhatsApp'}
        </h2>
        {etapa === 'escolha' ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Escolha como esta coleta vai para aprovação.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => {
                  setModo('virtual');
                  setEtapa('pessoa');
                  setErro(null);
                }}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-5 text-slate-800 dark:text-slate-100 hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <rect x="7" y="2" width="10" height="20" rx="2" />
                  <path d="M11 18h2" />
                </svg>
                <span className="font-semibold">Virtual</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Aprovação pelo celular</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo('manual');
                  setEtapa('pessoa');
                  setErro(null);
                }}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-5 text-slate-800 dark:text-slate-100 hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M19 8v6M22 11h-6" />
                </svg>
                <span className="font-semibold">Manual</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Aprovação no portal</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {modo === 'manual'
                ? 'Indique quem vai aprovar. A coleta passa para Em Aprovação e o acompanhamento continua neste portal.'
                : novaRodada
                  ? 'A pessoa recebe o link no WhatsApp só com os itens que ainda não foram aprovados nem rejeitados.'
                  : 'A pessoa recebe o link no WhatsApp para informar a quantidade e o fornecedor de cada item.'}
            </p>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="aprovador-coleta">
              {modo === 'manual' ? 'Quem aprova' : 'Quem recebe'}
            </label>
            <select
              id="aprovador-coleta"
              value={usuarioId}
              onChange={(e) => {
                setUsuarioId(e.target.value ? Number(e.target.value) : '');
                setErro(null);
              }}
              disabled={carregando || enviando}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm mb-3"
            >
              <option value="">{carregando ? 'Carregando…' : 'Selecione'}</option>
              {aprovadores.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} ({a.login})
                  {modo === 'virtual' && a.temWhatsapp === false ? ' — sem telefone' : ''}
                </option>
              ))}
            </select>
            {!carregando && aprovadores.length === 0 && !erro && (
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Nenhum administrador ou master ativo.
              </p>
            )}
            {erro && <p className="text-red-600 dark:text-red-400 text-sm mb-3">{erro}</p>}
            <div className="flex gap-2 justify-end">
              {alterarStatus && (
                <button
                  type="button"
                  onClick={() => {
                    setEtapa('escolha');
                    setErro(null);
                  }}
                  disabled={enviando}
                  className="mr-auto px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={enviando || usuarioId === ''}
                onClick={async () => {
                  if (usuarioId === '') return;
                  setEnviando(true);
                  setErro(null);
                  const res = alterarStatus
                    ? await enviarParaAprovacao(coletaId, usuarioId, modo === 'manual')
                    : await reenviarLinkAprovacaoColeta(coletaId, usuarioId);
                  setEnviando(false);
                  if (!res.ok) {
                    setErro(res.error ?? 'Não foi possível enviar.');
                    return;
                  }
                  onEnviado({
                    status: res.status ?? 'Em Aprovação',
                    whatsappOk: res.whatsappOk === true,
                    whatsappErro: modo === 'manual' ? undefined : res.whatsappErro,
                    aprovadorNome: res.aprovadorNome,
                  });
                }}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {enviando ? 'Enviando…' : modo === 'manual' ? 'Confirmar' : 'Enviar WhatsApp'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
}
