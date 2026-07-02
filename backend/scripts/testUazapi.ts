import '../src/load-dotenv.js';
import { isConfigured, getConnectionState, getConnectQr } from '../src/services/evolutionApi.js';

async function main() {
  console.log('configured:', isConfigured());
  try {
    const st = await getConnectionState();
    console.log('state:', st);
  } catch (e) {
    console.error('status error:', (e as Error).message);
  }
  try {
    const qr = await getConnectQr();
    console.log('qr length:', qr.qrCodeBase64?.length, 'pairing:', qr.pairingCode ?? '-');
  } catch (e) {
    console.error('connect error:', (e as Error).message);
  }
}

main();
