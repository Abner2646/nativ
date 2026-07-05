# Nativ — Admin Design System
**Version:** 1.0  
**Scope:** Panel de administración (todo lo bajo `/dashboard`, `/restaurant/*`, `/account`, `/onboarding`)  
**Audience:** Restaurant owners (no guests)

---

## Inconsistencias con los manuales de marca actuales

### ❌ 1. Color de fondo incorrecto
El Manual Visual define **Midnight (#0F1720)** como color principal.  
El admin actual usa `gray-950` de Tailwind = `#030712` (negro casi puro).  
Son distintos. El admin debe usar `#0F1720` como base.

### ❌ 2. Satoshi ausente del admin
El Manual dice: *"Headings: Satoshi (Bold/Semibold)"*.  
En el admin **todo usa Inter**, incluyendo los títulos de página, secciones y métricas.  
Contradicción directa con el Manual Visual.

### ❌ 3. Gold (#C9A96E) no se usa en el admin
El Manual lo define como "acentos premium".  
En el admin no aparece en ningún lugar: botones, métricas, highlights.

### ❌ 4. Sage (#6F8F7B) no se usa en el admin
Definido como acento secundario. Ausente del admin.

### ✅ 5. Sin contradicción real en el principio "el restaurante es el héroe"
El Brand OS dice que el restaurante debe sentirse protagonista. Esto aplica a las **páginas públicas** (lo que ve el cliente). El panel admin es una herramienta interna — aquí Nativ puede y debe tener personalidad visual fuerte. No hay conflicto.

### ⚠️ 6. Adición necesaria al Manual Visual
El Manual no documenta el dark theme del admin. Debe extenderse para cubrir este caso de uso.

---

## Paleta del admin (dark)

Construida sobre los tokens del Brand Manual, adaptada al contexto oscuro.

| Token | Hex | Tailwind custom | Uso |
|-------|-----|-----------------|-----|
| `midnight` | `#0F1720` | `bg-midnight` | Fondo de página |
| `surface` | `#162232` | — | Cards, panels |
| `surface-raised` | `#1C2D42` | — | Cards hover, dropdowns |
| `border` | `rgba(255,255,255,0.06)` | — | Bordes sutiles |
| `border-strong` | `rgba(255,255,255,0.12)` | — | Bordes activos |
| `text-primary` | `#F2EFE9` | `text-offwhite` | Texto principal |
| `text-secondary` | `rgba(242,239,233,0.5)` | — | Labels, subtítulos |
| `text-tertiary` | `rgba(242,239,233,0.25)` | — | Placeholders, disabled |
| `gold` | `#C9A96E` | `text-gold` | Acentos premium, highlight de métricas |
| `sage` | `#6F8F7B` | `text-sage` | Estados positivos, success |
| `error` | `#e05555` | — | Errores |
| `warning` | `#d4a843` | — | Alertas (trial, warnings) |

---

## Tipografía

**Regla:** Satoshi para todo lo que sea titular, número o elemento de jerarquía. Inter para cuerpo de texto, labels, inputs.

| Elemento | Fuente | Peso | Tamaño | Uso |
|----------|--------|------|--------|-----|
| Page title (H1) | Satoshi | Bold 700 | 22–24px | Título principal de cada página |
| Section title (H2) | Satoshi | SemiBold 600 | 15–16px | Secciones dentro de una página |
| Stat number | Satoshi | Bold 700 | 32–40px | Métricas grandes |
| Stat label | Inter | SemiBold 600 | 11px, uppercase, tracking-wide | Etiqueta de métrica |
| Body text | Inter | Regular 400 | 14–15px | Texto descriptivo |
| Table cell | Inter | Regular/Medium | 14px | Datos en tablas |
| Label (input) | Inter | SemiBold 600 | 11px, uppercase | Labels de formulario |
| Badge | Inter | SemiBold 600 | 11px | Status pills |
| Navigation | Inter | Medium 500 | 13–14px | Sidebar links |

---

## Componentes

### Card de estadísticas

```
background: #162232
border: 1px solid rgba(255,255,255,0.06)
border-radius: 14px
padding: 24px
```

- Número: Satoshi Bold, 36px, color `#F2EFE9`
- Label: Inter SemiBold, 11px, uppercase, tracking-widest, color `rgba(242,239,233,0.4)`
- Unidad/subtexto: Inter Regular, 13px, color `rgba(242,239,233,0.4)`
- Acento: borde izquierdo de 2px en Gold para la métrica más importante del día

### Card de restaurante (dashboard selector)

```
background: #162232
border: 1px solid rgba(255,255,255,0.06)
border-radius: 14px
padding: 20px 24px
hover: background #1C2D42, border rgba(255,255,255,0.12)
transition: 150ms
```

- Logo: 44x44px, border-radius 10px
- Nombre: Satoshi SemiBold, 15px, `#F2EFE9`
- Dominio + rol: Inter Regular, 13px, `rgba(242,239,233,0.4)`
- Status badge: ver Badges

### Badges de estado

| Estado | Background | Texto | Borde |
|--------|-----------|-------|-------|
| active | `rgba(111,143,123,0.15)` | `#6F8F7B` (sage) | `rgba(111,143,123,0.3)` |
| trial | `rgba(212,168,67,0.12)` | `#d4a843` | `rgba(212,168,67,0.25)` |
| inactive | `rgba(224,85,85,0.12)` | `#e05555` | `rgba(224,85,85,0.25)` |

```
border-radius: 9999px
padding: 3px 10px
font: Inter SemiBold 11px
```

### Tablas

- Header: Inter SemiBold 11px, uppercase, tracking-widest, `rgba(242,239,233,0.35)`
- Row: border-bottom `rgba(255,255,255,0.04)`
- Row hover: background `rgba(255,255,255,0.025)`
- Padding: 12px 16px por celda

### Inputs (admin)

```
background: rgba(0,0,0,0.25)
border: 1px solid rgba(255,255,255,0.08)
border-radius: 10px
padding: 10px 14px
color: #F2EFE9
font: Inter 14px
focus border: rgba(255,255,255,0.2)
```

### Botón primario (admin)

```
background: #F2EFE9
color: #0F1720
font: Satoshi SemiBold 14px
border-radius: 10px
padding: 10px 20px
hover: opacity 0.9
```

### Botón secundario (admin)

```
background: transparent
border: 1px solid rgba(255,255,255,0.12)
color: rgba(242,239,233,0.7)
font: Inter Medium 14px
border-radius: 10px
padding: 10px 20px
hover border: rgba(255,255,255,0.25)
```

### Separadores de sección

```
border-top: 1px solid rgba(255,255,255,0.06)
```

Con label opcional:
```
font: Inter SemiBold 11px
text-transform: uppercase
letter-spacing: 0.12em
color: rgba(242,239,233,0.3)
```

---

## Espaciado y layout

- Padding de página: `p-8` (32px) en desktop
- Gap entre secciones: `gap-8` (32px)
- Gap entre cards en grid: `gap-5` (20px)
- Max width del contenido: ninguno para dashboards (full), `max-w-2xl` para formularios/settings

---

## Notas de implementación

1. **Satoshi ya está cargado** en `root layout.tsx` para toda la app — no requiere cambios.
2. **Los tokens de Tailwind** (`midnight`, `sage`, `sand`, `offwhite`, `gold`) ya están en `tailwind.config.ts` — usarlos directamente.
3. **`surface` y `surface-raised`** ya están en `tailwind.config.ts` — usar `bg-surface`, `bg-surface-raised`.
4. El color `surface` (#162232) es Midnight con +18% de luminosidad — mantiene coherencia con la paleta.
