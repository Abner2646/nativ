'use client'
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RestaurantTable, TableShape, SeatingArea } from '@/lib/types'
import { Circle, Square, RectangleHorizontal, RotateCw, Trash2, Plus } from 'lucide-react'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

// Coordenadas en unidades de grilla 0–100. x,y = centro de la mesa.
// width y height se expresan en % del ANCHO del canvas; al renderizar,
// la altura se divide por el aspect ratio para que un cuadrado se vea cuadrado.
const GRID_SNAP = 2.5
const CANVAS_ASPECT = 3 / 4 // height = width * 0.75

// Altura de la mesa en unidades del eje Y (0-100 del alto del canvas)
function hUnits(t: { height: number }) { return t.height / CANVAS_ASPECT }

// Tamaños predefinidos por forma (en unidades de grilla)
const SIZES: Record<TableShape, Record<'S' | 'M' | 'L', { w: number; h: number }>> = {
  round:  { S: { w: 8,  h: 8  }, M: { w: 11, h: 11 }, L: { w: 14, h: 14 } },
  square: { S: { w: 8,  h: 8  }, M: { w: 11, h: 11 }, L: { w: 14, h: 14 } },
  rect:   { S: { w: 14, h: 8  }, M: { w: 18, h: 9  }, L: { w: 24, h: 10 } },
}

const SHAPES: { value: TableShape; label: string; icon: typeof Circle }[] = [
  { value: 'round',  label: 'Round',     icon: Circle },
  { value: 'square', label: 'Square',    icon: Square },
  { value: 'rect',   label: 'Rectangle', icon: RectangleHorizontal },
]

function sizeOf(t: RestaurantTable): 'S' | 'M' | 'L' {
  const presets = SIZES[t.shape]
  if (t.width <= presets.S.w) return 'S'
  if (t.width <= presets.M.w) return 'M'
  return 'L'
}

function snap(v: number) { return Math.round(v / GRID_SNAP) * GRID_SNAP }
function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }

const inputCls = 'w-full bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/25'
const labelCls = 'text-xs text-offwhite/35 uppercase tracking-widest mb-1.5 block font-semibold'
const card = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

interface Props {
  initialTables: RestaurantTable[]
  areas: SeatingArea[]
  slug: string
}

