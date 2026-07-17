export type EmailDataRow = {
  label: string;
  value: string;
};

export type EmailSection = {
  heading?: string;
  intro?: string;
  rows?: EmailDataRow[];
  html?: string;
};

export type SystemEmailLayoutOptions = {
  badge?: string;
  title: string;
  subtitle?: string;
  greeting?: string;
  intro?: string;
  sections?: EmailSection[];
  cta?: { label: string; href: string };
  footerNote?: string;
};

const COLORS = {
  pageBg: '#e8eef5',
  cardBg: '#ffffff',
  headerFrom: '#1a3560',
  headerTo: '#0f2444',
  navy: '#1a3560',
  text: '#334155',
  muted: '#64748b',
  border: '#dbe3ef',
  tableHead: '#f1f5f9',
  accent: '#2563eb',
  badgeBg: 'rgba(255,255,255,0.14)',
  badgeBorder: 'rgba(255,255,255,0.28)',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** CID anexado automaticamente por sendSystemEmail (funciona sem URL pública). */
const LOGO_EMAIL_CID = 'soaco-email-logo';

function renderDataTable(rows: EmailDataRow[]): string {
  const bodyRows = rows
    .map(
      (row, index) => `
        <tr>
          <td style="padding:12px 16px;border-top:${index === 0 ? 'none' : `1px solid ${COLORS.border}`};background:${COLORS.cardBg};color:${COLORS.muted};font-size:13px;font-weight:600;width:38%;vertical-align:top;">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding:12px 16px;border-top:${index === 0 ? 'none' : `1px solid ${COLORS.border}`};background:${COLORS.cardBg};color:${COLORS.text};font-size:14px;vertical-align:top;">
            ${escapeHtml(row.value)}
          </td>
        </tr>`
    )
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="border:1px solid ${COLORS.border};border-radius:10px;border-collapse:separate;border-spacing:0;overflow:hidden;">
      ${bodyRows}
    </table>`;
}

function renderSection(section: EmailSection): string {
  const parts: string[] = [];

  if (section.heading) {
    parts.push(`
      <p style="margin:24px 0 10px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.navy};">
        ${escapeHtml(section.heading)}
      </p>`);
  }

  if (section.intro) {
    parts.push(`
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${COLORS.text};">
        ${section.intro}
      </p>`);
  }

  if (section.rows?.length) {
    parts.push(renderDataTable(section.rows));
  }

  if (section.html) {
    parts.push(section.html);
  }

  return parts.join('');
}

/**
 * Layout padrão de e-mails automáticos do Gestão Smart / Gestor de Pedidos SoAço.
 * Inspirado no padrão visual do Otimiza.SoAço (cabeçalho azul, card, tabela de dados).
 */
export function buildSystemEmailHtml(options: SystemEmailLayoutOptions): string {
  const badge = options.badge ?? 'NOTIFICAÇÃO AUTOMÁTICA';
  const greeting = options.greeting ?? 'Olá,';
  const footer =
    options.footerNote ??
    'Esta é uma mensagem automática do sistema Gestão Smart SoAço. Por favor, não responda este e-mail.';

  const sectionsHtml = (options.sections ?? []).map(renderSection).join('');

  const introHtml = options.intro
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${COLORS.text};">${options.intro}</p>`
    : '';

  const subtitleHtml = options.subtitle
    ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.88);">${escapeHtml(options.subtitle)}</p>`
    : '';

  const ctaHtml = options.cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px;">
        <tr>
          <td style="border-radius:8px;background:${COLORS.accent};">
            <a href="${escapeHtml(options.cta.href)}"
              style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
              ${escapeHtml(options.cta.label)}
            </a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.pageBg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.pageBg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;">
          <tr>
            <td style="border-radius:14px 14px 0 0;padding:28px 28px 24px;background:linear-gradient(180deg, ${COLORS.headerFrom} 0%, ${COLORS.headerTo} 100%);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom:18px;">
                    <div style="display:inline-block;background:#ffffff;border-radius:8px;padding:10px 14px;">
                      <img src="cid:${LOGO_EMAIL_CID}" alt="SoAço" width="170" height="65" style="display:block;border:0;outline:none;width:170px;height:auto;max-width:100%;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="display:inline-block;padding:5px 10px;border-radius:999px;border:1px solid ${COLORS.badgeBorder};background:${COLORS.badgeBg};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                      ${escapeHtml(badge)}
                    </span>
                    <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;font-weight:700;color:#ffffff;">
                      ${escapeHtml(options.title)}
                    </h1>
                    ${subtitleHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${COLORS.cardBg};padding:28px;border-radius:0 0 14px 14px;box-shadow:0 10px 30px rgba(15,36,68,0.08);">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${COLORS.text};">${escapeHtml(greeting)}</p>
              ${introHtml}
              ${sectionsHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 8px 8px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted};">
                ${escapeHtml(footer)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** E-mail simples de teste de credencial. */
export function buildEmailTestHtml(fromEmail: string, sentAtLabel: string): string {
  return buildSystemEmailHtml({
    badge: 'TESTE DE CREDENCIAL',
    title: 'Credencial Gmail configurada',
    subtitle: 'O envio automático de notificações está operacional.',
    intro: `Este e-mail confirma que a credencial Gmail ${fromEmail} está funcionando corretamente no Gestão Smart.`,
    sections: [
      {
        heading: 'Detalhes do envio',
        rows: [
          { label: 'Remetente', value: fromEmail },
          { label: 'Data e hora', value: sentAtLabel },
          { label: 'Sistema', value: 'Gestão Smart SoAço' },
        ],
      },
    ],
    footerNote:
      'E-mail de teste do Gestão Smart SoAço. Por favor, não responda esta mensagem.',
  });
}
