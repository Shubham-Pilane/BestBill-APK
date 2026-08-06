import { toast } from 'react-hot-toast';

const formatAmount = (val) => {
  const num = Number(val) || 0;
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
};

const padText = (text, length, align = 'left') => {
  text = String(text !== undefined && text !== null ? text : '');
  if (text.length > length) {
    return text.substring(0, length);
  }
  if (align === 'right') return text.padStart(length, ' ');
  if (align === 'center') {
    const pad = Math.floor((length - text.length) / 2);
    return ' '.repeat(pad) + text + ' '.repeat(length - text.length - pad);
  }
  return text.padEnd(length, ' ');
};

const toTitleCase = (str) => {
  return str.split(' ').map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '').join(' ');
};

class EscposBuilder {
  constructor(is58mm = true) {
    this.bytes = [0x1B, 0x40, 0x1B, 0x32, 0x1B, 0x45, 0x30, 0x1B, 0x47, 0x30]; // Init commands
    this.is58mm = is58mm;
    this.bytes.push(0x1B, 0x4D, 0x00); // Font A
    this.bytes.push(0x1B, 0x33, 28);   // Compact line spacing (28 dots)
  }

  alignCenter() {
    this.bytes.push(0x1B, 0x61, 0x01);
    return this;
  }

  alignLeft() {
    this.bytes.push(0x1B, 0x61, 0x00);
    return this;
  }

  alignRight() {
    this.bytes.push(0x1B, 0x61, 0x02);
    return this;
  }

  bold(on = true) {
    if (on) {
      this.bytes.push(0x1B, 0x45, 0x31, 0x1B, 0x47, 0x31);
    } else {
      this.bytes.push(0x1B, 0x45, 0x30, 0x1B, 0x47, 0x30);
    }
    return this;
  }

  setFontNormal() {
    this.bytes.push(0x1D, 0x21, 0x00);
    return this;
  }

  setFontDouble() {
    this.bytes.push(0x1D, 0x21, 0x11); // Double width + double height
    return this;
  }

  setFontLarge() {
    this.bytes.push(0x1D, 0x21, 0x01); // Double height
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
    this.text(char.repeat(length));
    return this;
  }

  feed(lines = 3) {
    this.bytes.push(0x1B, 0x64, lines);
    return this;
  }

  cut() {
    this.bytes.push(0x1D, 0x56, 0x41, 0x03);
    return this;
  }

  qrCode(dataStr) {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(dataStr);
    const len = dataBytes.length + 3; // data length + header bytes
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    const moduleSize = this.is58mm ? 8 : 10;
    // Set QR Code Size
    this.bytes.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, moduleSize);
    // Store QR Code Data
    this.bytes.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < dataBytes.length; i++) {
      this.bytes.push(dataBytes[i]);
    }
    // Print QR Code
    this.bytes.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  build() {
    return new Uint8Array(this.bytes);
  }
}

// Format KOT
export function formatKOT(data, printerSize = '58mm') {
  const is58mm = printerSize === '58mm';
  const LINE_WIDTH = is58mm ? 31 : 42;
  const builder = new EscposBuilder(is58mm);
  const dateStr = new Date().toLocaleString();

  let tStr = String(data.table);
  if (!tStr.toLowerCase().includes('room') && !tStr.toLowerCase().includes('parcel')) {
    tStr = `Table ${tStr}`;
  }
  if (data.floor && !tStr.toLowerCase().includes('parcel')) {
    tStr += ` - ${data.floor}`;
  }

  builder.alignCenter()
    .setFontDouble()
    .bold()
    .text('KITCHEN ORDER')
    .setFontNormal()
    .bold(false)
    .line('=', LINE_WIDTH)
    .alignLeft()
    .bold()
    .text(tStr);

  if (data.waiter) {
    builder.text(`WAITER: ${data.waiter}`);
  }

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
    const nameStr = toTitleCase(String(item.name));
    const firstChunk = nameStr.substring(0, itemLen);
    let remainingStr = nameStr.substring(itemLen);
    
    builder.text(padText(firstChunk, itemLen) + ' ' + padText(qty, qtyLen, 'right'));
    
    const SUB_CHUNK_LEN = itemLen - 2;
    while (remainingStr.length > 0) {
      const subChunk = remainingStr.substring(0, SUB_CHUNK_LEN);
      builder.text("  " + padText(subChunk, LINE_WIDTH - 2));
      remainingStr = remainingStr.substring(SUB_CHUNK_LEN);
    }
  });

  builder.setFontNormal()
    .bold(false)
    .line('-', LINE_WIDTH);

  if (data.notes) {
    builder.bold()
      .text('NOTES:')
      .text(data.notes)
      .bold(false)
      .line('-', LINE_WIDTH);
  }

  builder.feed(3).cut();
  return builder.build();
}

