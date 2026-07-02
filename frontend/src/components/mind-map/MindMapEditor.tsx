import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createMindMap,
  getMindMap,
  updateMindMap,
} from '../../api/mindMaps';
import { exportMindMapPdf } from '../../utils/exportMindMapPdf';
import { imageUrlToDataUrl } from '../../utils/imageDataUrl';
import { fitTextareaHeight } from './autoResizeTextarea';
import { createDemoRoot } from './defaults';
import { bezierPath, computeLayout, measureObservation, measureText } from './layout';
import {
  addChildToNode,
  branchSelected,
  deleteNodes,
  findNode,
  findParent,
  isRoot,
  moveObservation,
  moveSelection,
  resetOffsets,
  resizeNode,
  setCollapsed,
  setObservation,
  updateNodeInTree,
} from './treeUtils';
import { useMindMapHistory } from './useMindMapHistory';
import type { MindMapNode } from './types';
import {
  DEFAULT_OBS_OFFSET_Y,
  EDGE_COLOR,
  FONT_FAMILIES,
  MIN_NODE_H,
  MIN_NODE_W,
  OBS_EDGE_COLOR,
  PALETTE_COLORS,
} from './types';
import './MindMapEditor.css';

interface Props {
  mapId?: string;
  readOnly?: boolean;
  onSair: () => void;
  onSaved?: () => void;
}

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';

const MAX_NODE_EDIT_H = 200;
const MAX_OBS_EDIT_H = 160;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_WHEEL_SENSITIVITY = 0.002;
const ZOOM_BTN_STEP = 0.12;

function BotaoTelaCheia({ ativo, onClick }: { ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mind-map-editor__icon-btn"
      title={ativo ? 'Sair da tela cheia' : 'Tela cheia'}
      aria-label={ativo ? 'Sair da tela cheia' : 'Visualizar em tela cheia'}
      aria-pressed={ativo}
    >
      {ativo ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      )}
    </button>
  );
}

