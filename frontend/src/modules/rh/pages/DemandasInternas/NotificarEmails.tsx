import { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { separarEmails } from '@rh/lib/demandas-internas';

type NotificarEmailsProps = {
  emails: string[];
  podeEditar: boolean;
  onSalvar: (emails: string[]) => Promise<void>;
};

export default function NotificarEmails({ emails, podeEditar, onSalvar }: NotificarEmailsProps) {
  const [texto, setTexto] = useState('');

  function adicionar(bruto: string): boolean {
    const { validos, invalidos } = separarEmails(bruto);
    const novos = validos.filter((email) => !emails.includes(email));
    if (novos.length) void onSalvar([...emails, ...novos]);
    if (invalidos.length) {
      toast.error(invalidos.length === 1 ? `E-mail inválido: ${invalidos[0]}` : `E-mails inválidos: ${invalidos.join(', ')}`);
      setTexto(invalidos.join(', '));
      return false;
    }
    setTexto('');
    return true;
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Mail className="h-3.5 w-3.5" /> Notificar por e-mail
      </p>
      {emails.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {emails.map((email) => (
            <li
              key={email}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#c5d4e6] bg-[#e7eef8] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[#10233f]"
            >
              <span className="truncate">{email}</span>
              {podeEditar ? (
                <button
                  type="button"
                  aria-label={`Remover ${email}`}
                  onClick={() => void onSalvar(emails.filter((item) => item !== email))}
                  className="rounded-full p-0.5 text-[#5c7084] hover:bg-[#fde8e6] hover:text-[#b42318]"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : !podeEditar ? (
        <p className="text-sm text-muted-foreground">Ninguém é avisado por e-mail.</p>
      ) : null}
      {podeEditar ? (
        <>
          <input
            type="text"
            inputMode="email"
            value={texto}
            placeholder="Digite um e-mail e tecle Enter"
            onChange={(evento) => {
              const valor = evento.target.value;
              if (/[,;]\s*$/.test(valor)) adicionar(valor);
              else setTexto(valor);
            }}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault();
                if (texto.trim()) adicionar(texto);
              }
            }}
            onPaste={(evento) => {
              const colado = evento.clipboardData.getData('text');
              if (!/[\s,;]/.test(colado.trim())) return;
              evento.preventDefault();
              adicionar(`${texto} ${colado}`);
            }}
            onBlur={() => {
              if (texto.trim()) adicionar(texto);
            }}
            className="w-full max-w-sm rounded-lg border border-[#c5d4e6] bg-white px-2 py-1.5 text-sm text-[#10233f] outline-none focus:border-[#FFAD00]"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Pode adicionar vários (separe por vírgula ou cole uma lista). Avisamos quando o card mudar de lista ou quadro, for
            concluído ou reaberto, ou tiver prazo, título, observação, checklist ou prints alterados.
          </p>
        </>
      ) : null}
    </div>
  );
}
