/**
 * Script para enviar uma mensagem WhatsApp via Evolution API.
 * Sem args: envia "Oi" para o número cadastrado no app (banco).
 * Com args: npx tsx scripts/sendWhatsApp.ts [número] [mensagem]
 */
import '../src/load-dotenv.js';
import { getResolvedEvolutionEnv, sendWhatsAppTextTo } from '../src/services/evolutionApi.js';

async function main() {
  const explicitNumber = process.argv[2];
  const text = explicitNumber
    ? process.argv.slice(3).join(' ') || 'oi'
    : 'Oi';
  const number = explicitNumber ?? (await getResolvedEvolutionEnv()).number;

  if (!number?.trim()) {
    console.error('Nenhum número informado e nenhum número cadastrado no app. Cadastre em WhatsApp no frontend.');
    process.exit(1);
  }

  console.log(`Enviando "${text}" para ${number}...`);
  const result = await sendWhatsAppTextTo(number, text);
  if (result.ok) {
    console.log('Mensagem enviada.');
  } else {
    console.error('Erro:', result.error);
    process.exit(1);
  }
}

main();