// Convert logo image to ESC/POS monochrome bitmap (Dynamic for any logo)
export async function convertImageToEscpos(url, maxWidth = 300) {
  return new Promise((resolve) => {
    if (!url) { resolve([]); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        // Calculate scaled dimensions keeping original aspect ratio
        let targetWidth = Math.min(img.width || maxWidth, maxWidth);
        // Ensure width is a multiple of 8 for clean ESC/POS line alignment
        targetWidth = Math.floor(targetWidth / 8) * 8;
        if (targetWidth < 8) targetWidth = 8;

        const aspect = img.height / img.width;
        const width = targetWidth;
        const height = Math.round(width * aspect);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Fill background with white so transparent PNG logos print cleanly
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        // Convert RGBA to grayscale matrix
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

        // Floyd-Steinberg Dithering for crisp monochrome rendering of any logo
        const bw = new Uint8Array(width * height); // 1 = Black dot, 0 = White space
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const oldPixel = gray[idx];
            const newPixel = oldPixel < 128 ? 0 : 255;
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

        // Build ESC/POS GS v 0 raster command
        const bytesPerLine = width / 8;
        const xL = bytesPerLine % 256;
        const xH = Math.floor(bytesPerLine / 256);
        const yL = height % 256;
        const yH = Math.floor(height / 256);

        const bytes = [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH];

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

        resolve(bytes);
      } catch (e) {
        console.error('[ESC/POS LOGO CONVERSION ERROR]', e);
        resolve([]);
      }
    };
    img.onerror = (err) => {
      console.error('[ESC/POS LOGO LOAD ERROR]', err);
      resolve([]);
    };
    img.src = url;
  });
}

