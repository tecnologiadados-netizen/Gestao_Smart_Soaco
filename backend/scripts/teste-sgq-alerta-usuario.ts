/**
 * Teste pontual: 1 e-mail + 1 WhatsApp SGQ para um login.
 * Uso: npx tsx scripts/teste-sgq-alerta-usuario.ts davilucas1
 */
import '../src/load-dotenv.js';

/** Teste explícito: o .env local costuma deixar o envio em dry-run. */
process.env.NOTIFICACOES_ENVIO_HABILITADO = 'true';

const { prisma } = await import('../src/config/prisma.js');
const { fetchEmailProviderSettings, sendSystemEmail } = await import('../src/services/systemEmail.js');
const { buildSystemEmailHtml } = await import('../src/services/emailHtmlTemplate.js');
const { sendWhatsAppTextTo } = await import('../src/services/evolutionApi.js');
const { resolveAppBaseUrl } = await import('../src/config/appBaseUrl.js');

const login = (process.argv[2] ?? '').trim();
if (!login) {
  console.error('Informe o login. Ex.: npx tsx scripts/teste-sgq-alerta-usuario.ts davilucas1');
  process.exit(1);
}

const user = await prisma.usuario.findUnique({
  where: { login },
  select: { login: true, nome: true, email: true, telefone: true, ativo: true },
});

if (!user) {
  console.error(`Usuário "${login}" não encontrado.`);
  process.exit(1);
}
if (!user.ativo) {
  console.error(`Usuário "${login}" está inativo.`);
  process.exit(1);
}

const email = (user.email ?? '').trim().toLowerCase();
const telefone = (user.telefone ?? '').trim();
console.log(
  JSON.stringify(
    {
      login: user.login,
      nome: user.nome,
      email: email || null,
      temTelefone: Boolean(telefone),
      envioHabilitado: process.env.NOTIFICACOES_ENVIO_HABILITADO?.trim().toLowerCase() === 'true',
    },
    null,
    2
  )
);

const linkDocs = `${resolveAppBaseUrl()}/qualidade/documentos`;
const linkCal = `${resolveAppBaseUrl()}/qualidade/calibracoes`;
const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

if (email.includes('@')) {
  const settings = await fetchEmailProviderSettings(prisma);
  if (!settings) {
    console.error('E-mail: credencial do provedor não configurada.');
  } else {
    const html = buildSystemEmailHtml({
      badge: 'TESTE SGQ',
      title: 'Validade de documento',
      subtitle: 'Envio de teste da cadeia de alertas (marco 10d).',
      intro:
        'Este é um disparo de teste do alerta SGQ de validade. Se você recebeu esta mensagem, o canal de e-mail está operacional.',
      sections: [
        {
          heading: 'Dados do teste',
          rows: [
            { label: 'Destinatário', value: user.nome ?? user.login },
            { label: 'Login', value: user.login },
            { label: 'Quando', value: now },
            { label: 'Canais', value: 'E-mail + WhatsApp (teste pontual)' },
          ],
        },
      ],
      cta: { label: 'Abrir documentos no SGQ', href: linkDocs },
    });
    try {
      await sendSystemEmail(prisma, {
        to: [email],
        subject: '[SGQ] Teste — validade de documento (alerta 10d)',
        html,
      });
      console.log('E-mail: disparo concluído.');
    } catch (err) {
      console.error('E-mail: falha:', err instanceof Error ? err.message : err);
    }
  }
} else {
  console.error('E-mail: usuário sem e-mail válido no cadastro.');
}

if (telefone) {
  const texto = [
    '📄 *Validade de documento (SGQ) — TESTE*',
    '',
    `Olá, ${user.nome ?? user.login}.`,
    'Este é um disparo de teste do alerta de validade (a partir de 10 dias, e-mail + WhatsApp).',
    '',
    `Quando: ${now}`,
    `Calibrações: ${linkCal}`,
    `Documentos: ${linkDocs}`,
  ].join('\n');
  const wa = await sendWhatsAppTextTo(telefone, texto);
  console.log('WhatsApp:', JSON.stringify(wa));
} else {
  console.error('WhatsApp: usuário sem telefone no cadastro.');
}

await prisma.$disconnect();
