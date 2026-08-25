/**
 * Devanagari (Marathi) Hybrid ESC/POS Thermal Printing Renderer
 * Provides Unicode Devanagari detection, Canvas 2D text shaping,
 * and 1-bit monochrome ESC/POS GS v 0 raster command generation.
 */

// Helper to check if text contains Devanagari characters
export function containsDevanagari(text) {
  if (!text) return false;
  return /[\u0900-\u097F]/.test(String(text));
}

// Convert HTML5 Canvas to raw ESC/POS GS v 0 raster bitmap bytes (no feed/cut)
export function canvasToEscposRaster(canvas) {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return new Uint8Array([]);
  }

  const ctx = canvas.getContext('2d');
  const width = Math.floor(canvas.width / 8) * 8;
  const height = canvas.height;
  if (width === 0 || height === 0) return new Uint8Array([]);

  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const bw = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3] / 255;
    const blendedR = r * a + 255 * (1 - a);
    const blendedG = g * a + 255 * (1 - a);
    const blendedB = b * a + 255 * (1 - a);
    const gray = blendedR * 0.299 + blendedG * 0.587 + blendedB * 0.114;
    bw[i] = gray < 180 ? 1 : 0; // 1 = black pixel (printed dot), 0 = white pixel (threshold 180 for sharp Devanagari Matras)
  }

  const bytesPerLine = width / 8;
  const xL = bytesPerLine % 256;
  const xH = Math.floor(bytesPerLine / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  // GS v 0 raster command header
  const bytes = [
    0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < bytesPerLine; x++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        const px = x * 8 + b;
        if (bw[y * width + px] === 1) {
          byte |= (1 << (7 - b));
        }
      }
      bytes.push(byte);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Render a single line or block of Devanagari text as an ESC/POS raster bitmap command.
 * @param {string} text - The Devanagari / Marathi string to render.
 * @param {Object} options - Rendering configurations.
 * @param {string} [options.paperSize='58mm'] - '58mm' (384 dots) or '80mm' (576 dots).
 * @param {number} [options.fontSize=26] - Font size in pixels.
 * @param {string} [options.fontWeight='normal'] - 'normal' or 'bold'.
 * @param {string} [options.align='left'] - 'left', 'center', or 'right'.
 * @param {number} [options.lineHeight=36] - Height per line of text in dots.
 * @returns {Uint8Array} ESC/POS raster command bytes.
 */
export function renderDevanagariLineToRaster(text, options = {}) {
  if (typeof document === 'undefined' || !text) {
    return new Uint8Array([]);
  }

  const paperSize = options.paperSize || '58mm';
  const totalWidth = paperSize === '80mm' ? 576 : 384;
  const fontSize = options.fontSize || (options.isDouble ? 34 : 26);
  const fontWeight = options.fontWeight || (options.isDouble || options.bold ? 'bold' : 'normal');
  const align = options.align || 'left';
  const lineHeight = options.lineHeight || Math.ceil(fontSize * 1.4);

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  const ctx = canvas.getContext('2d');

  const fontStack = `${fontWeight} ${fontSize}px "Noto Sans Devanagari", "Mukta", "Devanagari", "Segoe UI", Arial, sans-serif`;
  ctx.font = fontStack;

  // Measure text and perform word wrapping within totalWidth
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width <= totalWidth - 8) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);

  if (lines.length === 0) return new Uint8Array([]);

  const totalHeight = lines.length * lineHeight + 8;
  canvas.height = totalHeight;

  // Clear background to solid white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Set up text styles
  ctx.fillStyle = '#000000';
  ctx.font = fontStack;
  ctx.textBaseline = 'top';

  lines.forEach((lineText, index) => {
    const metrics = ctx.measureText(lineText);
    let x = 0;
    if (align === 'center') {
      x = Math.max(0, (totalWidth - metrics.width) / 2);
    } else if (align === 'right') {
      x = Math.max(0, totalWidth - metrics.width - 4);
    } else {
      x = 2; // Left margin padding
    }

    const y = index * lineHeight + 4;
    ctx.fillText(lineText, x, y);
  });

  return canvasToEscposRaster(canvas);
}