// Format Bill
export async function formatBill(data, printerSize = '58mm') {
  const is58mm = printerSize === '58mm';
  const LINE_WIDTH = is58mm ? 31 : 42;
  const builder = new EscposBuilder(is58mm);
  const dateStr = new Date().toLocaleString();

  builder.alignCenter();

  // Print Logo Image at center if enabled
  const logoPrintingEnabled = typeof window !== 'undefined' && localStorage.getItem('cfg_logo_printing_enabled') === 'true';
  const logoUrl = data.logo_url || (typeof window !== 'undefined' ? localStorage.getItem('cfg_hotel_logo_url') : '');

  if (logoPrintingEnabled && logoUrl) {
    try {
      const logoBytes = await convertImageToEscpos(logoUrl, 300);
      if (logoBytes && logoBytes.length > 0) {
        for (let i = 0; i < logoBytes.length; i++) {
          builder.bytes.push(logoBytes[i]);
        }
        builder.text('');
      }
    } catch (e) {
      console.warn('[LOGO PRINT ERR]', e);
    }
  }

  builder.setFontDouble()
    .bold()
    .text(data.hotelName)
    .setFontNormal()
    .bold(false);

  if (data.hotelLocation) builder.text(data.hotelLocation);
  if (data.hotelPhone) builder.text(`Phone: ${data.hotelPhone}`);
  if (data.hotelFssai) builder.text(`FSSAI: ${data.hotelFssai}`);

  if (data.isToken) {
    builder.alignCenter()
      .bold(true)
      .text('*** CUSTOMER / KITCHEN TOKEN ***')
      .bold(false)
      .line('=', LINE_WIDTH)
      .alignLeft()
      .bold()
      .text(`TOKEN NO: #${data.billId}`)
      .text(`${data.table}`)
      .bold(false)
      .text(`Date: ${dateStr}`)
      .line('-', LINE_WIDTH);

    const qtyLen = 6;
    const itemLen = LINE_WIDTH - qtyLen - 1;
    builder.bold(true).text(
      padText('ITEM', itemLen) + ' ' + padText('QTY', qtyLen, 'right')
    ).bold(false).line('-', LINE_WIDTH);

    data.items.forEach(item => {
      const qty = item.quantity || item.qty || 1;
      const nameStr = toTitleCase(String(item.name));
      builder.text(padText(nameStr.substring(0, itemLen), itemLen) + ' ' + padText(`x${qty}`, qtyLen, 'right'));
    });

    builder.line('=', LINE_WIDTH)
      .alignCenter()
      .bold(true)
      .text('PLEASE WAIT FOR YOUR NUMBER')
      .bold(false)
      .feed(3)
      .cut();

    return builder.build();
  }

  if (data.isCreditSettlement) {
    builder.alignCenter()
      .bold(true)
      .text('*** CREDIT SETTLEMENT ***')
      .bold(false);
  }

  builder.line('=', LINE_WIDTH)
    .alignLeft()
    .bold()
    .text(`BILL NO: ${data.billId}`)
    .text(`${data.table}`)
    .bold(false)
    .text(`Date: ${dateStr}`)
    .line('-', LINE_WIDTH);

  // Items header
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

  data.items.forEach(item => {
    const qty = item.quantity || item.qty || 1;
    const rate = formatAmount(item.price);
    const amt = formatAmount(item.price * qty);
    const nameStr = toTitleCase(String(item.name));
    
    const firstChunk = nameStr.substring(0, itemLen);
    let remainingStr = nameStr.substring(itemLen);

    builder.text(
      padText(firstChunk, itemLen) + ' ' +
      padText(qty, qtyLen, 'right') + ' ' +
      padText(rate, rateLen, 'right') + ' ' +
      padText(amt, amtLen, 'right')
    );

    const SUB_CHUNK_LEN = itemLen - 2;
    while (remainingStr.length > 0) {
      const subChunk = remainingStr.substring(0, SUB_CHUNK_LEN);
      builder.text("  " + padText(subChunk, LINE_WIDTH - 2));
      remainingStr = remainingStr.substring(SUB_CHUNK_LEN);
    }
  });

  builder.line('-', LINE_WIDTH);

  // Totals
  const labelLen = LINE_WIDTH - amtLen - 1;
  // Subtotal removed as per request
  
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

  builder.line('-', LINE_WIDTH)
    .bold(true)
    .text(padText('GRAND TOTAL:', labelLen) + ' ' + padText(formatAmount(data.finalAmount), amtLen, 'right'))
    .bold(false)
    .line('=', LINE_WIDTH);

  if (data.isCreditSettlement) {
    const payMode = (data.settlementPaymentMethod || 'CASH').toUpperCase();
    builder.bold(true)
      .text(padText('SETTLEMENT MODE:', labelLen) + ' ' + padText(payMode, amtLen, 'right'))
      .bold(false)
      .line('-', LINE_WIDTH);
  }

  // UPI QR Code
  if (data.upiId) {
    const upiLink = `upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(data.hotelName)}&am=${data.finalAmount}&cu=INR`;
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
    .bold(false)
    .feed(3)
    .cut();

  return builder.build();
}

// Helper to convert Uint8Array to base64 string
function uint8ToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Bluetooth printing lifecycle manager
export class BluetoothPrinterService {
  static getSelectedPrinter() {
    return localStorage.getItem('cfg_bluetooth_mac') || '';
  }

  static getPrinterSize() {
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
        console.error('[BT PRINTER] Exception checking Bluetooth radio state:', err);
        resolve(false);
      }
    });
  }

  static async listPairedDevices() {
    return new Promise((resolve) => {
      if (window.bluetoothSerial) {
        window.bluetoothSerial.list(
          (devices) => resolve(devices),
          (err) => {
            console.error('[BT PRINTER] List failed:', err);
            resolve([]);
          }
        );
      } else {
        console.warn('[BT PRINTER] cordova-plugin-bluetooth-serial is not available');
        resolve([]);
      }
    });
  }

  static async discoverUnpairedDevices() {
    return new Promise((resolve) => {
      if (window.bluetoothSerial && typeof window.bluetoothSerial.discoverUnpaired === 'function') {
        window.bluetoothSerial.discoverUnpaired(
          (devices) => resolve(devices),
          (err) => {
            console.error('[BT PRINTER] Discovery failed:', err);
            resolve([]);
          }
        );
      } else {
        console.warn('[BT PRINTER] discoverUnpaired is not available on this platform');
        resolve([]);
      }
    });
  }

  static async printData(uint8Array) {
    try {
      const macAddress = this.getSelectedPrinter();
      if (!macAddress) {
        console.warn('[BT PRINTER] No Bluetooth printer configured in Settings');
        toast.error('No Bluetooth printer configured in Printer Settings');
        return false;
      }

      if (!window.bluetoothSerial) {
        console.warn('[BT PRINTER] Mock print (plugin missing):', uint8Array);
        return true;
      }

      // Guard: Check if mobile Bluetooth radio is turned ON
      const btEnabled = await this.isBluetoothEnabled();
      if (!btEnabled) {
        console.warn('[BT PRINTER] Mobile Bluetooth is turned OFF');
        toast.error('Please turn ON Bluetooth on your phone!', { duration: 4000 });
        
        // Trigger native Android Bluetooth enable prompt if available
        if (window.bluetoothSerial && typeof window.bluetoothSerial.enable === 'function') {
          try {
            window.bluetoothSerial.enable(
              () => console.log('[BT PRINTER] Native BT enable prompt accepted'),
              () => console.warn('[BT PRINTER] Native BT enable prompt declined')
            );
          } catch (e) {
            console.error('[BT PRINTER] Could not open native BT prompt:', e);
          }
        }
        return false;
      }

      const forceDisconnect = () => {
        return new Promise((resolve) => {
          try {
            window.bluetoothSerial.disconnect(() => resolve(), () => resolve());
          } catch (e) {
            resolve();
          }
        });
      };

      const attemptConnect = (mac) => {
        return new Promise((resolve) => {
          try {
            window.bluetoothSerial.connect(
              mac,
              () => {
                console.log('[BT PRINTER] Connected to', mac);
                resolve(true);
              },
              (err) => {
                console.error('[BT PRINTER] Connection attempt failed:', err);
                resolve(false);
              }
            );
          } catch (e) {
            console.error('[BT PRINTER] Native connect threw exception:', e);
            resolve(false);
          }
        });
      };

      const attemptWrite = () => {
        return new Promise((resolve) => {
          try {
            window.bluetoothSerial.write(
              uint8Array.buffer,
              () => {
                console.log('[BT PRINTER] Bytes printed successfully');
                resolve(true);
              },
              (err) => {
                console.error('[BT PRINTER] Write failed:', err);
                resolve(false);
              }
            );
          } catch (e) {
            console.error('[BT PRINTER] Native write threw exception:', e);
            resolve(false);
          }
        });
      };

      const connectWithRetry = async () => {
        await forceDisconnect();
        let connected = await attemptConnect(macAddress);
        if (!connected) {
          console.warn('[BT PRINTER] First connect attempt failed, waiting 400ms before socket retry...');
          await new Promise((r) => setTimeout(r, 400));
          await forceDisconnect();
          connected = await attemptConnect(macAddress);
        }
        return connected;
      };

      const isConnected = await new Promise((resolve) => {
        try {
          window.bluetoothSerial.isConnected(
            () => resolve(true),
            () => resolve(false)
          );
        } catch (e) {
          console.error('[BT PRINTER] isConnected check failed:', e);
          resolve(false);
        }
      });

      if (isConnected) {
        const written = await attemptWrite();
        if (written) return true;
        console.warn('[BT PRINTER] Write failed on active socket handle, attempting reconnection...');
      }

      const reconnected = await connectWithRetry();
      if (!reconnected) {
        console.error('[BT PRINTER] Automatic reconnection failed.');
        toast.error('Could not connect to printer. Ensure printer is ON & in range.');
        return false;
      }

      const success = await attemptWrite();
      if (!success) {
        toast.error('Printing failed. Please check printer paper & connection.');
      }
      return success;
    } catch (globalErr) {
      console.error('[BT PRINTER] Uncaught exception in printData:', globalErr);
      toast.error('Bluetooth error. Please ensure Bluetooth is ON.');
      return false;
    }
  }

  // Core listener bootstrap
  static bootstrap() {
    console.log('[BT PRINTER] Bootstrapping listeners...');
    window.addEventListener('print-job-triggered', async (e) => {
      try {
        const job = e.detail;
        console.log('[BT PRINTER] Received local print job:', job);
        
        const size = this.getPrinterSize();
        let printBytes;

        if (job.type === 'KOT') {
          printBytes = formatKOT(job, size);
        } else if (job.type === 'FINAL_BILL') {
          printBytes = await formatBill(job, size);
        }

        if (printBytes) {
          const success = await this.printData(printBytes);
          if (success) {
            console.log('[BT PRINTER] Receipt printed successfully.');
          } else {
            console.error('[BT PRINTER] Failed to print receipt.');
          }
        }
      } catch (err) {
        console.error('[BT PRINTER] Error handling print job event:', err);
      }
    });
  }
}

