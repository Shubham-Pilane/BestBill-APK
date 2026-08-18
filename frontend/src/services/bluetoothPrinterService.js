import html2canvas from 'html2canvas';

// Helper to pad text left/right for ESC/POS alignment
const padText = (str, len, align = 'left') => {
  const s = String(str || '');
  if (s.length >= len) return s.slice(0, len);
  const pad = ' '.repeat(len - s.length);
  return align === 'right' ? pad + s : s + pad;
};

// Word wrap helper
const wordWrap = (str, width) => {
  if (!str) return [];
  const words = String(str).trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length <= width) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      while (currentLine.length > width) {
        lines.push(currentLine.slice(0, width));
        currentLine = currentLine.slice(width);
      }
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
};

// Helper for title casing
const toTitleCase = (str) => {
  return String(str || '').split(' ').map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '').join(' ');
};

// Helper for formatting currency amounts cleanly
const formatAmount = (amt) => {
  const num = Number(amt) || 0;
  return num.toFixed(2);
};

// ESC/POS Command Builder
class EscposBuilder {
  constructor(is58mm = true) {
    this.is58mm = is58mm;
    this.bytes = [0x1B, 0x40]; // ESC @ (Initialize printer)
  }

  alignLeft() {
    this.bytes.push(0x1B, 0x61, 0x00);
    return this;
  }

  alignCenter() {
    this.bytes.push(0x1B, 0x61, 0x01);
    return this;
  }

  alignRight() {
    this.bytes.push(0x1B, 0x61, 0x02);
    return this;
  }

  bold(on = true) {
    this.bytes.push(0x1B, 0x45, on ? 0x01 : 0x00);
    return this;
  }

  setFontDouble() {
    this.bytes.push(0x1D, 0x21, 0x11);
    return this;
  }

  setFontNormal() {
    this.bytes.push(0x1D, 0x21, 0x00);
    return this;
  }

  text(str = '') {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str + '\n');
    for (let i = 0; i < encoded.length; i++) {
      this.bytes.push(encoded[i]);
    }
    return this;
  }

  line(char = '-', length = 32) {
    return this.text(char.repeat(length));
  }

  feed(lines = 3) {
    this.bytes.push(0x1B, 0x64, lines);
    return this;
  }

  cut() {
    this.bytes.push(0x1D, 0x56, 0x41, 0x03);
    return this;
  }

  qrCode(text) {
    if (!text) return this;
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    const len = textBytes.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    this.bytes.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.bytes.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06);
    this.bytes.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30);
    this.bytes.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < textBytes.length; i++) {
      this.bytes.push(textBytes[i]);
    }
    this.bytes.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  build() {
    return new Uint8Array(this.bytes);
  }
}