export function FloorPlanClient({ initialTables, areas, slug }: Props) {
  const [tables, setTables]         = useState<RestaurantTable[]>(initialTables)
  const [activeAreaId, setActiveAreaId] = useState<string | null>(areas[0]?.id ?? null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [pendingDelete, setPendingDelete] = useState<RestaurantTable | null>(null)
  const [deleting, setDeleting]     = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  // Drag state fuera de React para no re-renderizar en cada pointermove
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null)

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const patchTable = useCallback(async (id: string, patch: Partial<RestaurantTable>) => {
    setSaving(true)
    try {
      const res = await adminFetch(`resource=tables&id=${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to save')
        return false
      }
      return true
    } finally { setSaving(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const areaTables = tables.filter(t => t.seating_area_id === activeAreaId && t.is_active)
  const selected   = tables.find(t => t.id === selectedId) ?? null

  // ── Crear mesa ──────────────────────────────────────────────
  const addTable = async (shape: TableShape) => {
    if (!activeAreaId) return
    const size = SIZES[shape].M
    // Nombre autoincremental: T1, T2, …
    const existing = tables.filter(t => t.seating_area_id === activeAreaId)
    let n = existing.length + 1
    const names = new Set(existing.map(t => t.name))
    while (names.has(`T${n}`)) n++

    const body = {
      seating_area_id: activeAreaId, name: `T${n}`, shape,
      min_covers: 1, max_covers: shape === 'rect' ? 6 : 4,
      x: 50, y: 50, width: size.w, height: size.h, rotation: 0,
    }
    const res = await adminFetch('resource=tables', { method: 'POST', body: JSON.stringify(body) })
    if (res.ok) {
      const data = await res.json()
      setTables(prev => [...prev, data.table])
      setSelectedId(data.table.id)
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to create table')
    }
  }

  // ── Drag ────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent, t: RestaurantTable) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { id: t.id, startX: e.clientX, startY: e.clientY, origX: t.x, origY: t.y, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const dx = ((e.clientX - drag.startX) / rect.width) * 100
    const dy = ((e.clientY - drag.startY) / rect.height) * 100
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) drag.moved = true
    if (!drag.moved) return
    setTables(prev => prev.map(t => {
      if (t.id !== drag.id) return t
      const halfW = t.width / 2, halfH = hUnits(t) / 2
      return {
        ...t,
        x: clamp(drag.origX + dx, halfW, 100 - halfW),
        y: clamp(drag.origY + dy, halfH, 100 - halfH),
      }
    }))
  }

  const onPointerUp = (t: RestaurantTable) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (!drag.moved) { setSelectedId(t.id); return }
    // Snap y persistir
    setTables(prev => prev.map(tb => {
      if (tb.id !== drag.id) return tb
      const halfW = tb.width / 2, halfH = hUnits(tb) / 2
      const x = clamp(snap(tb.x), halfW, 100 - halfW)
      const y = clamp(snap(tb.y), halfH, 100 - halfH)
      patchTable(tb.id, { x, y })
      return { ...tb, x, y }
    }))
    setSelectedId(t.id)
  }

  // ── Ediciones del panel ─────────────────────────────────────
  const updateSelected = (patch: Partial<RestaurantTable>) => {
    if (!selected) return
    setTables(prev => prev.map(t => t.id === selected.id ? { ...t, ...patch } : t))
    patchTable(selected.id, patch)
  }

  const changeShape = (shape: TableShape) => {
    if (!selected || selected.shape === shape) return
    const size = SIZES[shape][sizeOf(selected)]
    updateSelected({ shape, width: size.w, height: size.h })
  }

  const changeSize = (s: 'S' | 'M' | 'L') => {
    if (!selected) return
    const size = SIZES[selected.shape][s]
    updateSelected({ width: size.w, height: size.h })
  }

  const rotate = () => {
    if (!selected) return
    updateSelected({ rotation: (selected.rotation + 45) % 180 })
  }

  const doDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await adminFetch(`resource=tables&id=${pendingDelete.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setTables(prev => prev.filter(t => t.id !== pendingDelete.id))
      if (selectedId === pendingDelete.id) setSelectedId(null)
      toast.success('Table deleted')
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to delete')
    }
    setPendingDelete(null)
  }

  // ── Sin áreas ───────────────────────────────────────────────
  if (areas.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl" style={card}>
        <p className="text-sm text-offwhite/40 mb-4">You need at least one seating area before drawing your floor plan.</p>
        <Link href={`/restaurant/${slug}/areas`}
          className="inline-block bg-offwhite text-midnight font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors">
          Create a seating area →
        </Link>
      </div>
    )
  }

  return (
    <div>
      <ConfirmModal
        open={!!pendingDelete}
        title={`Delete "${pendingDelete?.name}"?`}
        message="This table will be permanently removed from your floor plan."
        confirmLabel="Delete table"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {/* ── Area tabs + add buttons ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {areas.map(a => {
            const count = tables.filter(t => t.seating_area_id === a.id && t.is_active).length
            const active = a.id === activeAreaId
            return (
              <button key={a.id}
                onClick={() => { setActiveAreaId(a.id); setSelectedId(null) }}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'text-offwhite' : 'text-offwhite/40 hover:text-offwhite/70'
                }`}
                style={active
                  ? { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }
                  : { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                }>
                {a.name}
                {count > 0 && <span className="ml-1.5 text-xs text-offwhite/30">{count}</span>}
              </button>
            )
          })}
        </div>
        {saving && <span className="text-xs text-offwhite/30">Saving…</span>}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Canvas ── */}
        <div className="flex-1 w-full min-w-0">
          {/* Add table toolbar */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-offwhite/30 mr-1 flex items-center gap-1.5">
              <Plus size={12} /> Add table
            </span>
            {SHAPES.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => addTable(value)}
                title={`Add ${label.toLowerCase()} table`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-offwhite/50 hover:text-offwhite transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Icon size={13} strokeWidth={1.6} />
                {label}
              </button>
            ))}
          </div>

          <div
            ref={canvasRef}
            className="relative w-full rounded-2xl overflow-hidden select-none touch-none"
            style={{
              paddingBottom: `${CANVAS_ASPECT * 100}%`,
              backgroundColor: '#101c2b',
              border: '1px solid rgba(255,255,255,0.07)',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '2.5% 3.333%',
            }}
            onPointerDown={e => { if (e.target === e.currentTarget) setSelectedId(null) }}
          >
            {areaTables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-offwhite/20">Add your first table with the buttons above</p>
              </div>
            )}

            {areaTables.map(t => {
              const isSelected = t.id === selectedId
              return (
                <div
                  key={t.id}
                  onPointerDown={e => onPointerDown(e, t)}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => onPointerUp(t)}
                  className="absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing"
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: `${t.width}%`,
                    height: `${hUnits(t)}%`,
                    transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
                    borderRadius: t.shape === 'round' ? '50%' : '14%',
                    backgroundColor: isSelected ? 'rgba(201,169,110,0.20)' : 'rgba(255,255,255,0.07)',
                    border: isSelected ? '2px solid #C9A96E' : '1.5px solid rgba(255,255,255,0.18)',
                    transition: dragRef.current?.id === t.id ? 'none' : 'border-color 0.15s ease, background-color 0.15s ease',
                    zIndex: isSelected ? 2 : 1,
                  }}
                >
                  <span
                    className="font-semibold pointer-events-none"
                    style={{
                      fontSize: 'clamp(10px, 1.4vw, 14px)',
                      color: isSelected ? '#C9A96E' : 'rgba(242,239,233,0.85)',
                      transform: `rotate(${-t.rotation}deg)`,
                    }}>
                    {t.name}
                  </span>
                  <span
                    className="pointer-events-none"
                    style={{
                      fontSize: 'clamp(8px, 1vw, 11px)',
                      color: 'rgba(242,239,233,0.35)',
                      transform: `rotate(${-t.rotation}deg)`,
                    }}>
                    {t.min_covers === t.max_covers ? t.max_covers : `${t.min_covers}–${t.max_covers}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Edit panel ── */}
        <div className="w-full lg:w-72 shrink-0 rounded-2xl p-5" style={card}>
          {!selected ? (
            <p className="text-sm text-offwhite/30 text-center py-8">
              Select a table to edit it,<br />or add one from the toolbar.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-satoshi font-bold text-[15px] text-offwhite">Edit table</h3>
                <button onClick={() => setPendingDelete(selected)}
                  className="p-1.5 rounded-lg text-offwhite/25 hover:text-red-400 transition-colors"
                  title="Delete table">
                  <Trash2 size={15} strokeWidth={1.6} />
                </button>
              </div>

              <div>
                <label className={labelCls}>Name</label>
                <input
                  value={selected.name}
                  onChange={e => setTables(prev => prev.map(t => t.id === selected.id ? { ...t, name: e.target.value } : t))}
                  onBlur={e => { const v = e.target.value.trim(); if (v) patchTable(selected.id, { name: v }) }}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Shape</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SHAPES.map(({ value, label, icon: Icon }) => (
                    <button key={value} onClick={() => changeShape(value)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] transition-colors ${
                        selected.shape === value ? 'text-offwhite' : 'text-offwhite/35 hover:text-offwhite/60'
                      }`}
                      style={selected.shape === value
                        ? { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.20)' }
                        : { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                      }>
                      <Icon size={15} strokeWidth={1.6} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Size</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['S', 'M', 'L'] as const).map(s => (
                    <button key={s} onClick={() => changeSize(s)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                        sizeOf(selected) === s ? 'text-offwhite' : 'text-offwhite/35 hover:text-offwhite/60'
                      }`}
                      style={sizeOf(selected) === s
                        ? { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.20)' }
                        : { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                      }>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Min covers</label>
                  <input type="number" min={1} max={selected.max_covers} value={selected.min_covers}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 1
                      updateSelected({ min_covers: clamp(v, 1, selected.max_covers) })
                    }}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Max covers</label>
                  <input type="number" min={selected.min_covers} max={30} value={selected.max_covers}
                    onChange={e => {
                      const v = parseInt(e.target.value) || selected.min_covers
                      updateSelected({ max_covers: clamp(v, selected.min_covers, 30) })
                    }}
                    className={inputCls} />
                </div>
              </div>

              <button onClick={rotate}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-offwhite/50 hover:text-offwhite transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <RotateCw size={14} strokeWidth={1.6} />
                Rotate 45° ({selected.rotation}°)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
