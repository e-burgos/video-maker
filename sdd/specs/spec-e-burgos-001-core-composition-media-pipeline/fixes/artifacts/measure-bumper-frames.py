"""Extrae un frame de un render y reporta el color de fondo y la caja del logo dibujado.

Uso: python3 measure-bumper-frames.py <render.mp4> <salida.jpg> <segundo>
"""

import subprocess
import sys

WIDTH = 1080
BAND_HEIGHT = 600
BAND_TOP = 660
INK_LUMINANCE_MAX = 200


def frame_rgb(path: str, second: str, crop: str) -> bytes:
    return subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", second, "-i", path, "-frames:v", "1",
         "-vf", f"{crop},format=rgb24", "-f", "rawvideo", "-"],
        capture_output=True,
        check=True,
    ).stdout


def luminance(pixel: tuple[int, int, int]) -> float:
    return 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2]


def main() -> None:
    render, out, second = sys.argv[1], sys.argv[2], sys.argv[3]
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", second, "-i", render, "-frames:v", "1", "-q:v", "3", out],
        check=True,
    )

    scaled = frame_rgb(render, second, "scale=160:-1")
    pixels = [scaled[i : i + 3] for i in range(0, len(scaled), 3)]
    mean = tuple(round(sum(pixel[channel] for pixel in pixels) / len(pixels)) for channel in range(3))

    band = frame_rgb(render, second, f"crop={WIDTH}:{BAND_HEIGHT}:0:{BAND_TOP}")
    ink = [
        ((index // 3) % WIDTH, (index // 3) // WIDTH)
        for index in range(0, len(band), 3)
        if luminance((band[index], band[index + 1], band[index + 2])) < INK_LUMINANCE_MAX
    ]

    print(f"t={second}s  mean rgb={mean}  corner={tuple(pixels[0])}")
    if not ink:
        print("  centre band: no ink")
        return
    xs = [point[0] for point in ink]
    ys = [point[1] for point in ink]
    print(f"  centre band: ink={len(ink)} px  bbox x {min(xs)}-{max(xs)} (w={max(xs) - min(xs) + 1}) y {min(ys)}-{max(ys)}")


main()
