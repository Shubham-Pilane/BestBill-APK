import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
    Ban, 
    Printer, 
    Eye, 
    X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CancelOrders = () => {
    const { user } = useAuth();

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [cancelledOrders, setCancelledOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [printingId, setPrintingId] = useState(null);

    const fetchCancelledOrders = async () => {
        setLoading(true);
        try {
            const res = await api.get('/cancel-orders', {
                params: {
                    page: currentPage,
                    limit: 10
                }
            });

            const parsedRows = (res.data.cancelledOrders || []).map(o => {
                let parsedItems = [];
                try {
                    parsedItems = typeof o.items_json === 'string' ? JSON.parse(o.items_json) : (o.items_json || []);
                } catch (e) {}
                return { ...o, parsedItems };
            });

            setCancelledOrders(parsedRows);
            setTotalCount(res.data.totalCount || 0);
            setTotalPages(res.data.totalPages || 1);
        } catch (err) {
            toast.error('Failed to load cancelled orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCancelledOrders();
    }, [currentPage]);

    const handlePrintCancelOrder = async (id) => {
        setPrintingId(id);
        const t = toast.loading('Sending Cancel Order slip to printer...');
        try {
            await api.post(`/cancel-orders/${id}/print`);
            toast.success('Cancel Order slip sent to printer!', { id: t, icon: '🖨️' });
        } catch (err) {
            toast.error('Failed to print Cancel Order slip', { id: t });
        } finally {
            setPrintingId(null);
        }
    };

    const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden' };
    const thStyle = { padding: '16px 20px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em' };
    const tdStyle = { padding: '16px 20px', borderBottom: '1px solid var(--border-rgba-05)', color: 'var(--text-primary)', fontWeight: '600' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <Ban style={{ color: '#0ea5e9' }} size={32} />
                        Cancel Order Management
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '15px', marginTop: '8px' }}>
                        Track and audit all cancelled kitchen tickets and un-billed table orders.
                    </p>
                </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '28px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                        Cancelled Orders Log ({totalCount})
                    </h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Order No.</th>
                                <th style={thStyle}>Table</th>
                                <th style={thStyle}>Date & Time</th>
                                <th style={thStyle}>Total Amount</th>
                                <th style={thStyle}>KOT Status</th>
                                <th style={thStyle}>Billing Status</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ ...tdStyle, textAlign: 'center', padding: '40px' }}>Loading cancelled orders...</td>
                                </tr>
                            ) : cancelledOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ ...tdStyle, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        No cancelled orders recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                cancelledOrders.map(order => (
                                    <tr key={order.id} style={{ transition: 'background-color 0.15s' }}>
                                        <td style={{ ...tdStyle, fontWeight: 900, color: 'var(--text-primary)' }}>
                                            #{order.order_number}
                                        </td>
                                        <td style={{ ...tdStyle, fontWeight: 800 }}>
                                            {order.table_number} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>({order.floor || 'Floor 1'})</span>
                                        </td>
                                        <td style={tdStyle}>
                                            {new Date(order.cancel_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                                {new Date(order.cancel_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, fontWeight: 900, color: 'var(--text-primary)' }}>
                                            ₹{parseFloat(order.total_amount || 0).toFixed(2)}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                backgroundColor: order.kot_status === 'Printed' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                                color: order.kot_status === 'Printed' ? '#0ea5e9' : 'var(--text-muted)',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: 800
                                            }}>
                                                {order.kot_status || 'Not Printed'}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                backgroundColor: order.billing_status === 'Settled' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                color: order.billing_status === 'Settled' ? '#10b981' : '#f59e0b',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: 800
                                            }}>
                                                {order.billing_status || 'Not Settled'}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button 
                                                    onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--bg-border)',
                                                        backgroundColor: 'var(--bg-base)',
                                                        color: 'var(--text-primary)',
                                                        fontWeight: 800,
                                                        fontSize: '13px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Eye size={14} /> View Details
                                                </button>

                                                <button 
                                                    onClick={() => handlePrintCancelOrder(order.id)}
                                                    disabled={printingId === order.id}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        fontWeight: 800,
                                                        fontSize: '13px',
                                                        cursor: 'pointer',
                                                        opacity: printingId === order.id ? 0.6 : 1
                                                    }}
                                                >
                                                    <Printer size={14} /> Print
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700 }}>
                            Page {currentPage} of {totalPages} ({totalCount} records)
                        </span>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button 
                                disabled={currentPage === 1} 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--bg-border)',
                                    backgroundColor: currentPage === 1 ? 'var(--bg-base)' : 'var(--bg-card)',
                                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                                    fontWeight: 800,
                                    cursor: currentPage === 1 ? 'default' : 'pointer'
                                }}
                            >
                                Prev
                            </button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setCurrentPage(p)}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: p === currentPage ? 'none' : '1px solid var(--bg-border)',
                                        backgroundColor: p === currentPage ? '#ef4444' : 'var(--bg-base)',
                                        color: p === currentPage ? 'white' : 'var(--text-primary)',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {p}
                                </button>
                            ))}

                            <button 
                                disabled={currentPage === totalPages} 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--bg-border)',
                                    backgroundColor: currentPage === totalPages ? 'var(--bg-base)' : 'var(--bg-card)',
                                    color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                                    fontWeight: 800,
                                    cursor: currentPage === totalPages ? 'default' : 'pointer'
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showDetailModal && selectedOrder && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--bg-border)', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--bg-border)' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Ban style={{ color: '#0ea5e9' }} size={24} />
                                Cancelled Order Details #{selectedOrder.order_number}
                            </h3>
                            <button 
                                onClick={() => setShowDetailModal(false)}
                                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '6px', flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', backgroundColor: 'var(--bg-base)', padding: '16px', borderRadius: '16px', border: '1px solid var(--bg-border)' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Table / Floor</span>
                                    <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
                                        {selectedOrder.table_number} ({selectedOrder.floor || 'Floor 1'})
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Cancelled By</span>
                                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                                        {selectedOrder.cancelled_by || 'Staff'}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Cancel Time</span>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {new Date(selectedOrder.cancel_date).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)' }}>KOT Status:</span>
                                    <span style={{
                                        backgroundColor: selectedOrder.kot_status === 'Printed' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                        color: selectedOrder.kot_status === 'Printed' ? '#0ea5e9' : 'var(--text-muted)',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 900
                                    }}>
                                        {selectedOrder.kot_status || 'Not Printed'}
                                    </span>
                                </div>

                                <div style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)' }}>Billing Status:</span>
                                    <span style={{
                                        backgroundColor: selectedOrder.billing_status === 'Settled' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        color: selectedOrder.billing_status === 'Settled' ? '#10b981' : '#f59e0b',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 900
                                    }}>
                                        {selectedOrder.billing_status || 'Not Settled'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                                    Items in Order ({selectedOrder.parsedItems?.length || 0})
                                </h4>
                                <div style={{ backgroundColor: 'var(--bg-base)', borderRadius: '16px', border: '1px solid var(--bg-border)', overflow: 'hidden' }}>
                                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-base)', zIndex: 1 }}>
                                                <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                                                    <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted)' }}>Item</th>
                                                    <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Qty</th>
                                                    <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Unit Price</th>
                                                    <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedOrder.parsedItems || []).map((item, idx) => {
                                                    const qty = item.quantity || item.qty || 1;
                                                    const price = parseFloat(item.price || 0);
                                                    return (
                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-rgba-05)' }}>
                                                            <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</td>
                                                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }}>{qty}</td>
                                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>₹{price.toFixed(2)}</td>
                                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--text-primary)' }}>₹{(price * qty).toFixed(2)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ padding: '16px', borderTop: '2px dashed var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
                                        <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)' }}>Order Value / Total:</span>
                                        <span style={{ fontSize: '20px', fontWeight: 900, color: '#10b981' }}>
                                            ₹{parseFloat(selectedOrder.total_amount || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--bg-border)' }}>
                            <button 
                                onClick={() => handlePrintCancelOrder(selectedOrder.id)}
                                style={{ padding: '14px 20px', borderRadius: '14px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Printer size={18} /> Print Cancel Order
                            </button>

                            <button 
                                onClick={() => setShowDetailModal(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 900, cursor: 'pointer', textAlign: 'center', fontSize: '14px' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CancelOrders;
