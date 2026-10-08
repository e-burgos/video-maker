const HEIGHT = 140;
const BASELINE = 96;
const FONT_SIZE = 96;
const CHARACTER_WIDTH = 66;
const HORIZONTAL_PADDING = 80;
const MIN_WIDTH = 240;

function escapeXml(text: string): string {
  return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');
}

export function wordmarkSvg(name: string, fontBase64: string): string {
  const width = Math.max(MIN_WIDTH, name.length * CHARACTER_WIDTH + HORIZONTAL_PADDING);
  const fontFace = `<style>@font-face{font-family:"Outfit";src:url(data:font/woff2;base64,${fontBase64}) format("woff2");font-weight:100 900}</style>`;
  const text = `<text x="${width / 2}" y="${BASELINE}" text-anchor="middle" font-family="Outfit, sans-serif" font-weight="700" font-size="${FONT_SIZE}" fill="#ffffff">${escapeXml(name)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${HEIGHT}" width="${width}" height="${HEIGHT}">${fontFace}${text}</svg>\n`;
}
