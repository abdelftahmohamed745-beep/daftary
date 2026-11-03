'use strict';

/**
 * Code 39 barcode encoder — no dependencies.
 * Each pattern is 9 modules: 1 = wide, 0 = narrow, alternating bar/space
 * starting with a bar. Characters are wrapped in the '*' start/stop guard.
 */
const CODE39 = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  A: '100001001',
  B: '001001001',
  C: '101001000',
  D: '000011001',
  E: '100011000',
  F: '001011000',
  G: '000001101',
  H: '100001100',
  I: '001001100',
  J: '000011100',
  K: '100000011',
  L: '001000011',
  M: '101000010',
  N: '000010011',
  O: '100010010',
  P: '001010010',
  Q: '000000111',
  R: '100000110',
  S: '001000110',
  T: '000010110',
  U: '110000001',
  V: '011000001',
  W: '111000000',
  X: '010010001',
  Y: '110010000',
  Z: '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  $: '010101000',
  '/': '010100010',
  '+': '010001010',
  '%': '000101010',
  '*': '010010100',
};

export function sanitizeBarcode(value) {
  return String(value || '')
    .toUpperCase()
    .split('')
    .filter((char) => CODE39[char] && char !== '*')
    .join('');
}

export function barcodeHTML(value, { height = 44, narrow = 1.6, showText = true, className = '' } = {}) {
  const text = sanitizeBarcode(value);
  if (!text) return '';
  const sequence = `*${text}*`;
  const wide = narrow * 3;
  let x = 0;
  const rects = [];
  for (let index = 0; index < sequence.length; index += 1) {
    const pattern = CODE39[sequence[index]];
    for (let module = 0; module < pattern.length; module += 1) {
      const isBar = module % 2 === 0;
      const width = pattern[module] === '1' ? wide : narrow;
      if (isBar) {
        rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${height}" fill="currentColor"/>`);
      }
      x += width;
    }
    if (index < sequence.length - 1) x += narrow;
  }
  const width = Math.ceil(x);
  const label = showText ? `<span class="barcode-text" dir="ltr">${text}</span>` : '';
  return `<svg class="barcode ${className}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="باركود ${text}" preserveAspectRatio="none">${rects.join('')}</svg>${label}`;
}

export function barcodeSVG(value, options) {
  return barcodeHTML(value, options);
}
