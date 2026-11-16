# spec-e-burgos-025-liquid-glass-rebrand cycle-02 — 2026-11-13

## Qué pasó
El render-api del studio, levantado horas antes con `pnpm studio`, empezó a devolver 500 en `/health` después de varios `pnpm add` del día. Una instancia nueva con el mismo código respondía `ok`. Un subagente tuvo que simular la salud del servicio para capturar el espacio de trabajo, y otra sesión que necesitaba el studio lo encontró caído.

## Lección
Después de instalar o quitar dependencias con el studio corriendo, reiniciar el render-api (`pnpm studio:stop` y `pnpm studio`, avisando a las demás sesiones). Para diagnosticar sin tocarlo, levantar una instancia aislada con `RENDER_API_PORT`, `RENDER_API_MEDIA_ROOT` y `RENDER_API_DB_PATH` temporales.

## Costo evitable
Capturas con salud simulada y una sesión ajena bloqueada.