export default function MindMapEditor({ mapId, readOnly = false, onSair, onSaved }: Props) {
  const canEdit = !readOnly;

  const [mapUid, setMapUid] = useState<string | undefined>(mapId);
  const [mapName, setMapName] = useState('Novo mapa');
  const [mapDescription, setMapDescription] = useState('');
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(!!mapId);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [confirmSairAberto, setConfirmSairAberto] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const { root, setRoot, undo, redo, resetHistory } = useMindMapHistory(createDemoRoot());
  const [selection, setSelection] = useState<Set<string>>(() => new Set([root.id]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editingObsId, setEditingObsId] = useState<string | null>(null);
  const [editObsText, setEditObsText] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const nodeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const obsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; ids: string[] } | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const resizeRef = useRef<{ id: string; startW: number; startH: number; startX: number; startY: number } | null>(null);
  const obsDragRef = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const layout = useMemo(() => computeLayout(root), [root]);

  useEffect(() => {
    void imageUrlToDataUrl('/logo-soaco.png').then(setLogoBase64);
  }, []);

  useEffect(() => {
    if (!mapId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getMindMap(mapId)
      .then((m) => {
        setMapUid(m.id);
        setMapName(m.name);
        setMapDescription(m.mapDescription ?? '');
        setPan(m.pan);
        setZoom(m.zoom);
        resetHistory(m.root as MindMapNode);
        setSelection(new Set([m.root.id]));
        setDirty(false);
      })
      .catch((e) => setStatusMsg(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, [mapId, resetHistory]);

  const markDirty = useCallback(() => {
    if (canEdit) setDirty(true);
  }, [canEdit]);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const worldToCanvas = useCallback(
    (wx: number, wy: number) => {
      return {
        x: wx * zoom + pan.x,
        y: wy * zoom + pan.y,
      };
    },
    [pan, zoom]
  );

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return false;
    setSaving(true);
    setStatusMsg('');
    try {
      const payload = {
        name: mapName.trim() || 'Novo mapa',
        mapDescription: mapDescription.trim() || undefined,
        root,
        pan,
        zoom,
      };
      if (mapUid) {
        const saved = await updateMindMap(mapUid, payload);
        setMapUid(saved.id);
        setDirty(false);
        setStatusMsg('Salvo.');
        onSaved?.();
        return true;
      }
      const saved = await createMindMap(payload);
      setMapUid(saved.id);
      setDirty(false);
      setStatusMsg('Salvo.');
      onSaved?.();
      return true;
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Erro ao salvar.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [canEdit, mapName, mapDescription, root, pan, zoom, mapUid, onSaved]);

  const addChild = useCallback(() => {
    const ids = [...selection];
    if (ids.length === 0) return;
    let newId = '';
    setRoot((r) => {
      let next = r;
      for (const id of ids) {
        const node = findNode(next, id);
        if (!node) continue;
        const added = addChildToNode(node);
        newId = added.children[added.children.length - 1]!.id;
        next = updateNodeInTree(next, id, () => added);
      }
      return next;
    });
    markDirty();
    if (newId) setSelection(new Set([newId]));
  }, [selection, setRoot, markDirty]);

  const deleteSelected = useCallback(() => {
    const ids = new Set([...selection].filter((id) => !isRoot(root, id)));
    if (ids.size === 0) return;
    setRoot((r) => deleteNodes(r, ids));
    setSelection(new Set([root.id]));
    markDirty();
  }, [selection, root, setRoot, markDirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId || editingObsId) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }
      if (canEdit && mod && e.key === 'z') {
        e.preventDefault();
        undo();
        markDirty();
      }
      if (canEdit && mod && e.key === 'y') {
        e.preventDefault();
        redo();
        markDirty();
      }
      if (
        canEdit &&
        ((mod && (e.key === 'd' || e.key === '+')) || (mod && e.shiftKey && e.key === '='))
      ) {
        e.preventDefault();
        addChild();
      }
      if (canEdit && e.key === 'Delete') {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'Escape') {
        setSelection(new Set([root.id]));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId, editingObsId, handleSave, undo, redo, markDirty, addChild, deleteSelected, root.id, canEdit]);

  const realign = useCallback(() => {
    const ids = selection.size >= 2 ? selection : undefined;
    setRoot((r) => resetOffsets(r, ids), false);
    markDirty();
  }, [selection, setRoot, markDirty]);

  const fitView = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const scale = Math.min((vw - 80) / layout.width, (vh - 80) / layout.height, ZOOM_MAX);
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale));
    setZoom(z);
    setPan({
      x: (vw - layout.width * z) / 2,
      y: (vh - layout.height * z) / 2,
    });
  }, [layout]);

  /** Zoom ancorado em coordenadas de tela (px relativos ao viewport). */
  const zoomAtScreen = useCallback((screenX: number, screenY: number, delta: number) => {
    const el = canvasRef.current;
    if (!el || delta === 0) return;
    const rect = el.getBoundingClientRect();
    const mx = screenX - rect.left;
    const my = screenY - rect.top;
    setZoom((z) => {
      const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta));
      if (nz === z) return z;
      const ratio = nz / z;
      setPan((p) => ({
        x: mx - (mx - p.x) * ratio,
        y: my - (my - p.y) * ratio,
      }));
      return nz;
    });
  }, []);

  const zoomIn = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAtScreen(rect.left + rect.width / 2, rect.top + rect.height / 2, ZOOM_BTN_STEP);
  }, [zoomAtScreen]);

  const zoomOut = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAtScreen(rect.left + rect.width / 2, rect.top + rect.height / 2, -ZOOM_BTN_STEP);
  }, [zoomAtScreen]);

  const alternarTelaCheia = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* navegador pode negar fullscreen */
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setTelaCheia(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (loading) return;
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = -e.deltaY * ZOOM_WHEEL_SENSITIVITY;
      if (Math.abs(delta) < 0.02) delta = e.deltaY > 0 ? -0.05 : 0.05;
      delta = Math.max(-0.15, Math.min(0.15, delta));
      zoomAtScreen(e.clientX, e.clientY, delta);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [loading, zoomAtScreen]);

  useEffect(() => {
    if (!editingId) return;
    setRoot((r) => {
      const node = findNode(r, editingId);
      if (!node) return r;
      const m = measureText(editText, node.fontSize, node.fontFamily, 280);
      return updateNodeInTree(r, editingId, (n) => ({
        ...n,
        width: m.width,
        height: Math.min(m.height, MAX_NODE_EDIT_H),
      }));
    }, false);
  }, [editText, editingId, setRoot]);

  useEffect(() => {
    if (!editingObsId) return;
    const m = measureObservation(editObsText);
    setRoot(
      (r) =>
        setObservation(r, editingObsId, {
          text: editObsText,
          ...(findNode(r, editingObsId)?.observation ?? {}),
          width: m.width,
          height: Math.min(m.height, MAX_OBS_EDIT_H),
        }),
      false
    );
  }, [editObsText, editingObsId, setRoot]);

  useEffect(() => {
    const ta = nodeTextareaRef.current;
    if (ta && editingId) fitTextareaHeight(ta, MAX_NODE_EDIT_H - 16);
  }, [editText, editingId, layout]);

  useEffect(() => {
    const ta = obsTextareaRef.current;
    if (ta && editingObsId) fitTextareaHeight(ta, MAX_OBS_EDIT_H - 12);
  }, [editObsText, editingObsId, layout]);

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const commitEdit = () => {
    if (!editingId) return;
    setRoot((r) =>
      updateNodeInTree(r, editingId, (n) => ({ ...n, text: editText.trim() || '…' }))
    );
    setEditingId(null);
    markDirty();
  };

  const commitObsEdit = () => {
    if (!editingObsId) return;
    const texto = editObsText.trim();
    setRoot((r) =>
      setObservation(
        r,
        editingObsId,
        texto ? { text: texto, ...(findNode(r, editingObsId)?.observation ?? {}) } : undefined
      )
    );
    setEditingObsId(null);
    markDirty();
  };

  const toggleObservation = (id: string) => {
    const node = findNode(root, id);
    if (!node) return;
    if (node.observation?.text?.trim()) {
      setRoot((r) => setObservation(r, id, undefined));
      if (editingObsId === id) setEditingObsId(null);
    } else {
      setRoot((r) =>
        setObservation(r, id, {
          text: 'Observação…',
          offsetX: 4,
          offsetY: (node.height ?? MIN_NODE_H) + DEFAULT_OBS_OFFSET_Y,
        })
      );
      setEditingObsId(id);
      setEditObsText('Observação…');
    }
    markDirty();
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelection((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelection(new Set([id]));
    }
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      panDragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (e.target !== canvasRef.current && e.target !== innerRef.current) return;
    if (e.button !== 0) return;
    setSelection(new Set());
    const w = screenToWorld(e.clientX, e.clientY);
    marqueeRef.current = { x0: w.x, y0: w.y, x1: w.x, y1: w.y };
    const p0 = worldToCanvas(w.x, w.y);
    setMarquee({ x: p0.x, y: p0.y, w: 0, h: 0 });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panDragRef.current) {
        const d = panDragRef.current;
        setPan({
          x: d.panX + (e.clientX - d.startX),
          y: d.panY + (e.clientY - d.startY),
        });
        return;
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = (e.clientX - r.startX) / zoom;
        const dy = (e.clientY - r.startY) / zoom;
        setRoot((root) =>
          resizeNode(
            root,
            r.id,
            Math.max(MIN_NODE_W, r.startW + dx),
            Math.max(MIN_NODE_H, r.startH + dy)
          ),
          false
        );
        markDirty();
        return;
      }
      if (obsDragRef.current) {
        const d = obsDragRef.current;
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          setRoot((r) => moveObservation(r, d.id, dx, dy), false);
          obsDragRef.current = { ...d, startX: e.clientX, startY: e.clientY };
          markDirty();
        }
        return;
      }
      if (dragRef.current) {
        const d = dragRef.current;
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          setRoot((r) => moveSelection(r, new Set(d.ids), dx, dy), false);
          dragRef.current = { ...d, startX: e.clientX, startY: e.clientY };
          markDirty();
        }
        return;
      }
      if (marqueeRef.current) {
        const w = screenToWorld(e.clientX, e.clientY);
        const m = marqueeRef.current;
        m.x1 = w.x;
        m.y1 = w.y;
        const p0 = worldToCanvas(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1));
        const p1 = worldToCanvas(Math.max(m.x0, m.x1), Math.max(m.y0, m.y1));
        setMarquee({ x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y });
      }
    };
    const onUp = () => {
      if (marqueeRef.current) {
        const m = marqueeRef.current;
        const x0 = Math.min(m.x0, m.x1);
        const x1 = Math.max(m.x0, m.x1);
        const y0 = Math.min(m.y0, m.y1);
        const y1 = Math.max(m.y0, m.y1);
        const hit = new Set<string>();
        for (const ln of layout.nodes) {
          if (
            ln.x + ln.width >= x0 &&
            ln.x <= x1 &&
            ln.y + ln.height >= y0 &&
            ln.y <= y1
          ) {
            hit.add(ln.id);
          }
        }
        if (hit.size) setSelection(hit);
        marqueeRef.current = null;
        setMarquee(null);
      }
      panDragRef.current = null;
      dragRef.current = null;
      resizeRef.current = null;
      obsDragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [layout, pan, zoom, screenToWorld, worldToCanvas, setRoot, markDirty, canEdit]);

  const sairTelaCheiaSeAtivo = useCallback(async () => {
    if (document.fullscreenElement === rootRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleSairClick = () => {
    void sairTelaCheiaSeAtivo().then(() => {
      if (readOnly || !canEdit) {
        onSair();
        return;
      }
      setConfirmSairAberto(true);
    });
  };

  const handleConfirmSairSemSalvar = () => {
    setConfirmSairAberto(false);
    onSair();
  };

  const handleConfirmSalvarESair = async () => {
    setConfirmSairAberto(false);
    const ok = await handleSave();
    if (ok) onSair();
  };

  const toggleCollapse = (id: string, collapsed: boolean, recordDirty = true) => {
    setRoot((r) => updateNodeInTree(r, id, (n) => ({ ...n, collapsed })));
    if (recordDirty && canEdit) markDirty();
  };

  if (loading) {
    return (
      <div className="mind-map-editor p-8 text-center text-slate-600">
        Carregando mapa…
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mind-map-editor">
      <header className="mind-map-editor__header">
        <button type="button" className="mind-map-editor__menu-btn" onClick={handleSairClick}>
          Sair
        </button>
        <span className={`mind-map-editor__title${dirty && canEdit ? ' mind-map-editor__title-dirty' : ''}`}>
          {mapName}
          {readOnly && <span className="mind-map-editor__badge-view"> (somente leitura)</span>}
        </span>
        <BotaoTelaCheia ativo={telaCheia} onClick={() => void alternarTelaCheia()} />
        <button type="button" className="mind-map-editor__menu-btn mind-map-editor__btn-centralizar" onClick={fitView}>
          Centralizar
        </button>
        {canEdit && (
          <button type="button" className="mind-map-editor__menu-btn" onClick={() => void handleSave()} disabled={saving}>
            Salvar
          </button>
        )}
      </header>

      <div className="mind-map-editor__toolbar">
        <button type="button" className="mind-map-editor__btn-centralizar" onClick={fitView} title="Enquadrar fluxo na tela">
          Centralizar
        </button>
        <BotaoTelaCheia ativo={telaCheia} onClick={() => void alternarTelaCheia()} />
        <span className="mind-map-editor__zoom-group" role="group" aria-label="Zoom">
          <button type="button" onClick={zoomOut} title="Diminuir zoom (−)">
            −
          </button>
          <span className="mind-map-editor__zoom-label" title="Nível de zoom atual">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={zoomIn} title="Aumentar zoom (+)">
            +
          </button>
        </span>
        {canEdit && (
          <>
            <button type="button" onClick={addChild} title="Filho (Ctrl+D)">
              + Filho
            </button>
            <button
              type="button"
              onClick={() => {
                setRoot((r) => branchSelected(r, selection));
                markDirty();
              }}
            >
              Ramificar
            </button>
            <button type="button" onClick={deleteSelected}>
              Excluir
            </button>
          </>
        )}
        <button type="button" onClick={realign} title="Restaurar posição automática dos cards selecionados">
          Realinhar
        </button>
        <button
          type="button"
          onClick={() => {
            setRoot((r) => setCollapsed(r, selection, false));
            if (canEdit) markDirty();
          }}
        >
          Expandir
        </button>
        <button
          type="button"
          onClick={() => {
            setRoot((r) => setCollapsed(r, selection, true));
            if (canEdit) markDirty();
          }}
        >
          Recolher
        </button>
        {canEdit && (
          <>
            <div className="mind-map-editor__palette">
              {PALETTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  style={{ background: c }}
                  onClick={() => {
                    setRoot((r) => {
                      let next = r;
                      for (const id of selection) {
                        next = updateNodeInTree(next, id, (n) => ({ ...n, color: c }));
                      }
                      return next;
                    });
                    markDirty();
                  }}
                />
              ))}
            </div>
            <select
              onChange={(e) => {
                const font = e.target.value;
                setRoot((r) => {
                  let next = r;
                  for (const id of selection) {
                    next = updateNodeInTree(next, id, (n) => ({ ...n, fontFamily: font }));
                  }
                  return next;
                });
                markDirty();
              }}
              defaultValue={FONT_FAMILIES[0]}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f.split(',')[0]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setRoot((r) => {
                  let next = r;
                  for (const id of selection) {
                    next = updateNodeInTree(next, id, (n) => ({
                      ...n,
                      fontSize: Math.min(28, n.fontSize + 1),
                    }));
                  }
                  return next;
                });
                markDirty();
              }}
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => {
                setRoot((r) => {
                  let next = r;
                  for (const id of selection) {
                    next = updateNodeInTree(next, id, (n) => ({
                      ...n,
                      fontSize: Math.max(10, n.fontSize - 1),
                    }));
                  }
                  return next;
                });
                markDirty();
              }}
            >
              A−
            </button>
            <button type="button" onClick={undo}>
              Desfazer
            </button>
            <button type="button" onClick={redo}>
              Refazer
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() =>
            exportMindMapPdf({
              map: { name: mapName, mapDescription, root },
              logoBase64,
            })
          }
        >
          PDF
        </button>
      </div>

      {statusMsg && <div className="mind-map-editor__status">{statusMsg}</div>}

      <div className="mind-map-editor__body">
        <div className="mind-map-editor__canvas-wrap">
          <div
            ref={canvasRef}
            className="mind-map-editor__canvas"
            onMouseDown={onCanvasMouseDown}
          >
            <div
              ref={innerRef}
              className="mind-map-editor__canvas-inner"
              style={{
                width: layout.width,
                height: layout.height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <svg
                className="mind-map-editor__edges"
                width={layout.width}
                height={layout.height}
              >
                {layout.edges.map((e) => (
                  <path
                    key={`${e.fromId}-${e.toId}`}
                    d={bezierPath(e.x1, e.y1, e.x2, e.y2)}
                    fill="none"
                    stroke={EDGE_COLOR}
                    strokeWidth={2}
                  />
                ))}
                {layout.noteEdges.map((e) => (
                  <path
                    key={`obs-${e.nodeId}`}
                    d={bezierPath(e.x1, e.y1, e.x2, e.y2)}
                    fill="none"
                    stroke={OBS_EDGE_COLOR}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                ))}
              </svg>
              {layout.nodes.map((ln) => {
                const sel = selection.has(ln.id);
                const isEdit = editingId === ln.id;
                return (
                  <div
                    key={ln.id}
                    className={`mind-map-editor__node${sel ? ' selected' : ''}`}
                    style={{
                      left: ln.x,
                      top: ln.y,
                      width: ln.width,
                      height: ln.height,
                      borderColor: ln.node.color,
                      fontSize: ln.node.fontSize,
                      fontFamily: ln.node.fontFamily,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (e.button !== 0) return;
                      toggleSelect(ln.id, e);
                      dragRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        ids: [...(selection.has(ln.id) ? selection : new Set([ln.id]))],
                      };
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) startEdit(ln.id, ln.node.text);
                    }}
                  >
                    {isEdit ? (
                      <textarea
                        ref={nodeTextareaRef}
                        autoFocus
                        value={editText}
                        onChange={(ev) => {
                          setEditText(ev.target.value);
                          fitTextareaHeight(ev.target, MAX_NODE_EDIT_H - 16);
                        }}
                        onBlur={commitEdit}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' && !ev.shiftKey) {
                            ev.preventDefault();
                            commitEdit();
                          }
                        }}
                        className="mind-map-editor__inline-textarea"
                        style={{ width: '100%', border: 'none', font: 'inherit' }}
                      />
                    ) : (
                      ln.node.text
                    )}
                    {(canEdit || ln.node.children.length > 0) && (
                      <div className="mind-map-editor__node-actions">
                        {canEdit && (
                          <button
                            type="button"
                            title="Adicionar filho"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoot((r) => {
                                const added = addChildToNode(findNode(r, ln.id)!);
                                const childId = added.children[added.children.length - 1]!.id;
                                setSelection(new Set([childId]));
                                return updateNodeInTree(r, ln.id, () => added);
                              });
                              markDirty();
                            }}
                          >
                            +
                          </button>
                        )}
                        {ln.node.children.length > 0 && !ln.node.collapsed && (
                          <button
                            type="button"
                            title="Recolher ramo"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(ln.id, true);
                            }}
                          >
                            ‹›
                          </button>
                        )}
                        {ln.node.children.length > 0 && ln.node.collapsed && (
                          <button
                            type="button"
                            title="Expandir ramo"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(ln.id, false);
                            }}
                          >
                            ››
                          </button>
                        )}
                        {findParent(root, ln.id) && (
                          <button
                            type="button"
                            title={
                              ln.node.observation?.text
                                ? canEdit
                                  ? 'Editar observação (não é ramificação)'
                                  : 'Observação sobre este passo'
                                : canEdit
                                  ? 'Adicionar observação com linha tracejada'
                                  : 'Sem observação'
                            }
                            className={
                              ln.node.observation?.text ? 'mind-map-editor__obs-btn--on' : undefined
                            }
                            disabled={!canEdit && !ln.node.observation?.text}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canEdit) return;
                              toggleObservation(ln.id);
                            }}
                          >
                            💬
                          </button>
                        )}
                      </div>
                    )}
                    {sel && canEdit && (
                      <div
                        className="mind-map-editor__resize"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          resizeRef.current = {
                            id: ln.id,
                            startW: ln.width,
                            startH: ln.height,
                            startX: e.clientX,
                            startY: e.clientY,
                          };
                        }}
                      />
                    )}
                  </div>
                );
              })}
              {layout.observations.map((obs) => {
                const isObsEdit = editingObsId === obs.nodeId;
                return (
                  <div
                    key={`obs-bubble-${obs.nodeId}`}
                    className={`mind-map-editor__observation${selection.has(obs.nodeId) ? ' selected' : ''}`}
                    style={{
                      left: obs.x,
                      top: obs.y,
                      width: obs.width,
                      minHeight: obs.height,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (e.button !== 0) return;
                      setSelection(new Set([obs.nodeId]));
                      obsDragRef.current = {
                        id: obs.nodeId,
                        startX: e.clientX,
                        startY: e.clientY,
                      };
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) {
                        setEditingObsId(obs.nodeId);
                        setEditObsText(obs.text);
                      }
                    }}
                  >
                    {isObsEdit ? (
                      <textarea
                        ref={obsTextareaRef}
                        autoFocus
                        value={editObsText}
                        onChange={(ev) => {
                          setEditObsText(ev.target.value);
                          fitTextareaHeight(ev.target, MAX_OBS_EDIT_H - 12);
                        }}
                        onBlur={commitObsEdit}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' && !ev.shiftKey) {
                            ev.preventDefault();
                            commitObsEdit();
                          }
                        }}
                        className="mind-map-editor__inline-textarea"
                        style={{ width: '100%', border: 'none', font: 'inherit' }}
                      />
                    ) : (
                      obs.text
                    )}
                  </div>
                );
              })}
            </div>
            {marquee && (
              <div
                className="mind-map-editor__marquee"
                style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
              />
            )}
          </div>
        </div>

        <aside className="mind-map-editor__side">
          <label htmlFor="mm-map-title">Título do mapa</label>
          <input
            id="mm-map-title"
            value={mapName}
            disabled={!canEdit}
            onChange={(e) => {
              setMapName(e.target.value);
              markDirty();
            }}
          />
          <label htmlFor="mm-map-desc">Descrição do mapa</label>
          <textarea
            id="mm-map-desc"
            value={mapDescription}
            disabled={!canEdit}
            placeholder="Descrição exibida no painel e no PDF (não é o texto do nó raiz)"
            onChange={(e) => {
              setMapDescription(e.target.value);
              markDirty();
            }}
          />
        </aside>
      </div>

      {confirmSairAberto && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setConfirmSairAberto(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mind-map-confirm-sair-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mind-map-confirm-sair-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Sair do fluxo?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Deseja salvar as alterações antes de voltar à lista ou sair sem salvar?
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConfirmSairAberto(false)} className={BTN_SECONDARY}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmSairSemSalvar} className={BTN_SECONDARY}>
                Sair sem salvar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSalvarESair()}
                disabled={saving}
                className={BTN_PRIMARY}
              >
                Salvar e sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
