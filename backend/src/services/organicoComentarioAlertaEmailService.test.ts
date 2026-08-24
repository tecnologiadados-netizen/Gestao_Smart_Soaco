import { describe, expect, it } from 'vitest';
import { RH_ORGANICO_COMMENT_TAG_OPTIONS } from '../rh/lib/rh-organico-comment-tags.js';
import { comentarioOrganicoDisparaAlerta } from './organicoComentarioAlertaEmailService.js';

const catalog = [...RH_ORGANICO_COMMENT_TAG_OPTIONS];

describe('comentarioOrganicoDisparaAlerta', () => {
  it('dispara quando o tom da categoria é sensível', () => {
    const r = comentarioOrganicoDisparaAlerta(
      { tipo: 'comentario', tagCode: '20', visibility: 'public' },
      catalog
    );
    expect(r.dispara).toBe(true);
    expect(r.motivos).toEqual(['tom_sensivel']);
  });

  it('dispara quando a visibilidade é confidencial', () => {
    const r = comentarioOrganicoDisparaAlerta(
      { tipo: 'comentario', tagCode: '6', visibility: 'confidential' },
      catalog
    );
    expect(r.dispara).toBe(true);
    expect(r.motivos).toEqual(['visibilidade_confidencial']);
  });

  it('dispara com os dois motivos juntos', () => {
    const r = comentarioOrganicoDisparaAlerta(
      { tipo: 'comentario', tagCode: '21', visibility: 'confidential' },
      catalog
    );
    expect(r.dispara).toBe(true);
    expect(r.motivos).toEqual(['tom_sensivel', 'visibilidade_confidencial']);
  });

  it('não dispara em comentário público e neutro', () => {
    const r = comentarioOrganicoDisparaAlerta(
      { tipo: 'comentario', tagCode: '6', visibility: 'restricted' },
      catalog
    );
    expect(r.dispara).toBe(false);
    expect(r.motivos).toEqual([]);
  });

  it('não dispara em log automático', () => {
    const r = comentarioOrganicoDisparaAlerta(
      { tipo: 'log_alteracao', tagCode: '20', visibility: 'confidential' },
      catalog
    );
    expect(r.dispara).toBe(false);
  });
});