/**
 * Render Marathi Table Header Row (पदार्थ + नग + दर + रक्कम) as ESC/POS raster bitmap command.
 * Perfectly aligns column titles with the item rows below.
 * @param {Object} options - Paper size configurations.
 * @returns {Uint8Array} ESC/POS raster command bytes.
 */
export function renderHeaderRowToRaster(options = {}) {
  if (typeof document === 'undefined') {
    return new Uint8Array([]);
  }

  const paperSize = options.paperSize || '58mm';
  const is58mm = paperSize === '58mm';
  const totalWidth = is58mm ? 384 : 576;
  const fontSize = options.fontSize || 24;
  const lineHeight = Math.ceil(fontSize * 1.4);

  const itemColWidth = is58mm ? 160 : 260;
  const qtyColWidth = is58mm ? 44 : 60;
  const rateColWidth = is58mm ? 90 : 128;
  const amtColWidth = is58mm ? 90 : 128;

  const itemX = 0;
  const qtyX = itemColWidth;
  const rateX = qtyX + qtyColWidth;
  const amtX = rateX + rateColWidth;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = lineHeight + 6;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, canvas.height);

  const fontStack = `bold ${fontSize}px "Noto Sans Devanagari", "Mukta", "Devanagari", "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.font = fontStack;
  ctx.textBaseline = 'top';

  const primaryY = 3;

  // Item Title (पदार्थ)
  ctx.fillText('पदार्थ', itemX + 2, primaryY);

  // Qty Title (नग)
  const qtyMetrics = ctx.measureText('नग');
  const qtyDrawX = qtyX + Math.max(0, (qtyColWidth - qtyMetrics.width) / 2);
  ctx.fillText('नग', qtyDrawX, primaryY);

  // Rate Title (दर)
  const rateMetrics = ctx.measureText('दर');
  const rateDrawX = rateX + Math.max(0, rateColWidth - rateMetrics.width - 2);
  ctx.fillText('दर', rateDrawX, primaryY);

  // Amt Title (रक्कम)
  const amtMetrics = ctx.measureText('रक्कम');
  const amtDrawX = amtX + Math.max(0, amtColWidth - amtMetrics.width - 2);
  ctx.fillText('रक्कम', amtDrawX, primaryY);

  return canvasToEscposRaster(canvas);
}

/**
 * Render a table item row (Devanagari Item Name + QTY + RATE + AMT) as an ESC/POS raster bitmap command.
 * Ensures Marathi item names align seamlessly with item columns while maintaining QTY, RATE, and AMT alignment.
 * @param {Object} itemData - Item row details.
 * @param {string} itemData.name - Item name (Marathi or mixed).
 * @param {number|string} itemData.qty - Item quantity.
 * @param {number|string} itemData.rate - Item rate.
 * @param {number|string} itemData.amt - Item total amount.
 * @param {Object} options - Paper size and column configurations.
 * @returns {Uint8Array} ESC/POS raster command bytes.
 */
export function renderItemRowToRaster(itemData, options = {}) {
  if (typeof document === 'undefined' || !itemData) {
    return new Uint8Array([]);
  }

  const paperSize = options.paperSize || '58mm';
  const is58mm = paperSize === '58mm';
  const totalWidth = is58mm ? 384 : 576;
  const fontSize = options.fontSize || 25;
  const lineHeight = Math.ceil(fontSize * 1.4);

  // Column dot widths allocation
  // 58mm: Item 160px | Qty 44px | Rate 90px | Amt 90px (Total = 384px)
  // 80mm: Item 260px | Qty 60px | Rate 128px | Amt 128px (Total = 576px)
  const itemColWidth = is58mm ? 160 : 260;
  const qtyColWidth = is58mm ? 44 : 60;
  const rateColWidth = is58mm ? 90 : 128;
  const amtColWidth = is58mm ? 90 : 128;

  const itemX = 0;
  const qtyX = itemColWidth;
  const rateX = qtyX + qtyColWidth;
  const amtX = rateX + rateColWidth;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  const ctx = canvas.getContext('2d');

  const fontStack = `normal ${fontSize}px "Noto Sans Devanagari", "Mukta", "Devanagari", "Segoe UI", Arial, sans-serif`;
  ctx.font = fontStack;

  // Wrap Marathi item name into item column width
  const words = String(itemData.name || '').trim().split(/\s+/);
  const nameLines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width <= itemColWidth - 4) {
      currentLine = testLine;
    } else {
      if (currentLine) nameLines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) nameLines.push(currentLine);
  if (nameLines.length === 0) nameLines.push('');

  const totalHeight = nameLines.length * lineHeight + 6;
  canvas.height = totalHeight;

  // Solid white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Set black text styling
  ctx.fillStyle = '#000000';
  ctx.font = fontStack;
  ctx.textBaseline = 'top';

  // Render Item Name (Marathi / Devanagari) line by line
  nameLines.forEach((lineText, idx) => {
    const y = idx * lineHeight + 3;
    ctx.fillText(lineText, itemX + 2, y);
  });

  // Render QTY, RATE, AMT on the primary line (top line)
  const primaryY = 3;
  const qtyStr = String(itemData.qty || '1');
  const rateStr = String(itemData.rate || '0');
  const amtStr = String(itemData.amt || '0');

  // QTY: Center aligned in QTY column
  const qtyMetrics = ctx.measureText(qtyStr);
  const qtyDrawX = qtyX + Math.max(0, (qtyColWidth - qtyMetrics.width) / 2);
  ctx.fillText(qtyStr, qtyDrawX, primaryY);

  // RATE: Right aligned in RATE column
  const rateMetrics = ctx.measureText(rateStr);
  const rateDrawX = rateX + Math.max(0, rateColWidth - rateMetrics.width - 2);
  ctx.fillText(rateStr, rateDrawX, primaryY);

  // AMT: Right aligned in AMT column
  const amtMetrics = ctx.measureText(amtStr);
  const amtDrawX = amtX + Math.max(0, amtColWidth - amtMetrics.width - 2);
  ctx.fillText(amtStr, amtDrawX, primaryY);

  return canvasToEscposRaster(canvas);
}

/**
 * Render KOT Item Row (Devanagari Item Name + QTY) as ESC/POS raster bitmap command.
 * @param {Object} itemData - KOT Item details.
 * @param {string} itemData.name - Item name (Marathi or mixed).
 * @param {number|string} itemData.qty - Item quantity.
 * @param {Object} options - Paper size configurations.
 * @returns {Uint8Array} ESC/POS raster command bytes.
 */
export function renderKOTItemRowToRaster(itemData, options = {}) {
  if (typeof document === 'undefined' || !itemData) {
    return new Uint8Array([]);
  }

  const paperSize = options.paperSize || '58mm';
  const is58mm = paperSize === '58mm';
  const totalWidth = is58mm ? 384 : 576;
  const fontSize = options.fontSize || 24;
  const lineHeight = Math.ceil(fontSize * 1.4);

  const qtyColWidth = is58mm ? 64 : 80;
  const itemColWidth = totalWidth - qtyColWidth;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  const ctx = canvas.getContext('2d');

  // Normal weight for KOT item names as requested
  const fontStack = `normal ${fontSize}px "Noto Sans Devanagari", "Mukta", "Devanagari", "Segoe UI", Arial, sans-serif`;
  ctx.font = fontStack;

  const words = String(itemData.name || '').trim().split(/\s+/);
  const nameLines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width <= itemColWidth - 4) {
      currentLine = testLine;
    } else {
      if (currentLine) nameLines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) nameLines.push(currentLine);
  if (nameLines.length === 0) nameLines.push('');

  const totalHeight = nameLines.length * lineHeight + 6;
  canvas.height = totalHeight;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  ctx.fillStyle = '#000000';
  ctx.font = fontStack;
  ctx.textBaseline = 'top';

  nameLines.forEach((lineText, idx) => {
    const y = idx * lineHeight + 3;
    ctx.fillText(lineText, 2, y);
  });

  const qtyStr = String(itemData.qty || '1');
  const qtyMetrics = ctx.measureText(qtyStr);
  const qtyDrawX = itemColWidth + Math.max(0, qtyColWidth - qtyMetrics.width - 4);
  ctx.fillText(qtyStr, qtyDrawX, 3);

  return canvasToEscposRaster(canvas);
}
