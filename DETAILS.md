# DETAILS.md — Mejoras de detalle y UX
*Lista de pulidos, mejoras visuales y funcionalidades pequeñas que elevan la experiencia sin ser features grandes.*
*Cada ítem es independiente y se puede desarrollar en una sesión corta.*

---

## Floor plan

**✅ 1. Indicador visual en reservas grandes (+8 personas)**
Las reservas de grupo grande necesitan atención especial del host (setup de mesas, comunicación con cocina). Mostrar un badge numérico o color distinto en las cards del floor plan para party_size ≥ 8.

**✅ 2. Tiempo transcurrido en mesas ocupadas**
En la vista de servicio, mostrar cuánto tiempo lleva sentada una mesa ("1h 20m"). Ayuda al host a gestionar el ritmo de turnos sin tener que calcular manualmente.

**✅ 3. Tags del guest visibles en el floor plan**
Si un guest tiene tags como "VIP", "Alérgico", "Cumpleaños", mostrarlos como íconos o pills en la card de la mesa. El personal de servicio necesita verlos sin abrir el detalle.

**✅ 4. Bloqueo de mesa individual**
Hoy se pueden bloquear fechas enteras. Falta poder marcar una mesa específica como fuera de servicio (ej: mesa rota, reservada para evento privado) sin afectar el resto.

**✅ 5. Vista de mesas disponibles ahora**
Botón rápido en el floor plan que filtra y resalta solo las mesas libres en el turno activo. Útil para walk-ins y para el host que necesita responder rápido.

---

## Lista de reservas

**✅ 6. Badge de visita en la card de reserva**
Mostrar "1ª visita", "3ª visita" etc. junto al nombre del guest en la lista de reservas. El host puede personalizar el trato sin tener que abrir el perfil del guest.

**✅ 7. Mesa asignada visible en la lista**
Si la reserva tiene una mesa asignada, mostrarla directamente en la card/fila ("Mesa 4"). Hoy requiere abrir el floor plan para verlo.

**✅ 8. Acción rápida de "Llegó" sin abrir modal**
Un botón de check directo en la lista de reservas para marcar que el guest llegó, sin tener que abrir el modal de detalle. Ahorra 2-3 clicks en el momento de mayor tráfico.

**✅ 9. Filtro de reservas por área**
En la lista de reservas, poder filtrar por área (Main dining, Outdoor patio). Útil para restaurantes con zonas separadas atendidas por distintos hosts.

**✅ 10. Export de reservas a CSV**
Botón de export en la lista de reservas con los filtros activos. Los propietarios suelen necesitar esto para reportes o para compartir con el equipo.

---

## Widget de reservas público

**✅ 11. Contador de disponibilidad limitada**
Cuando quedan pocos lugares en un horario (ej: ≤ 3 disponibles), mostrar "Últimos 3 lugares" para generar urgencia. El threshold debería ser configurable en settings.

**✅ 12. Horarios llenos visualmente distintos**
Los horarios sin disponibilidad aparecen deshabilitados pero sin una razón clara. Mostrar "Completo" en lugar de simplemente griseado mejora la comprensión del usuario.

**✅ 13. Link "Agregar al calendario" en el email de confirmación**
Incluir un link de Google Calendar y un archivo .ics en el email de confirmación. Reduce no-shows porque el guest tiene la reserva en su agenda.

**✅ 14. Campo de cumpleaños opcional en el widget**
Recolectar el cumpleaños del guest en el momento de reservar (opcional, con explicación "para sorprenderte"). Alimenta el sistema de campañas de cumpleaños sin esfuerzo extra.

---

## Guests

**✅ 15. Avatar con iniciales**
Reemplazar el placeholder genérico por un avatar generado con las iniciales del guest y un color determinístico basado en el nombre. Hace la lista de guests más legible y reconocible.

**✅ 16. Historial de reservas en el perfil del guest**
En el split-view del guest, mostrar las últimas 5-10 reservas con fecha, party size y estado. Hoy el perfil muestra datos pero no el historial completo.

**✅ 17. Nota de preferencias del guest**
Campo de texto libre en el perfil del guest para anotar preferencias operativas ("siempre pide la mesa del fondo", "alérgico al maní", "prefiere pagar en efectivo"). Distinto de los tags — es información narrativa.

**✅ 18. Guests duplicados — merge**
Cuando un guest reserva con el mismo teléfono pero distinto email (o viceversa), se crean perfiles duplicados. Un botón de "merge guests" en la vista de detalle evitaría el problema manual.

---

## Panel de admin — general

**✅ 19. Notificación in-app de nueva reserva**
Un toast o banner que aparece en tiempo real cuando llega una reserva nueva, sin necesidad de recargar la página. Usar Supabase Realtime.

**20. Confirmación de email antes de mandar** *(skipped — no UI de creación manual)*
En el flujo de creación manual de reserva, mostrar un preview del email de confirmación antes de enviarlo. El admin puede cancelar el envío si cometió un error.

**✅ 21. Dashboard con gráfico de reservas por semana**
La página principal del restaurante muestra stats numéricas. Un mini gráfico de barras de las últimas 4 semanas daría contexto visual rápido sobre tendencias.

**✅ 22. Indicador de "turno activo ahora"**
En el sidebar o header del panel, mostrar si hay un turno en curso actualmente (basado en la hora local y los shifts configurados). El admin sabe de un vistazo si el restaurante está "abierto" o no.

---

## Mobile

**✅ 23. Swipe para acciones rápidas en reservas**
En mobile, swipe izquierda en una reserva para cancelar, swipe derecha para marcar como completada. Patrón estándar en mobile que ahorra tiempo al personal.

**24. Bottom sheet de detalle de mesa en floor plan** *(skipped — FloorService demasiado complejo)*
Al tocar una mesa en mobile, el bottom sheet debería mostrar la info más importante arriba (nombre, party size, tiempo transcurrido) antes de mostrar acciones. Hoy el scroll puede ser confuso.

---

## Emails

**✅ 25. Footer consistente con unsubscribe**
Los emails de campaña deberían tener un footer con "Dejar de recibir emails de [restaurante]" para cumplir con CAN-SPAM/GDPR y reducir riesgo de que Resend bloquee el dominio por spam.

**✅ 26. Preview de email de cumpleaños en el panel**
En la config de cumpleaños, mostrar un preview del email tal como lo va a recibir el guest (con variables reemplazadas). Hoy el admin configura el template sin verlo renderizado.

---

## Operaciones y retención

**✅ 27. Status "no-show" en reservas**
Agregar "no-show" como estado posible. Se aplica cuando el restaurante marca que el guest no apareció. No incrementa visit_count. Requiere migración 017.

**✅ 28. Vista de impresión de reservas del día**
Botón "Print" genera una hoja limpia con la lista de reservas del día: hora, nombre, party size, área, mesa, notas. Diseñada para imprimirse en A4 y usarse en el host stand.

**✅ 29. Export CSV de guests**
Botón de export en la página de guests que descarga la lista filtrada (nombre, email, teléfono, visitas, cumpleaños, tags, notas). Útil para el restaurante para reportes externos.

**✅ 30. Filtro de cumpleaños este mes en guests**
Toggle en la barra de búsqueda de guests que muestra solo los guests con cumpleaños en el mes actual. Permite enviar outreach de cumpleaños manualmente sin depender de la campaña automática.

**✅ 31. Tasa de retorno de guests en dashboard**
Porcentaje de guests que visitaron más de una vez. Métrica de fidelización visible en el card "Last 7 days" del dashboard. Calculado en el servidor en cada carga.
