#!/usr/bin/env node
const HEX = /^#?([0-9a-f]{6})$/iu;
const MIN_TEXT_RATIO = 4.5;
const MIN_ACCENT_RATIO = 3;

function parseHex(value) {
  const match = HEX.exec(value.trim());
  if (!match) throw new Error(`not a #rrggbb color: ${value}`);
  const hex = match[1];
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function linearChannel(channel) {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map(linearChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground, background) {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

function verdict(ratio, minimum) {
  return ratio >= minimum ? 'ok' : `FAIL (needs ${minimum})`;
}

function report([background, text, accent, accent2]) {
  const rows = [
    ['text on background', text, MIN_TEXT_RATIO],
    ['accent on background', accent, MIN_ACCENT_RATIO],
    ['accent2 on background', accent2, MIN_ACCENT_RATIO],
  ];
  const lines = rows.map(([label, color, minimum]) => {
    const ratio = contrastRatio(color, background);
    return { label, color, ratio, ok: ratio >= minimum, text: `${label.padEnd(22)} ${color} on ${background}: ${ratio}:1 ${verdict(ratio, minimum)}` };
  });
  const textOnAccent = contrastRatio(text, accent);
  lines.push({ label: 'text on accent', ok: true, text: `${'text on accent'.padEnd(22)} ${text} on ${accent}: ${textOnAccent}:1 (info: buttons and chips)` });
  return lines;
}

const colors = process.argv.slice(2);
if (colors.length !== 4) {
  process.stderr.write('usage: node contrast.mjs <background> <text> <accent> <accent2>   (each #rrggbb)\n');
  process.exit(2);
}
const lines = report(colors);
process.stdout.write(`${lines.map((line) => line.text).join('\n')}\n`);
process.exitCode = lines.every((line) => line.ok) ? 0 : 1;
