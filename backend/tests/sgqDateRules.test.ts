import { describe, expect, it } from 'vitest';
import { marcoDisparaWhatsapp, MARCO_WHATSAPP_VALIDADE, marcosAlertaAplicaveis } from '../src/services/sgq/sgqDateRules.ts';

describe('sgqDateRules — cadeia validade + WhatsApp', () => {
  it('WhatsApp só a partir do marco de 10 dias', () => {
    expect(MARCO_WHATSAPP_VALIDADE).toBe(10);
    expect(marcoDisparaWhatsapp(30)).toBe(false);
    expect(marcoDisparaWhatsapp(20)).toBe(false);
    expect(marcoDisparaWhatsapp(10)).toBe(true);
    expect(marcoDisparaWhatsapp(5)).toBe(true);
    expect(marcoDisparaWhatsapp(0)).toBe(true);
  });

  it('catch-up aplica marcos maiores quando o prazo já passou do marco', () => {
    expect(marcosAlertaAplicaveis(22)).toEqual([30]);
    expect(marcosAlertaAplicaveis(18)).toEqual([30, 20]);
    expect(marcosAlertaAplicaveis(8)).toEqual([30, 20, 10]);
    expect(marcosAlertaAplicaveis(0)).toEqual([30, 20, 10, 5, 3, 1, 0]);
  });
});
