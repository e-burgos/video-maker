# spec-014 cycle-01 — aceptación real sobre `media/demo-01` y `media/smoke-ingest`

> Fecha: 2026-09-10 · Máquina del dev (Darwin arm64) · Binarios del `.env`
> (`/opt/homebrew/bin/ffmpeg`, `ffprobe`). Guiones que produjeron cada número, en este mismo
> directorio: `measure-music-bed.ts` (mezcla y mide) y `render-muted.ts` (render mudo + sha256).
> Gate previo a cada corrida pesada: `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless|piper'` vacío,
> memoria libre 48–58 %, `df -h /` con 91 Gi. Un job pesado a la vez.

## Comando

```bash
pnpm nx run render-cli:cli -- run media/demo-01 --preset hardware --seed 0 \
  --script media/demo-01/work/producer/script.txt
```

Reporte literal de la etapa `plan`:

```
ok [plan] work/timeline.json
  edl: work/edl.json
  edited-duration-ms: 25928
  transcription-source: catalog
  concepts: 3
    estilo
    lentes
    mirada
  broll-overlays: 3
  broll-rejections: 7
  logo: raw/logo/Logo-ancho-transparente.png
  script-corrections: 7
    replaced: 5 removed: 2 inserted: 0 dropped: 0
ok [render] out/demo-01.mp4
  format: 1080x1920@30
  frames: 778
```

## CA-001 · CA-002 — La música se escucha

Medición `ebur128` sobre la salida del **mismo grafo del mix** (`mixTimelineAudio`), con la pista
de voz vaciada para aislar la cama. `before` = código en `f51cb99` + la Timeline anterior;
`after` = este ciclo.

| Pista aislada | before | after | Δ |
| --- | --- | --- | --- |
| Cama de música | **-47,5 LUFS** (TP -23,4 dBFS) | **-29,2 LUFS** (TP -8,2 dBFS) | **+18,3 dB** |
| Voz | -14,2 LUFS (TP -4,0 dBFS) | -14,2 LUFS (TP -4,0 dBFS) | 0 |
| Mezcla completa | -14,2 LUFS (TP -3,8 dBFS) | -14,2 LUFS (TP -2,5 dBFS) | 0 |

- **CA-001 ✔** — la cama cae en **-29,2 LUFS**, dentro de la ventana pedida `[-30, -26]`, con la
  voz en -14,2 LUFS (dentro de -15 ± 1). La diferencia voz→música pasa de **33,3 dB** (inaudible)
  a **15,0 dB** (presente bajo la voz), que es el rango de publicidad que pidió el dev.
- **CA-002 ✔** — `verifyMixLoudness` con el `VoiceTarget` de la Timeline (I -14, TP -1, LRA 11):
  integrado -14,2 (Δ -0,2 LU, tolerancia ±1) y true peak -2,5 dBFS (≤ -1). Dentro de tolerancia.

Cadena de la cama, literal, tal como la emite `buildAudioMixGraph` (la normalización va **antes**
de la automatización, y `apad` lleva `whole_dur`):

```
[1:a]atrim=start=0:end=25.933333333,asetpts=PTS-STARTPTS,adelay=0:all=1,
volume=6.3dB,
volume=volume='min(1,pow(10,(lt(t,0)*(-4)+gte(t,0)*lt(t,0.066666667)*((-4)+(-120)*(t-0))+gte(t,0.066666667)*lt(t,26.066666667)*((-12)+(0)*(t-0.066666667))+gte(t,26.066666667)*lt(t,26.466666667)*((-12)+(20)*(t-26.066666667))+gte(t,26.466666667)*(-4))/20))':eval=frame,
apad=whole_dur=25.933333333,atrim=end=25.933333333[music0]
```

`volume=6.3dB` es exactamente `referenceLufs (-16) − integratedLufs (-22,3)` medido por el ingest
y persistido en `work/catalog.json` (`raw/audio/music01.mp3 → audio.integratedLufs: -22.3`).

El MP4 entregado por la CLI (`out/demo-01.mp4`) usa el `<Audio>` de Remotion, no el grafo de
ffmpeg: mide **-15,5 LUFS** integrados / TP -2,8 dBFS (778 frames, 1080x1920@30). Su cama recibe
la misma ganancia derivada — `volumeAtFrame(automation, f, +6,3 dB)` → `-12 + 6,3 = -5,7 dB` sobre
una pista de -22,3 LUFS, es decir ≈ **-28 LUFS** contra los ≈ -46 LUFS de antes. Ese número es
**derivado**, no medido con `ebur128` (aislar la cama del camino Remotion pide un render entero);
la fórmula la fija `audio-track.spec.tsx`.

## CA-003 — Las captions dicen lo que dice la voz

`demo-01-captions-before-after.json` tiene las 29 (antes) y 28 (después) captions completas.
Las 72 palabras de las captions pertenecen **todas** al guion; 0 palabras ajenas.

| Guion | Whisper oyó | Después |
| --- | --- | --- |
| `dice` | `hice` | `dice` |
| `calma.` | `kanma.` | `calma.` |
| `y estilo` | `y de estilo` | `y estilo` (se borra el `de` inventado) |
| `contacto,` | `contacto` | `contacto,` |
| `necesitás` | `necesitas` | `necesitás` |
| `Vení` | `Ven` `y` | `Vení` (dos palabras fundidas en el span completo) |

Total: `replaced: 5, removed: 2, inserted: 0, dropped: 0` → **7 correcciones**. Los tres conceptos
(`estilo`, `lentes`, `mirada`) se siguen detectando y hay 3 overlays de B-roll.

## CA-004 — El logo

`demo-01-frame-5s.png` y `demo-01-frame-20s.png`, extraídos del entregable real
(`ffmpeg -ss <t> -i out/demo-01.mp4 -frames:v 1`). En los dos, el logo de la óptica aparece en el
**margen inferior derecho**, entero dentro del cuadro y sin tocar las captions, que van centradas.
`work/timeline.json → logo`:

```json
{
  "assetId": "raw/logo/Logo-ancho-transparente.png",
  "position": "bottom-right",
  "widthRatio": 0.32,
  "marginRatio": 0.035,
  "opacity": 1
}
```

## CA-005 — No-regresión del video

`render-muted.ts` sobre `media/smoke-ingest` con **la misma** `work/timeline.json`:

| Código | sha256 de `video-muted.mp4` |
| --- | --- |
| `f51cb99` (antes del ciclo, worktree limpio) | `cf0cf4a61433e3288467a9d5ab619654f8527ab6a91d90e9930512b5a37d5d2a` |
| este ciclo | `cf0cf4a61433e3288467a9d5ab619654f8527ab6a91d90e9930512b5a37d5d2a` |

**Byte-idéntico ✔** (538 frames, 1080x1920@30 en las dos corridas).

> ⚠️ El oráculo que traía el pedido,
> `c1b9fd9f33ba69263d9806acd02b212d44adb3951e1927d9b64f44d04c8527cb`, es de
> `spec-006 cycle-03` y **quedó obsoleto antes de este ciclo**: `5bdf7e9`
> (`FIX-e-burgos-003-001`) cambió a propósito el layout de las captions, y `media/smoke-ingest`
> se replanificó desde entonces (556 → 538 frames). Por eso la no-regresión se midió contra un
> render real del commit base `f51cb99` en un worktree aparte, que es el baseline vigente. El
> oráculo del pedido no reproduce ni con el código viejo.
