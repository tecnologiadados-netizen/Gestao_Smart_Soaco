import { describe, expect, it } from 'vitest';
import {
  isWhatsAppGroupJid,
  normalizarDestinoEnvioWhatsApp,
  normalizarJidGrupoWhatsApp,
} from '../src/utils/whatsappDestino.ts';

describe('whatsappDestino', () => {
  it('normaliza JID de grupo', () => {
    expect(normalizarJidGrupoWhatsApp('120363380975837123@g.us')).toBe('120363380975837123@g.us');
    expect(normalizarJidGrupoWhatsApp(' 120363380975837123@G.US ')).toBe('120363380975837123@g.us');
    expect(isWhatsAppGroupJid('558699766623-1610036922@g.us')).toBe(true);
    expect(normalizarJidGrupoWhatsApp('558699766623-1610036922@g.us')).toBe(
      '558699766623-1610036922@g.us'
    );
  });

  it('rejeita JID inválido', () => {
    expect(normalizarJidGrupoWhatsApp('abc@g.us')).toBeNull();
    expect(normalizarJidGrupoWhatsApp('5586995887672')).toBeNull();
  });

  it('mantém @g.us no destino de envio e limpa telefone', () => {
    expect(normalizarDestinoEnvioWhatsApp('120363380975837123@g.us')).toBe('120363380975837123@g.us');
    expect(normalizarDestinoEnvioWhatsApp('86995887672')).toBe('5586995887672');
  });
});
