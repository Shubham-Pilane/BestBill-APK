import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
    Receipt, 
    Plus, 
    IndianRupee, 
    TrendingDown, 
    TrendingUp, 
    Eye, 
    X, 
    Filter,
    Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ExpenseManagement = () => {
    const { user } = useAuth();
    const isOwner = user?.role === 'owner';

    const [filter, setFilter] = useState('Today');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);

    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        category: 'Groceries',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        description: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchRevenueSummary = async () => {
        try {
            const res = await api.get('/bills/history');
            const bills = Array.isArray(res.data) ? res.data : [];
            
            const filteredBills = bills.filter(b => {
                const bDate = new Date(b.created_at);
                const bDateStr = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}-${String(bDate.getDate()).padStart(2, '0')}`;

                if (filter === 'Today') {
                    return bDate.toDateString() === new Date().toDateString();
                } else if (filter === 'Yesterday') {
                    const yest = new Date();
                    yest.setDate(yest.getDate() - 1);
                    return bDate.toDateString() === yest.toDateString();
                } else if (filter === 'Last 15 Days') {
                    const ago15 = new Date();
                    ago15.setDate(ago15.getDate() - 14);
                    ago15.setHours(0, 0, 0, 0);
                    return bDate >= ago15;
                } else if (filter === 'Current Month') {
                    const now = new Date();
                    return bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
                } else if (filter === 'Last Month') {
                    const now = new Date();
                    const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return bDate.getMonth() === lastM.getMonth() && bDate.getFullYear() === lastM.getFullYear();
                } else if (filter === 'Custom') {
                    return bDateStr >= startDate && bDateStr <= endDate;
                }
                return false;
            });

            const rev = filteredBills.reduce((sum, b) => sum + parseFloat(b.final_amount || 0), 0);
            setTotalRevenue(rev);
        } catch (err) {
            console.error('Failed to fetch revenue summary:', err);
        }
    };

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const res = await api.get('/expenses', {
                params: {
                    filter,
                    startDate,
                    endDate,
                    page: currentPage,
                    limit: 10
                }
            });

            setExpenses(res.data.expenses || []);
            setTotalCount(res.data.totalCount || 0);
            setTotalPages(res.data.totalPages || 1);
            setTotalExpenses(res.data.totalExpensesAmount || 0);
        } catch (err) {
            toast.error('Failed to load expense records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [filter, startDate, endDate]);

    useEffect(() => {
        fetchExpenses();
        fetchRevenueSummary();
    }, [filter, startDate, endDate, currentPage]);

    const handleAddExpenseSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim()) return toast.error('Please enter Expense Title');
        if (!formData.amount || parseFloat(formData.amount) <= 0) return toast.error('Please enter a valid amount');

        setSubmitting(true);
        try {
            await api.post('/expenses', {
                title: formData.title.trim(),
                amount: parseFloat(formData.amount),
                expense_date: formData.expense_date,
                payment_method: formData.payment_method,
                description: formData.description.trim()
            });

            toast.success('Expense recorded successfully!', { icon: '💸' });
            setShowAddModal(false);
            setFormData({
                title: '',
                category: 'Groceries',
                amount: '',
                expense_date: new Date().toISOString().split('T')[0],
                payment_method: 'Cash',
                description: ''
            });
            fetchExpenses();
            fetchRevenueSummary();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add expense');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Are you sure you want to delete this expense entry?')) return;
        try {
            await api.delete(`/expenses/${id}`);
            toast.success('Expense deleted');
            if (showDetailModal) setShowDetailModal(false);
            fetchExpenses();
            fetchRevenueSummary();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    const netRevenue = totalRevenue - totalExpenses;

    const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden' };
    const thStyle = { padding: '16px 20px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em' };
    const tdStyle = { padding: '16px 20px', borderBottom: '1px solid var(--border-rgba-05)', color: 'var(--text-primary)', fontWeight: '600' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <Receipt style={{ color: '#0ea5e9' }} size={32} />
                        Expense Management
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '15px', marginTop: '8px' }}>
                        Track daily hotel expenses, manage reports, and compute net revenue.
                    </p>
                </div>

                <button 
                    onClick={() => setShowAddModal(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '14px 24px',
                        borderRadius: '12px',
                        backgroundColor: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        fontWeight: 900,
                        fontSize: '15px',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(14, 165, 233, 0.25)',
                        transition: 'transform 0.15s ease'
                    }}
                >
                    <Plus size={20} strokeWidth={3} />
                    Add Expense
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Revenue</span>
                        <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <h3 style={{ fontSize: '32px', fontWeight: 900, color: '#10b981', margin: 0 }}>
                        ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Sales collected for selected filter</span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Expenses</span>
                        <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <TrendingDown size={20} />
                        </div>
                    </div>
                    <h3 style={{ fontSize: '32px', fontWeight: 900, color: '#f59e0b', margin: 0 }}>
                        ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Expenses incurred for selected filter</span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Revenue</span>
                        <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
                            <IndianRupee size={20} />
                        </div>
                    </div>
                    <h3 style={{ fontSize: '32px', fontWeight: 900, color: netRevenue >= 0 ? '#10b981' : '#f59e0b', margin: 0 }}>
                        ₹{netRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0ea5e9', fontWeight: 800 }}>
                        <span>Formula:</span>
                        <span style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>Net Revenue = Revenue − Expenses</span>
                    </div>
                </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '28px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Expense Reports</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, margin: '4px 0 0' }}>
                            Filter and analyze expenses for different periods (Showing {expenses.length} of {totalCount} records).
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-base)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--bg-border)' }}>
                            <Filter size={16} color="var(--text-muted)" />
                            <select 
                                value={filter} 
                                onChange={e => setFilter(e.target.value)} 
                                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: 800, fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="Today" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Today</option>
                                <option value="Yesterday" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Yesterday</option>
                                <option value="Last 15 Days" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Last 15 Days</option>
                                <option value="Current Month" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Current Month</option>
                                <option value="Last Month" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Last Month</option>
                                <option value="Custom" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Custom Date Range</option>
                            </select>
                        </div>

                        {filter === 'Custom' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={e => setStartDate(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                />
                                <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>to</span>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={e => setEndDate(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Date</th>
                                <th style={thStyle}>Expense Title</th>
                                <th style={thStyle}>Payment Method</th>
                                <th style={thStyle}>Amount</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ ...tdStyle, textAlign: 'center', padding: '40px' }}>Loading expenses...</td>
                                </tr>
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ ...tdStyle, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        No expenses found for the selected period. Click "+ Add Expense" to record one.
                                    </td>
                                </tr>
                            ) : (
                                expenses.map(exp => (
                                    <tr key={exp.id} style={{ transition: 'background-color 0.15s' }}>
                                        <td style={tdStyle}>
                                            {new Date(exp.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: 800 }}>
                                            {exp.title}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                backgroundColor: exp.payment_method === 'Cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                                                color: exp.payment_method === 'Cash' ? '#10b981' : '#0ea5e9',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: 800
                                            }}>
                                                {exp.payment_method}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: 900, fontSize: '15px' }}>
                                            ₹{parseFloat(exp.amount).toFixed(2)}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <button 
                                                onClick={() => { setSelectedExpense(exp); setShowDetailModal(true); }}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '8px 14px',
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
                            Page {currentPage} of {totalPages} ({totalCount} expenses)
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
                                        backgroundColor: p === currentPage ? '#f43f5e' : 'var(--bg-base)',
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

            {showAddModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ width: '100%', maxWidth: '560px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--bg-border)', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Plus style={{ color: '#f43f5e' }} size={24} />
                                Record New Expense
                            </h3>
                            <button 
                                onClick={() => setShowAddModal(false)}
                                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Expense Title *
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Water Bottles, Staff Salary, Vegetables"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Amount (₹) *
                                </label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Expense Date *
                                    </label>
                                    <input 
                                        type="date" 
                                        value={formData.expense_date}
                                        onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Payment Method *
                                    </label>
                                    <select
                                        value={formData.payment_method}
                                        onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Online">Online</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Description (Optional)
                                </label>
                                <textarea 
                                    rows="3"
                                    placeholder="Add any specific details or notes..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setShowAddModal(false)}
                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#f43f5e', color: 'white', fontWeight: 900, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
                                >
                                    {submitting ? 'Saving...' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDetailModal && selectedExpense && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ width: '100%', maxWidth: '520px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--bg-border)', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Eye style={{ color: '#0ea5e9' }} size={24} />
                                Expense Details
                            </h3>
                            <button 
                                onClick={() => setShowDetailModal(false)}
                                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '20px', borderRadius: '16px', border: '1px solid var(--bg-border)' }}>
                            <div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Title</span>
                                <h4 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{selectedExpense.title}</h4>
                            </div>

                            <div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Amount</span>
                                <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
                                    ₹{parseFloat(selectedExpense.amount).toFixed(2)}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Expense Date</span>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                        {new Date(selectedExpense.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Payment Method</span>
                                    <div style={{ marginTop: '4px' }}>
                                        <span style={{
                                            backgroundColor: selectedExpense.payment_method === 'Cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                                            color: selectedExpense.payment_method === 'Cash' ? '#10b981' : '#0ea5e9',
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: 800
                                        }}>
                                            {selectedExpense.payment_method}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Created By</span>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                        {selectedExpense.created_by || 'Owner'}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Created Date & Time</span>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {new Date(selectedExpense.created_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {selectedExpense.description && (
                                <div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Description</span>
                                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: '1.5' }}>
                                        {selectedExpense.description}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}>
                            {isOwner && (
                                <button 
                                    onClick={() => handleDeleteExpense(selectedExpense.id)}
                                    style={{ padding: '12px 18px', borderRadius: '12px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Trash2 size={16} /> Delete Entry
                                </button>
                            )}

                            <button 
                                onClick={() => setShowDetailModal(false)}
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#0ea5e9', color: 'white', fontWeight: 900, cursor: 'pointer', textAlign: 'center' }}
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpenseManagement;
