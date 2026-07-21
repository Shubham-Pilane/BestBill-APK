import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

if (pdfFonts && pdfFonts.pdfMake) {
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
}

/**
 * Generates a professionally formatted PDF bill document definition using pdfMake.
 */
export const createBillPDFDocDefinition = (billData, hotelInfo = {}) => {
  const hotelName = (hotelInfo.hotel_name || hotelInfo.name || 'BESTBILL').toUpperCase();
  const address = hotelInfo.hotel_location || hotelInfo.location || hotelInfo.address || '';
  const phone = hotelInfo.hotel_phone || hotelInfo.phone || '';
  const email = hotelInfo.hotel_email || hotelInfo.email || '';
  const gstNo = hotelInfo.gst_number || hotelInfo.gstin || '';
  const fssaiNo = hotelInfo.fssai_number || '';
  const logoUrl = hotelInfo.logo_url || '';

  const billId = billData.id || billData.bill_id || 'N/A';
  const tableOrRoom = billData.table || billData.table_number || (billData.room_number ? `Room ${billData.room_number}` : 'Counter');
  const dateStr = billData.created_at ? new Date(billData.created_at).toLocaleDateString() : new Date().toLocaleDateString();
  const timeStr = billData.created_at ? new Date(billData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const paymentMethod = (billData.payment_method || 'Cash').toUpperCase();
  const isPaid = billData.is_paid === 1 || billData.is_paid === true;
  const paymentStatus = isPaid ? `PAID (${paymentMethod})` : 'UNPAID';

  const items = billData.items || billData.parsedItems || [];
  const roomCharge = parseFloat(billData.room_charge || 0);

  // Build items table body
  const tableBody = [
    [
      { text: 'Sr.', style: 'tableHeader', alignment: 'center' },
      { text: 'Item Description', style: 'tableHeader' },
      { text: 'Qty', style: 'tableHeader', alignment: 'center' },
      { text: 'Rate (₹)', style: 'tableHeader', alignment: 'right' },
      { text: 'Amount (₹)', style: 'tableHeader', alignment: 'right' }
    ]
  ];

  let index = 1;
  if (roomCharge > 0) {
    tableBody.push([
      { text: index++, alignment: 'center' },
      { text: 'Room Charge', bold: true },
      { text: '1', alignment: 'center' },
      { text: roomCharge.toFixed(2), alignment: 'right' },
      { text: roomCharge.toFixed(2), alignment: 'right' }
    ]);
  }

  items.forEach((item) => {
    const qty = item.quantity || item.qty || 1;
    const price = parseFloat(item.price || 0);
    const amount = qty * price;
    tableBody.push([
      { text: index++, alignment: 'center' },
      { text: item.name || 'Item' },
      { text: qty.toString(), alignment: 'center' },
      { text: price.toFixed(2), alignment: 'right' },
      { text: amount.toFixed(2), alignment: 'right' }
    ]);
  });

  const subtotal = parseFloat(billData.subtotal || billData.total_amount || 0);
  const gstPercentage = parseFloat(billData.gst_percentage || hotelInfo.gst_percentage || 0);
  const gstAmount = parseFloat(billData.gst || 0);
  const discountPercentage = parseFloat(billData.discount_percentage || 0);
  const finalAmount = parseFloat(billData.final_amount || subtotal + gstAmount);
  const discountVal = (subtotal + gstAmount) * (discountPercentage / 100);

  const docDefinition = {
    content: [
      // Header Section
      {
        columns: [
          logoUrl && logoUrl.startsWith('data:image') ? {
            image: logoUrl,
            width: 60,
            alignment: 'left'
          } : {
            text: '⚡ BestBill',
            fontSize: 20,
            bold: true,
            color: '#0ea5e9'
          },
          {
            stack: [
              { text: hotelName, fontSize: 18, bold: true, color: '#0f172a' },
              address ? { text: address, fontSize: 9, color: '#64748b' } : {},
              phone ? { text: `Phone: ${phone}${email ? ` | Email: ${email}` : ''}`, fontSize: 9, color: '#64748b' } : {},
              (gstNo || fssaiNo) ? {
                text: `${gstNo ? `GSTIN: ${gstNo} ` : ''}${fssaiNo ? `FSSAI: ${fssaiNo}` : ''}`,
                fontSize: 9,
                bold: true,
                color: '#334155',
                margin: [0, 2, 0, 0]
              } : {}
            ],
            alignment: 'right'
          }
        ],
        margin: [0, 0, 0, 15]
      },
      
      // Horizontal Line
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 15] },

      // Bill Meta Info Card
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              {
                stack: [
                  { text: `INVOICE / BILL NO: #${billId}`, bold: true, fontSize: 11, color: '#0f172a' },
                  { text: `Table / Details: ${tableOrRoom}`, fontSize: 10, color: '#334155', margin: [0, 2, 0, 0] }
                ]
              },
              {
                stack: [
                  { text: `Date: ${dateStr}  Time: ${timeStr}`, fontSize: 10, color: '#334155', alignment: 'right' },
                  { text: `Status: ${paymentStatus}`, bold: true, fontSize: 10, color: isPaid ? '#16a34a' : '#dc2626', alignment: 'right', margin: [0, 2, 0, 0] }
                ]
              }
            ]
          ]
        },
        layout: {
          fillColor: () => '#f8fafc',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 12,
          paddingRight: () => 12,
          paddingTop: () => 8,
          paddingBottom: () => 8
        },
        margin: [0, 0, 0, 15]
      },

      // Items Table
      {
        table: {
          headerRows: 1,
          widths: [30, '*', 40, 75, 85],
          body: tableBody
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#0ea5e9' : rowIndex % 2 === 0 ? '#f8fafc' : null),
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0,
          hLineColor: () => '#cbd5e1',
          paddingTop: () => 6,
          paddingBottom: () => 6
        },
        margin: [0, 0, 0, 15]
      },

      // Summary Totals Table
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 220,
            table: {
              widths: ['*', 'auto'],
              body: [
                ['Subtotal:', { text: `₹${subtotal.toFixed(2)}`, alignment: 'right' }],
                gstPercentage > 0 ? [`GST (${gstPercentage}%):`, { text: `₹${gstAmount.toFixed(2)}`, alignment: 'right' }] : null,
                discountPercentage > 0 ? [`Discount (${discountPercentage}%):`, { text: `-₹${discountVal.toFixed(2)}`, alignment: 'right' }] : null,
                [
                  { text: 'GRAND TOTAL:', bold: true, fontSize: 13, color: '#0f172a' },
                  { text: `₹${finalAmount.toFixed(2)}`, bold: true, fontSize: 14, color: '#0ea5e9', alignment: 'right' }
                ]
              ].filter(Boolean)
            },
            layout: {
              hLineWidth: (i, node) => (i === node.table.body.length - 1 ? 1.5 : 0.5),
              vLineWidth: () => 0,
              hLineColor: () => '#94a3b8',
              paddingTop: () => 4,
              paddingBottom: () => 4
            }
          }
        ],
        margin: [0, 0, 0, 20]
      },

      // Footer Message
      { text: 'Thank you for your visit!', alignment: 'center', bold: true, fontSize: 12, color: '#0f172a', margin: [0, 10, 0, 2] },
      { text: 'Generated via BestBill Software', alignment: 'center', fontSize: 9, color: '#94a3b8' }
    ],
    styles: {
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: '#ffffff'
      }
    },
    defaultStyle: {
      fontSize: 10,
      font: 'Roboto'
    }
  };

  return docDefinition;
};

