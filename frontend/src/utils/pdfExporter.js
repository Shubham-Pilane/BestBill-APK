import { jsPDF } from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

// Register autotable plugin on jsPDF prototype safely for Vite production bundle
try {
  applyPlugin(jsPDF);
} catch (e) {
  console.warn('jsPDF autoTable plugin pre-registration note:', e);
}

export async function exportBillingHistoryPdf(reportData) {
  try {
    const { 
      hotelName, 
      dateRangeText, 
      summary, 
      tableData, 
      tableHeaders, 
      sectionTitle 
    } = reportData;

    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Helper function to safely invoke autoTable in production
    const renderTable = (options) => {
      if (typeof doc.autoTable === 'function') {
        doc.autoTable(options);
      } else if (typeof autoTable === 'function') {
        autoTable(doc, options);
      } else if (autoTable && typeof autoTable.default === 'function') {
        autoTable.default(doc, options);
      }
    };

    // 1. Header banner
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text((hotelName || 'BESTBILL').toUpperCase(), 15, 15);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Period: ${dateRangeText}`, 15, 23);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 15, 29);

    // Title badge
    doc.setFillColor(14, 165, 233); // sky-500
    doc.rect(150, 10, 45, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SALES REPORT', 153, 18);

    // 2. Summary stats grid (Key Metrics)
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Key Metrics', 15, 48);

    renderTable({
      startY: 52,
      head: [['Total Revenue', 'Cash Coll.', 'Online Coll.', 'Dine-In Rev.', 'Parcel Rev.']],
      body: [[
        `Rs. ${Number(summary.total_revenue || 0).toFixed(2)}`,
        `Rs. ${Number(summary.cash_collection || 0).toFixed(2)}`,
        `Rs. ${Number(summary.online_collection || 0).toFixed(2)}`,
        `Rs. ${Number(summary.dine_in_sales || 0).toFixed(2)}`,
        `Rs. ${Number(summary.parcel_sales || 0).toFixed(2)}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9.5, halign: 'center', cellPadding: 5 }
    });

    let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : (doc.previousAutoTable ? doc.previousAutoTable.finalY : 70)) + 12;

    // 3. Detailed Data Table (Yearly / Transactions / Items)
    if (tableData && tableData.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(sectionTitle || 'Detailed Report', 15, currentY);

      renderTable({
        startY: currentY + 4,
        head: [tableHeaders || ['Item', 'Details']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 4 }
      });
    }

    // Generate blob & filename
    const cleanName = (hotelName || 'BESTBILL').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `BestBill_Report_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`;
    const pdfBlob = doc.output('blob');

    if (Capacitor.isNativePlatform()) {
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          const base64data = reader.result.split(',')[1];
          let writeResult;
          try {
            writeResult = await Filesystem.writeFile({
              path: `Download/${fileName}`,
              data: base64data,
              directory: Directory.ExternalStorage,
              recursive: true
            });
          } catch (err1) {
            try {
              writeResult = await Filesystem.writeFile({
                path: fileName,
                data: base64data,
                directory: Directory.Documents,
                recursive: true
              });
            } catch (err2) {
              try {
                writeResult = await Filesystem.writeFile({
                  path: fileName,
                  data: base64data,
                  directory: Directory.Cache,
                  recursive: true
                });
              } catch (err3) {
                console.warn('All native directories failed, triggering fallback download link', err3);
              }
            }
          }

          if (writeResult && writeResult.uri) {
            resolve({ success: true, uri: writeResult.uri, fileName });
          } else {
            // Web/Browser style fallback
            const blobUrl = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            resolve({ success: true, fileName });
          }
        };
        reader.onerror = (e) => reject(e);
      });
    } else {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return { success: true, fileName };
    }
  } catch (err) {
    console.error('PDF Exporter Error:', err);
    throw err;
  }
}
