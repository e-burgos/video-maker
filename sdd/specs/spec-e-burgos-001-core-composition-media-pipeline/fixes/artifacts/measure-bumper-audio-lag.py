"""Mide el desfase de la voz de un render contra la voz de referencia por correlacion de envolvente.

Uso: python3 measure-bumper-audio-lag.py <render.mp4|mix.wav> <voice.wav> [outro_start_s outro_end_s]
"""

import subprocess
import sys

import numpy as np

SAMPLE_RATE = 8000
WINDOW_MS = 10


def envelope(path: str) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    window = SAMPLE_RATE * WINDOW_MS // 1000
    usable = len(samples) - len(samples) % window
    return np.sqrt((samples[:usable].reshape(-1, window) ** 2).mean(axis=1))


def best_lag_ms(rendered: np.ndarray, reference: np.ndarray) -> tuple[int, float]:
    a = rendered - rendered.mean()
    b = reference - reference.mean()
    correlation = np.correlate(a, b, mode="full")
    norm = np.sqrt((a**2).sum() * (b**2).sum())
    index = int(np.argmax(correlation))
    return (index - (len(b) - 1)) * WINDOW_MS, float(correlation[index] / norm)


def main() -> None:
    rendered = envelope(sys.argv[1])
    reference = envelope(sys.argv[2])
    lag, score = best_lag_ms(rendered, reference)
    print(f"render        : {sys.argv[1]}")
    print(f"reference     : {sys.argv[2]}")
    print(f"render length : {len(rendered) * WINDOW_MS / 1000:.3f} s")
    print(f"lag           : {lag:+d} ms (envelope correlation {score:.4f})")

    if len(sys.argv) >= 5:
        start = int(float(sys.argv[3]) * 1000 / WINDOW_MS)
        end = int(float(sys.argv[4]) * 1000 / WINDOW_MS)
        outro = rendered[start:end]
        body = rendered[:start]
        print(f"outro rms     : {outro.max():.5f} max / {outro.mean():.5f} mean")
        print(f"content rms   : {body.max():.5f} max / {body.mean():.5f} mean")


main()