// Convert HTML Canvas to ESC/POS Raster Bitmap Bytes
export function convertCanvasToEscpos(canvas) {
  const ctx = canvas.getContext('2d');
  const width = Math.floor(canvas.width / 8) * 8;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3] / 255;
    const blendedR = r * a + 255 * (1 - a);
    const blendedG = g * a + 255 * (1 - a);
    const blendedB = b * a + 255 * (1 - a);
    gray[i] = blendedR * 0.299 + blendedG * 0.587 + blendedB * 0.114;
  }

  const bw = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldPixel = gray[idx];
      const newPixel = oldPixel < 160 ? 0 : 255;
      bw[idx] = newPixel === 0 ? 1 : 0;
      const error = oldPixel - newPixel;

      if (x + 1 < width) gray[idx + 1] += error * (7 / 16);
      if (y + 1 < height) {
        if (x > 0) gray[idx + width - 1] += error * (3 / 16);
        gray[idx + width] += error * (5 / 16);
        if (x + 1 < width) gray[idx + width + 1] += error * (1 / 16);
      }
    }
  }

  const bytesPerLine = width / 8;
  const xL = bytesPerLine % 256;
  const xH = Math.floor(bytesPerLine / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  const bytes = [
    0x1B, 0x40, // ESC @
    0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH // ESC/POS GS v 0 raster bitmap
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

  // Feed 3 lines & cut
  bytes.push(0x1B, 0x64, 0x03, 0x1D, 0x56, 0x41, 0x03);

  return new Uint8Array(bytes);
}

// Generate Receipt Bitmap from HTML String via html2canvas
export async function generateReceiptBitmapFromHtml(htmlString, is58mm = true) {
  if (typeof document === 'undefined') return new Uint8Array([]);

  const widthPx = is58mm ? 384 : 576;
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${widthPx}px`;
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = '"Noto Sans Devanagari", "Segoe UI", Arial, sans-serif';
  container.style.padding = '8px';
  container.style.boxSizing = 'border-box';
  container.innerHTML = htmlString;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 1,
      width: widthPx,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    });
    document.body.removeChild(container);
    return convertCanvasToEscpos(canvas);
  } catch (e) {
    if (container.parentNode) document.body.removeChild(container);
    console.error('[HTML2CANVAS ERROR]', e);
    return new Uint8Array([]);
  }
}

// Format KOT with Bitmap HTML Support
export async function formatKOT(data, printerSize = '58mm') {
  const is58mm = printerSize === '58mm';
  const isMarathi = (typeof window !== 'undefined' && localStorage.getItem('app_language') === 'mr') || data.language === 'mr' || /[\u0900-\u097F]/.test(JSON.stringify(data));

  if (isMarathi && typeof document !== 'undefined') {
    const dateStr = new Date().toLocaleString();
    let tableStr = String(data.table || '');
    if (!tableStr.toLowerCase().includes('room') && !tableStr.toLowerCase().includes('parcel') && !tableStr.toLowerCase().includes('टेबल')) {
      tableStr = `टेबल ${tableStr}`;
    }
    if (data.floor && !tableStr.toLowerCase().includes('parcel')) {
      tableStr += ` - ${data.floor}`;
    }

    const itemsHtml = (data.items || []).map(item => {
      const qty = item.quantity || item.qty || 1;
      return `
        <tr style="font-size:16px; border-bottom:1px dashed #bbb;">
          <td style="padding:6px 0; text-align:left; font-weight:bold;">${item.name || ''}</td>
          <td style="padding:6px 0; text-align:right; font-weight:900;">${qty}</td>
        </tr>
      `;
    }).join('');

    const htmlString = `
      <div style="font-family: 'Noto Sans Devanagari', 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; width: 100%; text-align: center;">
        <div style="font-size: 24px; font-weight: 900; margin-bottom: 4px;">किचन ऑर्डर (KOT)</div>
        <div style="border-bottom: 2px solid #000; margin: 8px 0;"></div>
        
        <div style="text-align: left;">
          <div style="font-size: 18px; font-weight: 900;">${tableStr}</div>
          <div style="font-size: 14px; margin-bottom: 6px;">तारीख: ${dateStr}</div>
        </div>

        <div style="border-bottom: 1px solid #000; margin: 6px 0;"></div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="font-size: 16px; font-weight: 900; border-bottom: 1px solid #000;">
              <th style="text-align: left; padding: 4px 0;">पदार्थ</th>
              <th style="text-align: right; padding: 4px 0;">नग</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="border-bottom: 1px solid #000; margin: 6px 0;"></div>

        ${data.notes ? `<div style="font-size: 15px; font-weight: bold; text-align: left; margin: 6px 0;">टिप (NOTES): ${data.notes}</div>` : ''}

        <div style="font-size: 12px; margin-top: 8px; color: #555; text-align: center;">Powered by BestBill POS</div>
      </div>
    `;

    return generateReceiptBitmapFromHtml(htmlString, is58mm);
  }

  const LINE_WIDTH = is58mm ? 32 : 48;
  const builder = new EscposBuilder(is58mm);
  const dateStr = new Date().toLocaleString();

  let tStr = String(data.table || '');
  if (!tStr.toLowerCase().includes('room') && !tStr.toLowerCase().includes('parcel')) {
    tStr = `Table ${tStr}`;
  }

  builder.alignCenter()
    .setFontDouble()
    .bold()
    .text('KITCHEN ORDER')
    .setFontNormal()
    .bold(false)
    .line('=', LINE_WIDTH)
    .alignLeft()
    .bold();

  wordWrap(tStr, LINE_WIDTH).forEach(l => builder.text(l));

  builder.bold(false)
    .text(`DATE: ${dateStr}`)
    .line('-', LINE_WIDTH)
    .setFontNormal();

  const qtyLen = is58mm ? 4 : 6;
  const itemLen = LINE_WIDTH - qtyLen - 1;

  builder.bold(true).text(padText('ITEM', itemLen) + ' ' + padText('QTY', qtyLen, 'right')).bold(false);
  builder.line('-', LINE_WIDTH);

  data.items.forEach(item => {
    const qty = item.quantity || item.qty || 1;
    const nameStr = toTitleCase(String(item.name || ''));
    const wrappedName = wordWrap(nameStr, itemLen);

    if (wrappedName.length === 0) {
      builder.text(padText('', itemLen) + ' ' + padText(qty, qtyLen, 'right'));
    } else {
      builder.text(padText(wrappedName[0], itemLen) + ' ' + padText(qty, qtyLen, 'right'));
      for (let i = 1; i < wrappedName.length; i++) {
        builder.text(padText(wrappedName[i], itemLen) + ' ' + ' '.repeat(qtyLen));
      }
    }
  });

  builder.setFontNormal()
    .bold(false)
    .line('-', LINE_WIDTH);

  if (data.notes) {
    builder.bold().text('NOTES:');
    wordWrap(String(data.notes), LINE_WIDTH).forEach(l => builder.text(l));
    builder.bold(false).line('-', LINE_WIDTH);
  }

  builder.alignCenter()
    .bold(true)
    .text('Powered by BestBill POS')
    .bold(false);

  builder.feed(3).cut();
  return builder.build();
}

// Format Bill with HTML Bitmap Raster Support
export async function formatBill(data, printerSize = '58mm') {
  const is58mm = printerSize === '58mm';
  const isMarathi = (typeof window !== 'undefined' && localStorage.getItem('app_language') === 'mr') || data.language === 'mr' || /[\u0900-\u097F]/.test(JSON.stringify(data));

  if (isMarathi && typeof document !== 'undefined') {
    const isCancelOrder = data.type === 'CANCEL_ORDER' || data.isCancelOrder;
    const billNoStr = data.billId || data.orderNumber || data.order_number || data.id || 'N/A';
    const billLabel = isCancelOrder ? 'रद्द ऑर्डर क्र.:' : 'बिल क्र.:';
    const dateStr = new Date().toLocaleString();

    let tableStr = '';
    if (data.table) {
      let tStr = String(data.table);
      if (!tStr.toLowerCase().includes('room') && !tStr.toLowerCase().includes('parcel') && !tStr.toLowerCase().includes('टेबल')) {
        tStr = `टेबल ${tStr}`;
      }
      tableStr = `<div style="font-size:16px; font-weight:bold; margin-bottom:4px;">${tStr}</div>`;
    }

    const itemsHtml = (data.items || []).map(item => {
      const qty = item.quantity || item.qty || 1;
      const rate = Number(item.price || 0).toFixed(2);
      const amt = (Number(item.price || 0) * qty).toFixed(2);
      return `
        <tr style="font-size:15px; border-bottom:1px dashed #ccc;">
          <td style="padding:5px 0; text-align:left; font-weight:bold;">${item.name || ''}</td>
          <td style="padding:5px 0; text-align:center;">${qty}</td>
          <td style="padding:5px 0; text-align:right;">${rate}</td>
          <td style="padding:5px 0; text-align:right; font-weight:bold;">${amt}</td>
        </tr>
      `;
    }).join('');

    const gstPct = Number(data.gst_percentage) || 0;
    const gstAmt = Number(data.gst) || 0;
    let gstHtml = '';
    if (gstPct > 0 || gstAmt > 0) {
      gstHtml = `<div style="display:flex; justify-content:space-between; font-size:15px; margin-top:4px;"><span>जीएसटी (${gstPct}%):</span><span>₹${gstAmt.toFixed(2)}</span></div>`;
    }

    let discHtml = '';
    if (data.discountPercentage > 0) {
      const preVal = Number(data.subtotal || 0) + Number(data.gst || 0);
      const discAmt = preVal * (data.discountPercentage / 100);
      discHtml = `<div style="display:flex; justify-content:space-between; font-size:15px; margin-top:4px;"><span>सवलत (${data.discountPercentage}%):</span><span>-₹${discAmt.toFixed(2)}</span></div>`;
    }

    const finalAmountToDisplay = data.finalAmount !== undefined && data.finalAmount !== null
      ? Number(data.finalAmount)
      : (data.totalAmount !== undefined && data.totalAmount !== null
          ? Number(data.totalAmount)
          : Number(data.total_amount || 0));

    const htmlString = `
      <div style="font-family: 'Noto Sans Devanagari', 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; width: 100%; text-align: center;">
        <div style="font-size: 24px; font-weight: 900; margin-bottom: 4px;">${data.hotelName || 'BestBill POS'}</div>
        ${data.hotelLocation ? `<div style="font-size: 14px;">${data.hotelLocation}</div>` : ''}
        ${data.hotelPhone ? `<div style="font-size: 14px;">Phone: ${data.hotelPhone}</div>` : ''}
        ${data.hotelFssai ? `<div style="font-size: 14px;">FSSAI: ${data.hotelFssai}</div>` : ''}
        
        <div style="border-bottom: 2px solid #000; margin: 8px 0;"></div>
        
        <div style="text-align: left;">
          <div style="font-size: 17px; font-weight: 900;">${billLabel} ${billNoStr}</div>
          ${tableStr}
          <div style="font-size: 14px; margin-bottom: 6px;">तारीख: ${dateStr}</div>
        </div>

        <div style="border-bottom: 1px solid #000; margin: 6px 0;"></div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="font-size: 15px; font-weight: 900; border-bottom: 1px solid #000;">
              <th style="text-align: left; padding: 4px 0;">पदार्थ</th>
              <th style="text-align: center; padding: 4px 0;">नग</th>
              <th style="text-align: right; padding: 4px 0;">दर</th>
              <th style="text-align: right; padding: 4px 0;">रक्कम</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="border-bottom: 1px solid #000; margin: 6px 0;"></div>

        ${gstHtml}
        ${discHtml}

        <div style="display: flex; justify-content: space-between; font-size: 22px; font-weight: 900; margin-top: 8px; border-top: 2px solid #000; padding-top: 6px;">
          <span>एकूण देय:</span>
          <span>₹${finalAmountToDisplay.toFixed(2)}</span>
        </div>

        <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

        <div style="font-size: 16px; font-weight: 900; margin-top: 8px;">धन्यवाद! पुन्हा भेट द्या.</div>
        <div style="font-size: 12px; margin-top: 4px; color: #555;">Powered by BestBill POS</div>
      </div>
    `;

    return generateReceiptBitmapFromHtml(htmlString, is58mm);
  }

  const LINE_WIDTH = is58mm ? 32 : 48;
  const builder = new EscposBuilder(is58mm);
  const dateStr = new Date().toLocaleString();

  builder.alignCenter();

  builder.setFontDouble().bold();
  const hotelNameLines = wordWrap(data.hotelName || 'BestBill POS', Math.floor(LINE_WIDTH / 2));
  hotelNameLines.forEach(l => builder.text(l));
  builder.setFontNormal().bold(false);

  if (data.hotelLocation) {
    wordWrap(data.hotelLocation, LINE_WIDTH).forEach(l => builder.text(l));
  }
  if (data.hotelPhone) builder.text(`Phone: ${data.hotelPhone}`);
  if (data.hotelFssai) builder.text(`FSSAI: ${data.hotelFssai}`);

  const isCancelOrder = data.type === 'CANCEL_ORDER' || data.isCancelOrder;
  const billNoStr = data.billId || data.orderNumber || data.order_number || data.id || 'N/A';
  const billLabel = isCancelOrder ? 'CANCEL ORDER NO:' : 'BILL NO:';

  builder.line('=', LINE_WIDTH)
    .alignLeft()
    .bold()
    .text(`${billLabel} ${billNoStr}`);

  if (data.table) {
    wordWrap(String(data.table), LINE_WIDTH).forEach(l => builder.text(l));
  }

  builder.bold(false)
    .text(`Date: ${dateStr}`)
    .line('-', LINE_WIDTH);

  const qtyLen = is58mm ? 3 : 4;
  const rateLen = is58mm ? 6 : 8;
  const amtLen = is58mm ? 6 : 8;
  const itemLen = LINE_WIDTH - qtyLen - rateLen - amtLen - 3;

  builder.bold(true).text(
    padText('ITEM', itemLen) + ' ' +
    padText('QTY', qtyLen, 'right') + ' ' +
    padText('RATE', rateLen, 'right') + ' ' +
    padText('AMT', amtLen, 'right')
  ).bold(false);

  builder.line('-', LINE_WIDTH);

  (data.items || []).forEach(item => {
    const qty = item.quantity || item.qty || 1;
    const rate = formatAmount(item.price);
    const amt = formatAmount(item.price * qty);
    const nameStr = toTitleCase(String(item.name || ''));
    const wrappedName = wordWrap(nameStr, itemLen);

    if (wrappedName.length === 0) {
      builder.text(
        padText('', itemLen) + ' ' +
        padText(qty, qtyLen, 'right') + ' ' +
        padText(rate, rateLen, 'right') + ' ' +
        padText(amt, amtLen, 'right')
      );
    } else {
      builder.text(
        padText(wrappedName[0], itemLen) + ' ' +
        padText(qty, qtyLen, 'right') + ' ' +
        padText(rate, rateLen, 'right') + ' ' +
        padText(amt, amtLen, 'right')
      );
      for (let i = 1; i < wrappedName.length; i++) {
        builder.text(
          padText(wrappedName[i], itemLen) + ' ' +
          ' '.repeat(qtyLen) + ' ' +
          ' '.repeat(rateLen) + ' ' +
          ' '.repeat(amtLen)
        );
      }
    }
  });

  builder.line('-', LINE_WIDTH);

  const labelLen = LINE_WIDTH - amtLen - 1;
  const gstPct = Number(data.gst_percentage) || 0;
  const gstAmt = Number(data.gst) || 0;
  if (gstPct > 0 || gstAmt > 0) {
    builder.text(padText(`GST (${gstPct}%):`, labelLen) + ' ' + padText(formatAmount(gstAmt), amtLen, 'right'));
  }

  if (data.discountPercentage > 0) {
    const preVal = Number(data.subtotal) + Number(data.gst);
    const discAmt = preVal * (data.discountPercentage / 100);
    builder.text(padText(`Discount (${data.discountPercentage}%):`, labelLen) + ' ' + padText(`-${formatAmount(discAmt)}`, amtLen, 'right'));
  }

  const finalAmountToDisplay = data.finalAmount !== undefined && data.finalAmount !== null
    ? Number(data.finalAmount)
    : (data.totalAmount !== undefined && data.totalAmount !== null
        ? Number(data.totalAmount)
        : Number(data.total_amount || 0));

  builder.line('-', LINE_WIDTH)
    .bold(true)
    .text(padText('GRAND TOTAL:', labelLen) + ' ' + padText(formatAmount(finalAmountToDisplay), amtLen, 'right'))
    .bold(false)
    .line('=', LINE_WIDTH);

  if (data.upiId) {
    const upiLink = `upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(data.hotelName || '')}&am=${data.finalAmount}&cu=INR`;
    builder.alignCenter()
      .bold(true)
      .text('SCAN TO PAY WITH ANY UPI APP')
      .bold(false)
      .qrCode(upiLink)
      .text(`UPI ID: ${data.upiId}`)
      .line('-', LINE_WIDTH);
  }

  builder.alignCenter()
    .bold(true)
    .text('THANK YOU! VISIT AGAIN')
    .bold(false);

  builder.feed(3).cut();
  return builder.build();
}

// Convert logo image to ESC/POS monochrome bitmap
export async function convertImageToEscpos(url, maxWidth = 300) {
  return new Promise((resolve) => {
    if (!url) { resolve([]); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        let targetWidth = Math.min(img.width || maxWidth, maxWidth);
        targetWidth = Math.floor(targetWidth / 8) * 8;
        if (targetWidth < 8) targetWidth = 8;
        const aspect = img.height / img.width;
        const width = targetWidth;
        const height = Math.round(width * aspect);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(Array.from(convertCanvasToEscpos(canvas)));
      } catch (e) {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

// Bluetooth Printer Manager
export class BluetoothPrinterService {
  static getSelectedPrinter(type = 'billing') {
    if (type === 'kot') {
      return localStorage.getItem('cfg_bluetooth_mac_kot') || localStorage.getItem('cfg_bluetooth_mac') || '';
    }
    return localStorage.getItem('cfg_bluetooth_mac') || '';
  }

  static getPrinterSize(type = 'billing') {
    if (type === 'kot') {
      return localStorage.getItem('cfg_printer_size_kot') || localStorage.getItem('cfg_printer_size') || '58mm';
    }
    return localStorage.getItem('cfg_printer_size') || '58mm';
  }

  static async isBluetoothEnabled() {
    return new Promise((resolve) => {
      if (!window.bluetoothSerial || typeof window.bluetoothSerial.isEnabled !== 'function') {
        resolve(true);
        return;
      }
      try {
        window.bluetoothSerial.isEnabled(
          () => resolve(true),
          () => resolve(false)
        );
      } catch (err) {
        resolve(false);
      }
    });
  }

  static async checkPrinterConnection(macAddress) {
    if (!macAddress) return false;
    if (typeof window === 'undefined' || !window.bluetoothSerial) return true;
    return new Promise((resolve) => {
      try {
        window.bluetoothSerial.isConnected(() => resolve(true), () => resolve(false));
      } catch (e) {
        resolve(true);
      }
    });
  }

  static async printData(uint8Array, targetMacAddress = null) {
    try {
      const macAddress = targetMacAddress || this.getSelectedPrinter('billing');
      if (!macAddress) {
        return false;
      }
      if (!window.bluetoothSerial) {
        return true;
      }
      const btEnabled = await this.isBluetoothEnabled();
      if (!btEnabled) return false;

      return new Promise((resolve) => {
        try {
          window.bluetoothSerial.connect(
            macAddress,
            () => {
              window.bluetoothSerial.write(
                uint8Array.buffer,
                () => resolve(true),
                () => resolve(false)
              );
            },
            () => resolve(false)
          );
        } catch (e) {
          resolve(false);
        }
      });
    } catch (err) {
      return false;
    }
  }

  static bootstrap() {
    window.addEventListener('print-job-triggered', async (e) => {
      try {
        const job = e.detail;
        let printBytes;
        let targetMac;

        if (job.type === 'KOT') {
          const size = this.getPrinterSize('kot');
          targetMac = this.getSelectedPrinter('kot');
          printBytes = await formatKOT(job, size);
        } else if (job.type === 'FINAL_BILL' || job.type === 'CANCEL_ORDER') {
          const size = this.getPrinterSize('billing');
          targetMac = this.getSelectedPrinter('billing');
          printBytes = await formatBill(job, size);
        }

        if (printBytes) {
          await this.printData(printBytes, targetMac);
        }
      } catch (err) {
        console.error('[BT PRINTER EVENT ERR]', err);
      }
    });
  }
}
