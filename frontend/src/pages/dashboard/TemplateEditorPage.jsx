import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Type, Image, QrCode, Minus, PenLine, Building2, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch, api } from '../../lib/api.js';
import { Button, Input, Select, Textarea, Skeleton, Modal } from '../../components/ui.jsx';

const ASPECT = {
  'a4-landscape': 297 / 210, 'a4-portrait': 210 / 297,
  'letter-landscape': 279 / 216, 'letter-portrait': 216 / 279,
};
const VARIABLES = ['recipient_name', 'event_name', 'course_name', 'event_date', 'issued_by', 'organization_name', 'issue_date', 'verification_code', 'grade'];

const DEFAULTS = {
  text: { type: 'text', x: 25, y: 40, width: 50, text: 'Text', fontFamily: 'Inter', fontSize: 24, fontWeight: 600, color: '#111827', align: 'center', lineHeight: 1.3, letterSpacing: 0 },
  image: { type: 'image', x: 40, y: 40, width: 20, height: 20, src: '' },
  logo: { type: 'logo', x: 45, y: 8, width: 12, height: 12, src: '' },
  qr: { type: 'qr', x: 78, y: 72, width: 14 },
  line: { type: 'line', x: 30, y: 55, width: 40, thickness: 2, style: 'solid', color: '#4f46e5' },
  signature: { type: 'signature', x: 15, y: 72, width: 18, height: 10, src: '' },
};

let uid = 0;
const nextId = () => `el_${Date.now()}_${uid++}`;

// Coerce a numeric input to a finite number, falling back to `d` for empty /
// partial / non-numeric input so NaN never gets persisted into the design
// (NaN serializes to null in JSON and corrupts element geometry).
const num = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

