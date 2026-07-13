import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { Receipt, History, IndianRupee, Calendar, Search, Ban, CheckCircle, Phone, Printer, MessageCircle, BarChart2, Download, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

if (pdfFonts && pdfFonts.pdfMake) {
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
}

const BillingHistory = () => {
    const { user } = useAuth();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBill, setSelectedBill] = useState(null);
    const [customerPhone, setCustomerPhone] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const [activeView, setActiveView] = useState('history'); // 'history' or 'analytics'
    const [analyticsFilter, setAnalyticsFilter] = useState('Today'); // 'Today', 'Month', 'Year', 'Custom'
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [itemSortConfig, setItemSortConfig] = useState({ key: 'quantity', direction: 'desc' });
    const [itemSearchTerm, setItemSearchTerm] = useState('');

    const fetchHistory = async () => {
        try {
            const res = await api.get('/bills/history');
            const data = Array.isArray(res.data) ? res.data : [];
            // Parse items_json if it exists (from our backend modification)
            const parsedData = data.map(b => {
                let parsedItems = [];
                if (b.items_json) {
                    try {
                        parsedItems = JSON.parse(b.items_json);
                    } catch (e) {}
                }
                return { ...b, parsedItems };
            });
            setBills(parsedData);
        } catch (err) {
            toast.error('Failed to load transaction history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // --- Helper for detecting Parcel ---
    const isParcel = (tableNo) => {
        return tableNo && tableNo.toLowerCase().includes('parcel');
    };

    // --- History View Logic ---
    const filteredBills = useMemo(() => {
        return bills.filter(b => {
            const matchesSearch = b.id.toString().includes(searchTerm) || 
                                  (b.table_number && b.table_number.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesSearch;
        });
    }, [bills, searchTerm]);

    const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
    const currentBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const todayBills = bills.filter(b => new Date(b.created_at).toDateString() === new Date().toDateString());
    const todayRevenue = todayBills.reduce((acc, b) => acc + parseFloat(b.final_amount || 0), 0);

    // --- Analytics View Logic ---
    const getFilteredAnalyticsBills = () => {
        return bills.filter(b => {
            const billDate = new Date(b.created_at);
            if (analyticsFilter === 'Today') {
                return billDate.toDateString() === new Date().toDateString();
            } else if (analyticsFilter === 'Month') {
                return billDate.getMonth().toString() === selectedMonth && billDate.getFullYear().toString() === selectedYear;
            } else if (analyticsFilter === 'Year') {
                return billDate.getFullYear().toString() === selectedYear;
            } else if (analyticsFilter === 'Custom') {
                const year = billDate.getFullYear();
                const month = String(billDate.getMonth() + 1).padStart(2, '0');
                const day = String(billDate.getDate()).padStart(2, '0');
                const billLocalDateStr = `${year}-${month}-${day}`;
                return billLocalDateStr >= startDate && billLocalDateStr <= endDate;
            }
            return false;
        });
    };

    const analyticsBills = getFilteredAnalyticsBills();

    const parcelBills = analyticsBills.filter(b => isParcel(b.table_number));
    const dineInBills = analyticsBills.filter(b => !isParcel(b.table_number));

    const totalParcelRevenue = parcelBills.reduce((acc, b) => acc + parseFloat(b.final_amount || 0), 0);
    const totalDineInRevenue = dineInBills.reduce((acc, b) => acc + parseFloat(b.final_amount || 0), 0);
    const grandTotalRevenue = totalParcelRevenue + totalDineInRevenue;

    const totalCashRevenue = analyticsBills
        .filter(b => b.payment_method && b.payment_method.toLowerCase() === 'cash')
        .reduce((acc, b) => acc + parseFloat(b.final_amount || 0), 0);

    const totalOnlineRevenue = analyticsBills
        .filter(b => !b.payment_method || b.payment_method.toLowerCase() !== 'cash')
        .reduce((acc, b) => acc + parseFloat(b.final_amount || 0), 0);

    const itemSales = useMemo(() => {
        const itemMap = {};
        analyticsBills.forEach(b => {
            if (b.parsedItems) {
                b.parsedItems.forEach(item => {
                    if (!itemMap[item.name]) {
                        itemMap[item.name] = { name: item.name, quantity: 0, revenue: 0 };
                    }
                    itemMap[item.name].quantity += item.quantity;
                    itemMap[item.name].revenue += (item.price * item.quantity);
                });
            }
        });
        
        let arr = Object.values(itemMap);
        if (itemSearchTerm) {
            arr = arr.filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase()));
        }
        
        arr.sort((a, b) => {
            if (a[itemSortConfig.key] < b[itemSortConfig.key]) {
                return itemSortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[itemSortConfig.key] > b[itemSortConfig.key]) {
                return itemSortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        
        return arr;
    }, [analyticsBills, itemSortConfig, itemSearchTerm]);

    // --- Yearly Analytics (12 Months) ---
    const yearlyData = useMemo(() => {
        if (analyticsFilter !== 'Year') return [];
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const data = months.map(m => ({ month: m, parcelRev: 0, dineInRev: 0, totalRev: 0, cashRev: 0, onlineRev: 0 }));
        
        bills.forEach(b => {
            const d = new Date(b.created_at);
            if (d.getFullYear().toString() === selectedYear) {
                const isP = isParcel(b.table_number);
                const amt = parseFloat(b.final_amount || 0);
                const isCash = b.payment_method && b.payment_method.toLowerCase() === 'cash';
                const mIdx = d.getMonth();
                if (isP) data[mIdx].parcelRev += amt;
                else data[mIdx].dineInRev += amt;
                if (isCash) data[mIdx].cashRev += amt;
                else data[mIdx].onlineRev += amt;
                data[mIdx].totalRev += amt;
            }
        });
        return data;
    }, [bills, analyticsFilter, selectedYear]);

    const uniqueYears = useMemo(() => {
        const earliest = bills.length > 0 ? Math.min(...bills.map(b => new Date(b.created_at).getFullYear())) : new Date().getFullYear();
        const years = [];
        for (let i = new Date().getFullYear(); i >= earliest; i--) years.push(i.toString());
        return years;
    }, [bills]);

    const monthsList = [
        { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' }, { value: '3', label: 'April' },
        { value: '4', label: 'May' }, { value: '5', label: 'June' }, { value: '6', label: 'July' }, { value: '7', label: 'August' },
        { value: '8', label: 'September' }, { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' }
    ];

    // --- Actions ---
    const handleBillClick = async (billId) => {
        try {
             const res = await api.get(`/bills/${billId}`);
             setSelectedBill(res.data);
        } catch (err) {
             toast.error('Failed to load bill details');
        }
    };

    const printBill = async () => {
        if (!selectedBill) return;
        try {
            await api.post(`/bills/${selectedBill.id}/print`);
            toast.success('Print job spooled successfully');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to trigger offline printing');
        }
    };

    const shareViaWhatsApp = () => {
        if (!selectedBill) return;
        if (!customerPhone) {
            toast.error('Please enter a phone number first');
            return;
        }
        const subVal = parseFloat(selectedBill.subtotal || 0);
        const taxVal = parseFloat(selectedBill.gst || 0);
        const preVal = subVal + taxVal;
        
        let msg = `*--- ${user?.hotel_name?.toUpperCase() || 'BESTBILL'} RECEIPT ---*\n\n`;
        msg += `Table No: ${selectedBill.table_number}\n`;
        msg += `Bill No: #${selectedBill.id}\n`;
        msg += `Date: ${new Date(selectedBill.created_at).toLocaleDateString()} ${new Date(selectedBill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
        msg += `\n*Items:*\n`;
        (selectedBill.items || []).forEach(i => msg += `• ${i.name} x ${i.quantity} = ₹${(i.price * i.quantity).toFixed(2)}\n`);
        msg += `\n*------------------------*\n`;
        msg += `*Subtotal:* ₹${subVal.toFixed(2)}\n`;
        msg += `*GST (${selectedBill.gst_percentage || 0}%):* ₹${taxVal.toFixed(2)}\n`;
        if (selectedBill.discount_percentage > 0) msg += `*Discount (${selectedBill.discount_percentage}%):* -₹${(preVal * selectedBill.discount_percentage / 100).toFixed(2)}\n`;
        msg += `*GRAND TOTAL: ₹${parseFloat(selectedBill.final_amount).toFixed(2)}*\n`;
        msg += `\n*Visit Again!* - ${(user?.hotel_name || 'BestBill').toUpperCase()}\n`;
        
        const cleanPhone = customerPhone.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const exportPDF = () => {
        const docDefinition = {
            content: [
                { text: (user?.hotel_name || 'BESTBILL').toUpperCase(), style: 'header', alignment: 'center' },
                { text: user?.hotel_location || 'Address not available', alignment: 'center', margin: [0, 0, 0, 5] },
                { text: `Mobile: ${user?.hotel_phone || 'N/A'}`, alignment: 'center' },
                user?.fssai_number ? { text: `FSSAI: ${user.fssai_number}`, alignment: 'center' } : {},
                { text: `${analyticsFilter} Sales Report`, style: 'subheader', alignment: 'center', margin: [0, 15, 0, 10] },
            ],
            styles: {
                header: { fontSize: 22, bold: true },
                subheader: { fontSize: 16, bold: true },
                tableHeader: { bold: true, fontSize: 12, color: 'black', fillColor: '#eeeeee' }
            },
            defaultStyle: { fontSize: 10 }
        };

        if (analyticsFilter === 'Today' || analyticsFilter === 'Custom' || analyticsFilter === 'Month') {
            if (analyticsFilter === 'Today') {
                docDefinition.content.push({ text: `Date: ${new Date().toLocaleDateString()}`, margin: [0, 0, 0, 10] });
            } else if (analyticsFilter === 'Custom') {
                docDefinition.content.push({ text: `Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, margin: [0, 0, 0, 10] });
            } else {
                docDefinition.content.push({ text: `Selected Month: ${monthsList.find(m => m.value === selectedMonth)?.label} ${selectedYear}`, margin: [0, 0, 0, 10] });
            }
            
            // Revenue Summary
            docDefinition.content.push({
                table: {
                    widths: ['*', '*'],
                    body: [
                        [{text: 'Revenue Type', style: 'tableHeader'}, {text: 'Amount (₹)', style: 'tableHeader'}],
                        ['Dine-In Revenue', totalDineInRevenue.toFixed(2)],
                        ['Parcel Revenue', totalParcelRevenue.toFixed(2)],
                        ['Cash Collection', totalCashRevenue.toFixed(2)],
                        ['Online Collection', totalOnlineRevenue.toFixed(2)],
                        [{text: 'Total Revenue', bold: true}, {text: grandTotalRevenue.toFixed(2), bold: true}]
                    ]
                },
                margin: [0, 0, 0, 20]
            });
        } else if (analyticsFilter === 'Year') {
            docDefinition.content.push({ text: `Selected Year: ${selectedYear}`, margin: [0, 0, 0, 10] });
            
            const yearlyBody = [
                [
                    {text: 'Month', style: 'tableHeader'}, 
                    {text: 'Cash Collection', style: 'tableHeader'}, 
                    {text: 'Online Collection', style: 'tableHeader'}, 
                    {text: 'Parcel Revenue', style: 'tableHeader'}, 
                    {text: 'Dine-In Revenue', style: 'tableHeader'}, 
                    {text: 'Total Revenue', style: 'tableHeader'}
                ]
            ];
            
            let yrTotalCash = 0, yrTotalOnline = 0, yrTotalParcel = 0, yrTotalDine = 0, yrTotal = 0;
            
            yearlyData.forEach(row => {
                yearlyBody.push([
                    row.month, 
                    row.cashRev.toFixed(2), 
                    row.onlineRev.toFixed(2), 
                    row.parcelRev.toFixed(2), 
                    row.dineInRev.toFixed(2), 
                    row.totalRev.toFixed(2)
                ]);
                yrTotalCash += row.cashRev;
                yrTotalOnline += row.onlineRev;
                yrTotalParcel += row.parcelRev;
                yrTotalDine += row.dineInRev;
                yrTotal += row.totalRev;
            });
            
            yearlyBody.push([
                {text: 'TOTAL', bold: true}, 
                {text: yrTotalCash.toFixed(2), bold: true}, 
                {text: yrTotalOnline.toFixed(2), bold: true}, 
                {text: yrTotalParcel.toFixed(2), bold: true}, 
                {text: yrTotalDine.toFixed(2), bold: true}, 
                {text: yrTotal.toFixed(2), bold: true}
            ]);

            docDefinition.content.push({
                table: {
                    widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                    body: yearlyBody
                }
            });
        }

        pdfMake.createPdf(docDefinition).download(`${analyticsFilter}_Sales_Report.pdf`);
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (itemSortConfig.key === key && itemSortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setItemSortConfig({ key, direction });
    };

    if (loading) return null;

    // --- Base Styles ---
    const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden' };
    const thStyle = { padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em' };
    const tdStyle = { padding: '16px', borderBottom: '1px solid var(--border-rgba-05)', color: 'var(--text-primary)', fontWeight: '600' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1400px' }}>
            
            {/* Header & Dashboard Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                   <h2 style={{fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                      <History style={{ color: '#0ea5e9' }} size={32} />
                      Billing History
                   </h2>
                   <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '15px', marginTop: '8px' }}>Manage past transactions and analyze sales.</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today's Revenue</span>
                    <h3 style={{ fontSize: '32px', fontWeight: 900, color: '#10b981', margin: 0 }}>₹{todayRevenue.toFixed(2)}</h3>
                </div>
                <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Invoices Today</span>
                    <h3 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{todayBills.length}</h3>
                </div>
                <div 
                    onClick={() => setActiveView(activeView === 'history' ? 'analytics' : 'history')}
                    style={{ backgroundColor: '#0ea5e9', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 8px 16px rgba(14, 165, 233, 0.2)' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    {activeView === 'history' ? (
                        <>
                            <BarChart2 size={28} color="white" />
                            <span style={{ fontSize: '20px', fontWeight: 900, color: 'white' }}>Sales Analytics</span>
                        </>
                    ) : (
                        <>
                            <ArrowLeft size={28} color="white" />
                            <span style={{ fontSize: '20px', fontWeight: 900, color: 'white' }}>Back to History</span>
                        </>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            {activeView === 'history' ? (
                // HISTORY VIEW (Table)
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Transaction History</h3>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-muted)' }} size={16} />
                            <input 
                                placeholder="Search Invoice No or Table..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{width: '100%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '10px 16px 10px 44px', borderRadius: '8px', outline: 'none', fontWeight: 600, fontSize: '14px' }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Invoice No</th>
                                    <th style={thStyle}>Date & Time</th>
                                    <th style={thStyle}>Customer Type</th>
                                    <th style={thStyle}>Table / Info</th>
                                    <th style={thStyle}>Total Amount</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentBills.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                            <Ban size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                            <p style={{ margin: 0, fontWeight: 600 }}>No transactions found.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    currentBills.map(bill => (
                                        <tr key={bill.id} style={{ transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-base)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <td style={tdStyle}>#{bill.id}</td>
                                            <td style={tdStyle}>{new Date(bill.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                            <td style={tdStyle}>
                                                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 800, backgroundColor: isParcel(bill.table_number) ? 'rgba(245, 158, 11, 0.1)' : 'rgba(14, 165, 233, 0.1)', color: isParcel(bill.table_number) ? '#f59e0b' : '#0ea5e9' }}>
                                                    {isParcel(bill.table_number) ? 'PARCEL' : 'DINE-IN'}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>{bill.table_number}</td>
                                            <td style={{...tdStyle, color: '#10b981', fontWeight: 900}}>₹{parseFloat(bill.final_amount).toFixed(2)}</td>
                                            <td style={tdStyle}>
                                                {bill.is_paid ? (
                                                    <span style={{ fontSize: '11px', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '4px', fontWeight: 800 }}>
                                                        PAID
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: '4px 8px', borderRadius: '4px', fontWeight: 800 }}>
                                                        UNPAID
                                                    </span>
                                                )}
                                            </td>
                                            <td style={tdStyle}>
                                                <button onClick={() => handleBillClick(bill.id)} style={{ padding: '6px 12px', backgroundColor: 'var(--bg-border)', border: 'none', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'default' : 'pointer' }}>Prev</button>
                            <span style={{ padding: '8px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>{currentPage} / {totalPages}</span>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'default' : 'pointer' }}>Next</button>
                        </div>
                    )}
                </div>
            ) : (
                // ANALYTICS VIEW
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '16px', border: '1px solid var(--bg-border)' }}>
                    
                    {/* Header & Filters */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>Sales & Performance Analytics</h3>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>Detailed breakdown of revenue, orders, and item popularity.</p>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select value={analyticsFilter} onChange={e => setAnalyticsFilter(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
                                <option value="Today">Today</option>
                                <option value="Month">Monthly</option>
                                <option value="Year">Yearly</option>
                                <option value="Custom">Custom Range</option>
                            </select>

                            {analyticsFilter === 'Month' && (
                                <>
                                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
                                        {monthsList.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
                                        {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </>
                            )}
                            
                            {analyticsFilter === 'Year' && (
                                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            )}

                            {analyticsFilter === 'Custom' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                        type="date" 
                                        value={startDate} 
                                        onChange={e => setStartDate(e.target.value)} 
                                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
                                    />
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>to</span>
                                    <input 
                                        type="date" 
                                        value={endDate} 
                                        onChange={e => setEndDate(e.target.value)} 
                                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
                                    />
                                </div>
                            )}

                            <button onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#f43f5e', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
                                <Download size={16} /> Export PDF
                            </button>
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-rgba-05)' }} />

                    {/* Analytics Summary Sections */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        
                        {/* Collection Summary */}
                        <div style={{ backgroundColor: 'var(--bg-base)', padding: '24px', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection Summary</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <span>Restaurant Collection (Dine-In)</span>
                                    <span>₹{totalDineInRevenue.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <span>Parcel Collection</span>
                                    <span>₹{totalParcelRevenue.toFixed(2)}</span>
                                </div>
                                <div style={{ height: '1px', borderTop: '1px dashed var(--bg-border)', margin: '4px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <span>Cash Collection</span>
                                    <span>₹{totalCashRevenue.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <span>Online Collection</span>
                                    <span>₹{totalOnlineRevenue.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#10b981', fontSize: '18px', paddingTop: '12px', borderTop: '1px dashed var(--bg-border)' }}>
                                    <span>Total Collection</span>
                                    <span>₹{grandTotalRevenue.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Customer Summary */}
                        <div style={{ backgroundColor: 'var(--bg-base)', padding: '24px', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer Summary</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <span>Total Dine-In Orders</span>
                                    <span>{dineInBills.length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <span>Total Parcel Orders</span>
                                    <span>{parcelBills.length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#0ea5e9', fontSize: '18px', paddingTop: '12px', borderTop: '1px dashed var(--bg-border)' }}>
                                    <span>Total Orders Served</span>
                                    <span>{analyticsBills.length}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Item Sales / Yearly Tables */}
                    {analyticsFilter === 'Year' && (
                        <div style={{ marginTop: '16px' }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yearly Revenue Breakdown</h4>
                            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
                                <table style={tableStyle}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Month</th>
                                            <th style={thStyle}>Cash Collection</th>
                                            <th style={thStyle}>Online Collection</th>
                                            <th style={thStyle}>Parcel Revenue</th>
                                            <th style={thStyle}>Dine-In Revenue</th>
                                            <th style={thStyle}>Total Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {yearlyData.map((row, i) => (
                                            <tr key={i}>
                                                <td style={tdStyle}>{row.month}</td>
                                                <td style={tdStyle}>₹{row.cashRev.toFixed(2)}</td>
                                                <td style={tdStyle}>₹{row.onlineRev.toFixed(2)}</td>
                                                <td style={tdStyle}>₹{row.parcelRev.toFixed(2)}</td>
                                                <td style={tdStyle}>₹{row.dineInRev.toFixed(2)}</td>
                                                <td style={{...tdStyle, fontWeight: 900, color: '#10b981'}}>₹{row.totalRev.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {(analyticsFilter === 'Today' || analyticsFilter === 'Custom') && (
                        <div style={{ marginTop: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Sales Summary</h4>
                                <div style={{ position: 'relative', width: '250px' }}>
                                    <Search style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }} size={14} />
                                    <input 
                                        placeholder="Search Items..."
                                        value={itemSearchTerm}
                                        onChange={(e) => setItemSearchTerm(e.target.value)}
                                        style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '8px 12px 8px 36px', borderRadius: '6px', outline: 'none', fontWeight: 600, fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
                                <table style={tableStyle}>
                                    <thead>
                                        <tr>
                                            <th style={{...thStyle, cursor: 'pointer'}} onClick={() => handleSort('name')}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Item Name {itemSortConfig.key === 'name' && (itemSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                            </th>
                                            <th style={{...thStyle, cursor: 'pointer'}} onClick={() => handleSort('quantity')}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Quantity Sold {itemSortConfig.key === 'quantity' && (itemSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                            </th>
                                            <th style={{...thStyle, cursor: 'pointer'}} onClick={() => handleSort('revenue')}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Revenue Generated {itemSortConfig.key === 'revenue' && (itemSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemSales.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No items sold in this period.</td>
                                            </tr>
                                        ) : (
                                            itemSales.map((item, i) => (
                                                <tr key={i}>
                                                    <td style={tdStyle}>{item.name}</td>
                                                    <td style={tdStyle}>{item.quantity}</td>
                                                    <td style={{...tdStyle, color: '#10b981', fontWeight: 800}}>₹{item.revenue.toFixed(2)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Bill Details Modal */}
            {selectedBill && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', backdropFilter: 'blur(16px)' }}>
                <div className="order-modal-container" style={{width: '100%', maxWidth: '850px', backgroundColor: 'var(--bg-card)', borderRadius: '40px', overflow: 'hidden', display: 'flex', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)' }}>
                    <div style={{ flex: 1, padding: '48px', borderRight: '1px solid var(--bg-border)', backgroundColor: selectedBill.is_paid ? '#10b981' : 'var(--bg-base)', transition: 'all 0.6s', overflowY: 'auto', position: 'relative' }}>
                        {selectedBill.is_paid && (
                        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                            <div style={{backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '50%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                                <CheckCircle size={100} color="#10b981" />
                            </div>
                        </div>
                        )}
                        <div style={{ textAlign: 'center', marginBottom: '24px', opacity: selectedBill.is_paid ? 0.3 : 1 }}>
                        <h1 style={{ margin: 0, fontWeight: 950, fontSize: '28px', color: selectedBill.is_paid ? 'white' : 'var(--text-primary)' }}>{(selectedBill.hotel_name || user?.hotel_name || 'BESTBILL').toUpperCase()}</h1>
                        <div style={{ color: selectedBill.is_paid ? 'white' : 'var(--text-muted)', fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>{selectedBill.hotel_location}</div>
                        </div>
                        
                        <div style={{ borderTop: '2px dashed var(--text-muted)', borderBottom: '2px dashed var(--text-muted)', padding: '16px 0', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900, color: selectedBill.is_paid ? 'white' : 'var(--text-muted)' }}>
                            <span>TABLE NO: {selectedBill.table_number}</span>
                            <span>BILL NO: #{selectedBill.id}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: selectedBill.is_paid ? 'white' : 'var(--text-muted)' }}>DATE: {new Date(selectedBill.created_at).toLocaleDateString()} {new Date(selectedBill.created_at).toLocaleTimeString()}</div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 100px', borderBottom: '1px dashed var(--text-muted)', paddingBottom: '8px', marginBottom: '12px', fontSize: '12px', fontWeight: 900, color: selectedBill.is_paid ? 'white' : 'var(--text-muted)' }}>
                            <span>Item</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Total</span>
                        </div>
                        {(selectedBill.items || []).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '16px 0', color: selectedBill.is_paid ? 'white' : 'var(--text-muted)', fontWeight: 800, fontSize: '14px', fontStyle: 'italic' }}>
                                Item details cleared for performance
                            </div>
                        ) : (
                            (selectedBill.items || []).map((i, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 100px', fontSize: '15px', fontWeight: 800, marginBottom: '8px', color: selectedBill.is_paid ? 'white' : 'var(--text-primary)' }}>
                                <span>{i.name}</span><span style={{ textAlign: 'right' }}>₹{Math.round(i.price)}</span><span style={{ textAlign: 'right' }}>{i.quantity}</span><span style={{ textAlign: 'right' }}>₹{(i.price * i.quantity).toFixed(2)}</span>
                                </div>
                            ))
                        )}
                        </div>

                        <div style={{ borderTop: '1px dashed var(--text-muted)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', color: selectedBill.is_paid ? 'white' : 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800 }}><span>SUBTOTAL</span><span>₹{parseFloat(selectedBill.subtotal || 0).toFixed(2)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800 }}><span>GST</span><span>₹{parseFloat(selectedBill.gst || 0).toFixed(2)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '42px', fontWeight: 1000, color: selectedBill.is_paid ? 'white' : '#10b981', borderTop: '4px double var(--text-muted)', marginTop: '12px', paddingTop: '12px' }}><span>TOTAL</span><span>₹{parseFloat(selectedBill.final_amount).toFixed(2)}</span></div>
                        </div>

                        <div style={{ marginTop: '48px' }}>
                        {selectedBill.is_paid && (
                            <div style={{textAlign: 'center', padding: '24px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '24px', color: 'white', fontWeight: 950, fontSize: '20px' }}>SUCCESSFULLY SETTLED</div>
                        )}
                        </div>
                    </div>

                    <div style={{ width: '380px', padding: '48px', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div style={{textAlign: 'center', backgroundColor: 'white', padding: '24px', borderRadius: '32px', display: 'inline-block', margin: '0 auto' }}>
                        <QRCodeCanvas id="history-qr-canvas" value={`upi://pay?pa=${user?.upi_id || ''}&pn=${encodeURIComponent(selectedBill.hotel_name || user?.hotel_name || 'BESTBILL')}&am=${selectedBill.final_amount}&cu=INR`} size={180} />
                        </div>
                        <div style={{backgroundColor: 'var(--bg-base)', padding: '20px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--bg-border)' }}>
                            <Phone size={18} color="var(--text-muted)" />
                            <input 
                            placeholder="Customer Mobile No" 
                            value={customerPhone} 
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            style={{ border: 'none', width: '100%', outline: 'none', fontWeight: 800, fontSize: '15px', background: 'transparent', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={printBill} style={{flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800', fontSize: '14px' }}>
                                <Printer size={18} /> Print
                            </button>
                            <button onClick={shareViaWhatsApp} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800', fontSize: '14px' }}>
                                <MessageCircle size={18} /> WhatsApp
                            </button>
                        </div>
                        <button onClick={() => setSelectedBill(null)} style={{width: '100%', padding: '20px', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)', borderRadius: '20px', fontWeight: 900, cursor: 'pointer' }}>CLOSE</button>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
};

export default BillingHistory;
