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

    // 1. Set QR Code Model (Model 2)
    this.bytes.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Set QR Code Size (Size 6 dots per module)
    this.bytes.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06);
    // 3. Set QR Code Error Correction (Level L)
    this.bytes.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x44, 0x30);
    // 4. Store QR Code Data
    this.bytes.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < dataBytes.length; i++) {
      this.bytes.push(dataBytes[i]);
    }
    // 5. Print QR Code
    this.bytes.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  build() {
    return new Uint8Array(this.bytes);
  }
}

// Format KOT
export function formatKOT(data, printerSize = '80mm') {
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
    
  if (data.waiter && data.waiter.toLowerCase() !== 'owner') {
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

// Format Bill
export function formatBill(data, printerSize = '80mm') {
  const is58mm = printerSize === '58mm';
  const LINE_WIDTH = is58mm ? 31 : 42;
  const builder = new EscposBuilder(is58mm);
  const dateStr = new Date().toLocaleString();

  builder.alignCenter()
    .setFontDouble()
    .bold()
    .text(data.hotelName)
    .setFontNormal()
    .bold(false);

  if (data.hotelLocation) builder.text(data.hotelLocation);
  if (data.hotelPhone) builder.text(`Phone: ${data.hotelPhone}`);
  if (data.hotelFssai) builder.text(`FSSAI: ${data.hotelFssai}`);

  builder.line('=', LINE_WIDTH)
    .alignLeft()
    .bold()
    .text(`BILL NO: #${data.billId}`)
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
    const rate = Number(item.price).toFixed(2);
    const amt = (item.price * qty).toFixed(2);
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
  builder.text(padText('Subtotal:', labelLen) + ' ' + padText(Number(data.subtotal).toFixed(2), amtLen, 'right'));
  builder.text(padText(`GST (${data.gst_percentage}%):`, labelLen) + ' ' + padText(Number(data.gst).toFixed(2), amtLen, 'right'));
  
  if (data.discountPercentage > 0) {
    const preVal = Number(data.subtotal) + Number(data.gst);
    const discAmt = preVal * (data.discountPercentage / 100);
    builder.text(padText(`Discount (${data.discountPercentage}%):`, labelLen) + ' ' + padText(`-${discAmt.toFixed(2)}`, amtLen, 'right'));
  }

  builder.line('-', LINE_WIDTH)
    .bold(true)
    .text(padText('GRAND TOTAL:', labelLen) + ' ' + padText(Number(data.finalAmount).toFixed(2), amtLen, 'right'))
    .bold(false)
    .line('=', LINE_WIDTH);

  // UPI QR Code
  if (data.upiId && !data.isPaid) {
    const upiLink = `upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(data.hotelName)}&am=${data.finalAmount}&cu=INR`;
    builder.alignCenter()
      .text('SCAN TO PAY')
      .feed(1)
      .qrCode(upiLink)
      .feed(1);
  }

  builder.alignCenter()
    .bold(true)
    .text('THANK YOU! VISIT AGAIN')
    .bold(false)
    .feed(3)
    .cut();

  return builder.build();
}

// Bluetooth printing lifecycle manager
export class BluetoothPrinterService {
  static getSelectedPrinter() {
    return localStorage.getItem('cfg_bluetooth_mac') || '';
  }

  static getPrinterSize() {
    return localStorage.getItem('cfg_printer_size') || '80mm';
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

  static async printData(uint8Array) {
    const macAddress = this.getSelectedPrinter();
    if (!macAddress) {
      console.warn('[BT PRINTER] No Bluetooth printer configured in Settings');
      return false;
    }

    return new Promise((resolve) => {
      if (!window.bluetoothSerial) {
        console.warn('[BT PRINTER] Mock print (plugin missing):', uint8Array);
        resolve(true);
        return;
      }

      const printJob = () => {
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
      };

      window.bluetoothSerial.isConnected(
        () => {
          printJob();
        },
        () => {
          window.bluetoothSerial.connect(
            macAddress,
            () => {
              console.log('[BT PRINTER] Connected to', macAddress);
              printJob();
            },
            (err) => {
              console.error('[BT PRINTER] Connection failed:', err);
              resolve(false);
            }
          );
        }
      );
    });
  }

  // Core listener bootstrap
  static bootstrap() {
    console.log('[BT PRINTER] Bootstrapping listeners...');
    window.addEventListener('print-job-triggered', async (e) => {
      const job = e.detail;
      console.log('[BT PRINTER] Received local print job:', job);
      
      const size = this.getPrinterSize();
      let printBytes;

      if (job.type === 'KOT') {
        printBytes = formatKOT(job, size);
      } else if (job.type === 'FINAL_BILL') {
        printBytes = formatBill(job, size);
      }

      if (printBytes) {
        const success = await this.printData(printBytes);
        if (success) {
          console.log('[BT PRINTER] Receipt printed successfully.');
        } else {
          console.error('[BT PRINTER] Failed to print receipt.');
        }
      }
    });
  }
}