export default function TemplateEditorPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['template', id], queryFn: () => apiGet(`/templates/${id}`) });

  const [name, setName] = useState('');
  const [pageSize, setPageSize] = useState('a4-landscape');
  const [design, setDesign] = useState({ background: '#ffffff', elements: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle|saving|saved
  const [previewHtml, setPreviewHtml] = useState(null);
  const canvasRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setPageSize(data.page_size);
      setDesign(data.design || { background: '#ffffff', elements: [] });
    }
  }, [data]);

  const selected = design.elements.find((e) => e.id === selectedId);

  const addElement = (type) => {
    const el = { id: nextId(), ...DEFAULTS[type] };
    setDesign((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  };

  const updateElement = (patch) => {
    setDesign((d) => ({ ...d, elements: d.elements.map((e) => e.id === selectedId ? { ...e, ...patch } : e) }));
  };

  const deleteElement = () => {
    setDesign((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== selectedId) }));
    setSelectedId(null);
  };

  // Dragging elements on the canvas.
  const onMouseDown = (e, el) => {
    e.stopPropagation();
    setSelectedId(el.id);
    drag.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
  };
  const onMouseMove = useCallback((e) => {
    if (!drag.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.current.startY) / rect.height) * 100;
    const nx = Math.max(0, Math.min(100, drag.current.origX + dx));
    const ny = Math.max(0, Math.min(100, drag.current.origY + dy));
    setDesign((d) => ({ ...d, elements: d.elements.map((el) => el.id === drag.current.id ? { ...el, x: nx, y: ny } : el) }));
  }, []);
  const onMouseUp = useCallback(() => { drag.current = null; }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  async function save(publish = false) {
    setSaveState('saving');
    try {
      await apiPatch(`/templates/${id}`, { name, page_size: pageSize, design, ...(publish ? { is_published: true } : {}) });
      setSaveState('saved');
      toast.success(publish ? 'Template published.' : 'Saved.');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (e) { setSaveState('idle'); toast.error(e.message); }
  }

  async function openPreview() {
    await save(false);
    try { const html = (await api.get(`/templates/${id}/preview`)).data; setPreviewHtml(html); }
    catch (e) { toast.error(e.message); }
  }

  const insertVariable = (v) => {
    if (!selected || selected.type !== 'text') return toast.error('Select a text element first.');
    updateElement({ text: `${selected.text || ''}{{${v}}}` });
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div>
      <Link to="/app/templates" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Templates
      </Link>

      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input max-w-xs font-semibold" />
        <Select value={pageSize} onChange={(e) => setPageSize(e.target.value)} className="max-w-[180px]">
          <option value="a4-landscape">A4 Landscape</option>
          <option value="a4-portrait">A4 Portrait</option>
          <option value="letter-landscape">Letter Landscape</option>
          <option value="letter-portrait">Letter Portrait</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {saveState === 'saving' && <span className="text-xs text-muted">Saving…</span>}
          {saveState === 'saved' && <span className="text-xs text-success">Saved</span>}
          <Button variant="secondary" onClick={openPreview}><Eye className="h-4 w-4" /> Preview</Button>
          <Button variant="secondary" onClick={() => save(false)}>Save</Button>
          <Button onClick={() => save(true)}>Publish</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_1fr_260px]">
        {/* Elements */}
        <div className="card h-fit p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted/70">Elements</p>
          <div className="space-y-1">
            <ElBtn icon={Type} label="Text" onClick={() => addElement('text')} />
            <ElBtn icon={Image} label="Image" onClick={() => addElement('image')} />
            <ElBtn icon={Building2} label="Logo" onClick={() => addElement('logo')} />
            <ElBtn icon={QrCode} label="QR Code" onClick={() => addElement('qr')} />
            <ElBtn icon={Minus} label="Line" onClick={() => addElement('line')} />
            <ElBtn icon={PenLine} label="Signature" onClick={() => addElement('signature')} />
          </div>
        </div>

        {/* Canvas */}
        <div className="overflow-hidden rounded-lg border border-line bg-surface p-4">
          <div
            ref={canvasRef}
            onClick={() => setSelectedId(null)}
            className="relative mx-auto w-full max-w-3xl overflow-hidden bg-white shadow-card"
            style={{ aspectRatio: ASPECT[pageSize], background: design.background }}
          >
            {design.elements.map((el) => (
              <ElementView key={el.id} el={el} selected={el.id === selectedId} onMouseDown={onMouseDown} />
            ))}
          </div>
        </div>

        {/* Properties */}
        <div className="card h-fit p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted/70">Properties</p>
          {!selected ? (
            <p className="text-sm text-muted">Select an element to edit it.</p>
          ) : (
            <div className="space-y-3">
              {selected.type === 'text' && (
                <>
                  <Textarea label="Text" value={selected.text} onChange={(e) => updateElement({ text: e.target.value })} />
                  <Select label="Font" value={selected.fontFamily} onChange={(e) => updateElement({ fontFamily: e.target.value })}>
                    <option>Inter</option><option>Playfair Display</option><option>Merriweather</option>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Size" type="number" value={selected.fontSize} onChange={(e) => updateElement({ fontSize: num(e.target.value, 24) })} />
                    <Select label="Weight" value={selected.fontWeight} onChange={(e) => updateElement({ fontWeight: num(e.target.value, 400) })}>
                      <option value={400}>Regular</option><option value={500}>Medium</option><option value={600}>Semibold</option><option value={700}>Bold</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select label="Align" value={selected.align} onChange={(e) => updateElement({ align: e.target.value })}>
                      <option>left</option><option>center</option><option>right</option>
                    </Select>
                    <div><label className="label">Color</label><input type="color" value={selected.color} onChange={(e) => updateElement({ color: e.target.value })} className="h-9 w-full rounded-md border border-line" /></div>
                  </div>
                </>
              )}
              {['image', 'logo', 'signature'].includes(selected.type) && (
                <>
                  <Input label="Image URL" value={selected.src} onChange={(e) => updateElement({ src: e.target.value })} placeholder="https://…" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Width %" type="number" value={selected.width} onChange={(e) => updateElement({ width: num(e.target.value) })} />
                    <Input label="Height %" type="number" value={selected.height} onChange={(e) => updateElement({ height: num(e.target.value) })} />
                  </div>
                </>
              )}
              {selected.type === 'qr' && <Input label="Size %" type="number" value={selected.width} onChange={(e) => updateElement({ width: num(e.target.value) })} />}
              {selected.type === 'line' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Width %" type="number" value={selected.width} onChange={(e) => updateElement({ width: num(e.target.value) })} />
                    <Input label="Thickness" type="number" value={selected.thickness} onChange={(e) => updateElement({ thickness: num(e.target.value, 1) })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select label="Style" value={selected.style} onChange={(e) => updateElement({ style: e.target.value })}><option>solid</option><option>dashed</option></Select>
                    <div><label className="label">Color</label><input type="color" value={selected.color} onChange={(e) => updateElement({ color: e.target.value })} className="h-9 w-full rounded-md border border-line" /></div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input label="X %" type="number" value={Math.round(selected.x)} onChange={(e) => updateElement({ x: num(e.target.value) })} />
                <Input label="Y %" type="number" value={Math.round(selected.y)} onChange={(e) => updateElement({ y: num(e.target.value) })} />
              </div>
              <button onClick={deleteElement} className="btn-ghost w-full text-danger"><Trash2 className="h-4 w-4" /> Delete element</button>
            </div>
          )}

          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted/70">Variables</p>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <button key={v} onClick={() => insertVariable(v)} className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted hover:bg-brand-50 hover:text-brand-700">{`{{${v}}}`}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!previewHtml} onClose={() => setPreviewHtml(null)} title="Preview">
        <iframe title="preview" sandbox="allow-same-origin" srcDoc={previewHtml} className="h-[420px] w-full rounded-md border border-line" />
      </Modal>
    </div>
  );
}

function ElBtn({ icon: Icon, label, onClick }) {
  return <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-surface"><Icon className="h-4 w-4 text-muted" /> {label}</button>;
}

function ElementView({ el, selected, onMouseDown }) {
  const base = {
    position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
    width: el.width != null ? `${el.width}%` : undefined,
    cursor: 'move',
    outline: selected ? '2px solid #4f46e5' : '1px dashed transparent',
    outlineOffset: 2,
  };
  const handle = (e) => onMouseDown(e, el);

  if (el.type === 'text') {
    return <div onMouseDown={handle} style={{ ...base, fontFamily: el.fontFamily, fontSize: el.fontSize, fontWeight: el.fontWeight, color: el.color, textAlign: el.align, lineHeight: el.lineHeight, whiteSpace: 'pre-wrap' }}>{el.text}</div>;
  }
  if (el.type === 'line') {
    return <div onMouseDown={handle} style={{ ...base, borderTop: `${el.thickness}px ${el.style} ${el.color}` }} />;
  }
  if (el.type === 'qr') {
    return <div onMouseDown={handle} style={{ ...base, aspectRatio: '1/1' }} className="grid place-items-center bg-ink text-[8px] text-white">QR</div>;
  }
  // image/logo/signature
  return el.src
    ? <img onMouseDown={handle} src={el.src} alt="" style={{ ...base, height: el.height ? `${el.height}%` : undefined, objectFit: 'contain' }} />
    : <div onMouseDown={handle} style={{ ...base, height: el.height ? `${el.height}%` : '10%' }} className="grid place-items-center border border-dashed border-muted/40 bg-surface text-[10px] text-muted">{el.type}</div>;
}