/**
 * Generates the PDF blob, creates a File object, and shares via navigator.share (if supported) or triggers fallback download & WhatsApp chat link.
 */
export const shareBillPDFViaWhatsApp = (billData, hotelInfo = {}, customerPhone = '') => {
  return new Promise((resolve, reject) => {
    try {
      const docDef = createBillPDFDocDefinition(billData, hotelInfo);
      const pdfDocGenerator = pdfMake.createPdf(docDef);

      pdfDocGenerator.getBlob(async (blob) => {
        const billId = billData.id || billData.bill_id || 'receipt';
        const fileName = `Bill_${billId}.pdf`;
        const file = new File([blob], fileName, { type: 'application/pdf' });

        const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
        const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const hotelName = hotelInfo.hotel_name || hotelInfo.name || 'BestBill';

        const whatsappText = `*--- ${hotelName.toUpperCase()} RECEIPT ---*\n` +
          `Bill No: #${billId}\n` +
          `Grand Total: ₹${parseFloat(billData.final_amount || 0).toFixed(2)}\n\n` +
          `Thank you for your visit!`;

        // Check if Web Share API is available and can share files
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Bill Receipt #${billId}`,
              text: whatsappText
            });
            resolve({ success: true, method: 'native_share' });
            return;
          } catch (shareErr) {
            console.log('[PDF SHARE] Native share cancelled or failed, falling back to download + link:', shareErr);
          }
        }

        // Fallback: Download PDF & open WhatsApp Web/App
        pdfDocGenerator.download(fileName);
        if (finalPhone) {
          const waUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(whatsappText)}`;
          window.open(waUrl, '_blank');
        }
        resolve({ success: true, method: 'download_fallback' });
      });
    } catch (err) {
      console.error('[PDF BILL ERROR]', err);
      reject(err);
    }
  });
};
