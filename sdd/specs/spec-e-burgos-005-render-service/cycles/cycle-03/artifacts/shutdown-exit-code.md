# SIGTERM exit code after an in-process Remotion render — measured

`architect.md` §13.3 expects `exit=0` on `SIGTERM`. The smoke observed **143** (`128 + 15`).
Isolated with two runs of the same binary, same environment, on 2026-09-09:

| Run | What it did before `SIGTERM` | `wait` exit status | Shutdown time |
| --- | --- | --- | --- |
| A | started, `GET /health`, nothing else | **0** | immediate |
| B | started, ran one render job to `succeeded`, then `SIGTERM` | **143** | 46 ms |

Run A proves the service's own graceful shutdown is correct: `main.ts` registers
`process.once('SIGTERM')`, awaits `server.close()` and sets `process.exitCode = 0`.

## Cause

`@remotion/renderer` installs its own process-level signal handlers to clean up the browser it
keeps alive — `node_modules/@remotion/renderer/dist/browser/BrowserRunner.js:191-196`:

```js
listeners.push(addEventListener(process, 'SIGINT', () => { killProcess(); process.exit(130); }));
listeners.push(addEventListener(process, 'SIGTERM', closeProcess));
listeners.push(addEventListener(process, 'SIGHUP', closeProcess));
```

Once a render has run in this process, those listeners are live and the process is terminated with
the signal status before our asynchronous `server.close()` chain completes. 46 ms rules out a hang:
the process dies promptly, it just dies with `143` instead of exiting `0`.

## Attempted fix, rejected

Replacing `process.exitCode = 0` with an explicit `process.exit(0)` after `server.close()` was
tried and measured: **still 143**. The change was reverted — a change that does not fix the symptom
does not stay in the tree.

## Recommendation (descoped, on purpose)

Do not chase this inside the process: fixing it would mean reaching into a third-party dependency's
internal listener list. The clean fix is the one already descoped for another reason — **run the
render in a separate worker process**, which is the same change needed to raise concurrency above 1.
Until then, the exit code after a render is **not part of the service's contract**, and the graceful
shutdown guarantee is the one run A proves. `apps/web` (`spec-006`) consumes HTTP, not exit codes.
