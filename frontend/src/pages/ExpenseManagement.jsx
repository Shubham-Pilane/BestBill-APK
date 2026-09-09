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
    Trash2,
    Building,
    UserCheck,
    Users,
    Calendar,
    Phone,
    Briefcase,
    ChevronRight,
    FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ExpenseManagement = () => {
    const { user } = useAuth();
    const isOwner = user?.role === 'owner';

    // Tabs: 'all' | 'vendors' | 'salary'
    const [activeTab, setActiveTab] = useState('all');

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

    // Vendor Expenses State
    const [vendorSummaries, setVendorSummaries] = useState([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [selectedVendorDetail, setSelectedVendorDetail] = useState(null);
    const [showVendorDetailModal, setShowVendorDetailModal] = useState(false);

    // Staff Salaries State
    const [staffSalaries, setStaffSalaries] = useState([]);
    const [loadingSalaries, setLoadingSalaries] = useState(false);

    // Saved vendors list for dropdowns
    const [savedVendors, setSavedVendors] = useState([]);

    // Modals state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSalaryModal, setShowSalaryModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);

    // General Expense Form
    const [formData, setFormData] = useState({
        title: '',
        category: 'Groceries',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        description: '',
        vendor_id: '',
        vendor_name: '',
        vendor_phone: ''
    });

    // Staff Salary Form
    const [salaryForm, setSalaryForm] = useState({
        staff_name: '',
        salary_month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        description: ''
    });

    const [submitting, setSubmitting] = useState(false);

    // Fetch Saved Vendors
    const fetchSavedVendors = async () => {
        try {
            const res = await api.get('/credit/vendors').catch(() => ({ data: [] }));
            setSavedVendors(res.data || []);
        } catch (e) {}
    };

    // Fetch Revenue Summary
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
                } else if (filter === 'All Time') {
                    return true;
                }
                return false;
            });

            const rev = filteredBills.reduce((sum, b) => sum + parseFloat(b.final_amount || 0), 0);
            setTotalRevenue(rev);
        } catch (err) {
            console.error('Failed to fetch revenue summary:', err);
        }
    };

    // Fetch Expenses for All Expenses Tab
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

    // Fetch Vendor Expenses Summaries
    const fetchVendorSummaries = async () => {
        setLoadingVendors(true);
        try {
            const res = await api.get('/expenses/vendors/summary');
            setVendorSummaries(res.data || []);
        } catch (err) {
            toast.error('Failed to load vendor summaries');
        } finally {
            setLoadingVendors(false);
        }
    };

    // View Single Vendor Entries Breakdown
    const handleViewVendorDetails = async (vendorId) => {
        try {
            const res = await api.get(`/expenses/vendors/${vendorId}`);
            setSelectedVendorDetail(res.data);
            setShowVendorDetailModal(true);
        } catch (err) {
            toast.error('Failed to fetch vendor expense records');
        }
    };

    // Fetch Staff Salaries
    const fetchStaffSalaries = async () => {
        setLoadingSalaries(true);
        try {
            const res = await api.get('/expenses/staff-salary');
            setStaffSalaries(res.data || []);
        } catch (err) {
            toast.error('Failed to load staff salary history');
        } finally {
            setLoadingSalaries(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [filter, startDate, endDate]);

    useEffect(() => {
        fetchExpenses();
        fetchRevenueSummary();
        fetchSavedVendors();
        if (activeTab === 'vendors') fetchVendorSummaries();
        if (activeTab === 'salary') fetchStaffSalaries();
    }, [filter, startDate, endDate, currentPage, activeTab]);

    // Submit General / Vendor Expense
    const handleAddExpenseSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim()) return toast.error('Please enter Expense Title');
        if (!formData.amount || parseFloat(formData.amount) <= 0) return toast.error('Please enter a valid amount');

        setSubmitting(true);
        try {
            const payload = {
                title: formData.title.trim(),
                category: formData.vendor_name ? 'Vendor Purchase' : formData.category,
                amount: parseFloat(formData.amount),
                expense_date: formData.expense_date,
                payment_method: formData.payment_method,
                description: formData.description.trim(),
                vendor_id: formData.vendor_id ? parseInt(formData.vendor_id) : null,
                vendor_name: formData.vendor_name.trim(),
                vendor_phone: formData.vendor_phone.trim(),
                expense_type: formData.vendor_name ? 'vendor' : 'general'
            };

            await api.post('/expenses', payload);

            toast.success('Expense recorded successfully!', { icon: '💸' });
            setShowAddModal(false);
            setFormData({
                title: '',
                category: 'Groceries',
                amount: '',
                expense_date: new Date().toISOString().split('T')[0],
                payment_method: 'Cash',
                description: '',
                vendor_id: '',
                vendor_name: '',
                vendor_phone: ''
            });
            fetchExpenses();
            fetchVendorSummaries();
            fetchRevenueSummary();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add expense');
        } finally {
            setSubmitting(false);
        }
    };

    // Submit Staff Salary Expense
    const handleAddSalarySubmit = async (e) => {
        e.preventDefault();

        if (!salaryForm.staff_name.trim()) return toast.error('Please enter Staff Name');
        if (!salaryForm.amount || parseFloat(salaryForm.amount) <= 0) return toast.error('Please enter a valid salary amount');

        setSubmitting(true);
        try {
            const payload = {
                title: `Salary: ${salaryForm.staff_name.trim()} (${salaryForm.salary_month})`,
                category: 'Salary',
                amount: parseFloat(salaryForm.amount),
                expense_date: salaryForm.expense_date,
                payment_method: salaryForm.payment_method,
                description: salaryForm.description.trim() || `Staff Salary for ${salaryForm.salary_month}`,
                staff_name: salaryForm.staff_name.trim(),
                salary_month: salaryForm.salary_month.trim(),
                expense_type: 'salary'
            };

            await api.post('/expenses', payload);

            toast.success(`Salary recorded for ${salaryForm.staff_name}!`, { icon: '💼' });
            setShowSalaryModal(false);
            setSalaryForm({
                staff_name: '',
                salary_month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
                amount: '',
                expense_date: new Date().toISOString().split('T')[0],
                payment_method: 'Cash',
                description: ''
            });
            fetchExpenses();
            fetchStaffSalaries();
            fetchRevenueSummary();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record staff salary');
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
            fetchVendorSummaries();
            fetchStaffSalaries();
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
            
            {/* Header Title & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <Receipt style={{ color: '#0ea5e9' }} size={32} />
                        Expense Management
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '15px', marginTop: '8px' }}>
                        Track daily hotel expenses, vendor transactions, staff salaries, and net revenue.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                        onClick={() => setShowSalaryModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '14px 20px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            border: '1px solid #10b981',
                            fontWeight: 900,
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease'
                        }}
                    >
                        <Briefcase size={18} />
                        + Add Staff Salary
                    </button>

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
            </div>

            {/* Dashboard Summary Cards */}
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

            {/* Navigation Tabs Header */}
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    
                    {/* Tabs switcher */}
                    <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-base)', padding: '6px', borderRadius: '14px', border: '1px solid var(--bg-border)' }}>
                        <button 
                            onClick={() => setActiveTab('all')}
                            style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '13px', backgroundColor: activeTab === 'all' ? '#0ea5e9' : 'transparent', color: activeTab === 'all' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s' }}
                        >
                            All Expenses
                        </button>
                        <button 
                            onClick={() => setActiveTab('vendors')}
                            style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '13px', backgroundColor: activeTab === 'vendors' ? '#0ea5e9' : 'transparent', color: activeTab === 'vendors' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s' }}
                        >
                            Vendor Expenses
                        </button>
                        <button 
                            onClick={() => setActiveTab('salary')}
                            style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '13px', backgroundColor: activeTab === 'salary' ? '#0ea5e9' : 'transparent', color: activeTab === 'salary' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s' }}
                        >
                            Staff Salaries History
                        </button>
                    </div>

                    {/* Date Filters for All Expenses */}
                    {activeTab === 'all' && (
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
                                    <option value="All Time" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>All Time</option>
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
                    )}
                </div>

                {/* ---------------------------------------- */}
                {/* VIEW 1: ALL EXPENSES TABLE */}
                {/* ---------------------------------------- */}
                {activeTab === 'all' && (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Date</th>
                                        <th style={thStyle}>Expense Title</th>
                                        <th style={thStyle}>Type / Party</th>
                                        <th style={thStyle}>Payment Method</th>
                                        <th style={thStyle}>Amount</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" style={{ ...tdStyle, textAlign: 'center', padding: '40px' }}>Loading expenses...</td>
                                        </tr>
                                    ) : expenses.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ ...tdStyle, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
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
                                                    {exp.expense_type === 'vendor' || exp.vendor_name ? (
                                                        <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '12px', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                                                            Vendor: {exp.vendor_name || exp.title}
                                                        </span>
                                                    ) : exp.expense_type === 'salary' || exp.staff_name ? (
                                                        <span style={{ color: '#10b981', fontWeight: 800, fontSize: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                                                            Staff: {exp.staff_name || 'Staff Member'}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}>
                                                            General ({exp.category || 'Other'})
                                                        </span>
                                                    )}
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
                                                backgroundColor: p === currentPage ? '#0ea5e9' : 'var(--bg-base)',
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
                    </>
                )}

                {/* ---------------------------------------- */}
                {/* VIEW 2: VENDOR EXPENSES SUMMARY */}
                {/* ---------------------------------------- */}
                {activeTab === 'vendors' && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Vendor Name</th>
                                    <th style={thStyle}>Mobile Number</th>
                                    <th style={thStyle}>Total Entries</th>
                                    <th style={thStyle}>Total Expenses Amount</th>
                                    <th style={thStyle}>Last Expense Date</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingVendors ? (
                                    <tr>
                                        <td colSpan="6" style={{ ...tdStyle, textAlign: 'center', padding: '40px' }}>Loading vendor summary...</td>
                                    </tr>
                                ) : vendorSummaries.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ ...tdStyle, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                            No vendor expenses recorded yet. Assign a vendor when creating an expense.
                                        </td>
                                    </tr>
                                ) : (
                                    vendorSummaries.map((ven, idx) => (
                                        <tr key={ven.vendor_id || idx} style={{ transition: 'background-color 0.15s' }}>
                                            <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Building size={16} color="#38bdf8" />
                                                    <span>{ven.vendor_name || 'Vendor'}</span>
                                                </div>
                                            </td>
                                            <td style={{ ...tdStyle, color: '#38bdf8', fontWeight: 800 }}>
                                                {ven.vendor_phone || 'N/A'}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '12px' }}>
                                                    {ven.total_entries} {ven.total_entries === 1 ? 'Entry' : 'Entries'}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, color: '#f59e0b', fontWeight: 900, fontSize: '16px' }}>
                                                ₹{parseFloat(ven.total_amount || 0).toFixed(2)}
                                            </td>
                                            <td style={tdStyle}>
                                                {ven.last_expense_date ? new Date(ven.last_expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <button 
                                                    onClick={() => handleViewVendorDetails(ven.vendor_id)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 14px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        backgroundColor: '#0ea5e9',
                                                        color: 'white',
                                                        fontWeight: 800,
                                                        fontSize: '13px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Eye size={14} /> View ({ven.total_entries})
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ---------------------------------------- */}
                {/* VIEW 3: STAFF SALARY HISTORY */}
                {/* ---------------------------------------- */}
                {activeTab === 'salary' && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Staff Name</th>
                                    <th style={thStyle}>Salary Month</th>
                                    <th style={thStyle}>Amount (₹)</th>
                                    <th style={thStyle}>Payment Date</th>
                                    <th style={thStyle}>Method</th>
                                    <th style={thStyle}>Notes / Description</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingSalaries ? (
                                    <tr>
                                        <td colSpan="7" style={{ ...tdStyle, textAlign: 'center', padding: '40px' }}>Loading staff salary records...</td>
                                    </tr>
                                ) : staffSalaries.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ ...tdStyle, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                            No staff salary records found. Click "+ Add Staff Salary" to record one.
                                        </td>
                                    </tr>
                                ) : (
                                    staffSalaries.map(sal => (
                                        <tr key={sal.id} style={{ transition: 'background-color 0.15s' }}>
                                            <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <UserCheck size={16} color="#10b981" />
                                                    <span>{sal.staff_name || sal.title}</span>
                                                </div>
                                            </td>
                                            <td style={{ ...tdStyle, color: '#10b981', fontWeight: 800 }}>
                                                {sal.salary_month || 'N/A'}
                                            </td>
                                            <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: 900, fontSize: '15px' }}>
                                                ₹{parseFloat(sal.amount).toFixed(2)}
                                            </td>
                                            <td style={tdStyle}>
                                                {new Date(sal.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    backgroundColor: sal.payment_method === 'Cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                                                    color: sal.payment_method === 'Cash' ? '#10b981' : '#0ea5e9',
                                                    padding: '4px 10px',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontWeight: 800
                                                }}>
                                                    {sal.payment_method}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '13px' }}>
                                                {sal.description || '-'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                {isOwner && (
                                                    <button 
                                                        onClick={() => handleDeleteExpense(sal.id)}
                                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL 1: ADD GENERAL / VENDOR EXPENSE */}
            {showAddModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ width: '100%', maxWidth: '560px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--bg-border)', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Plus style={{ color: '#0ea5e9' }} size={24} />
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
                            
                            {/* Vendor Selector (Optional) */}
                            <div style={{ backgroundColor: 'var(--bg-base)', padding: '14px', borderRadius: '12px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Building size={14} /> Assign Vendor / Supplier (Optional)
                                </label>
                                
                                {savedVendors.length > 0 && (
                                    <select 
                                        value={formData.vendor_id}
                                        onChange={e => {
                                            const id = e.target.value;
                                            const match = savedVendors.find(v => String(v.id) === String(id));
                                            if (match) {
                                                setFormData({
                                                    ...formData,
                                                    vendor_id: match.id,
                                                    vendor_name: match.name,
                                                    vendor_phone: match.phone || '',
                                                    title: formData.title || `${match.name} Purchase`
                                                });
                                            } else {
                                                setFormData({ ...formData, vendor_id: '', vendor_name: '', vendor_phone: '' });
                                            }
                                        }}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 800, outline: 'none' }}
                                    >
                                        <option value="">-- Select Saved Vendor --</option>
                                        {savedVendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name} ({v.phone || 'No phone'})</option>
                                        ))}
                                    </select>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <input 
                                        placeholder="Vendor Name (e.g. ABC Water)"
                                        value={formData.vendor_name}
                                        onChange={e => setFormData({ ...formData, vendor_name: e.target.value, title: formData.title || e.target.value })}
                                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '13px' }}
                                    />
                                    <input 
                                        placeholder="Vendor Mobile Number"
                                        value={formData.vendor_phone}
                                        onChange={e => setFormData({ ...formData, vendor_phone: e.target.value })}
                                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '13px' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Expense Title *
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Water Bottles, Milk Supply, Vegetables"
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
                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#0ea5e9', color: 'white', fontWeight: 900, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
                                >
                                    {submitting ? 'Saving...' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: ADD STAFF SALARY */}
            {showSalaryModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ width: '100%', maxWidth: '520px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--bg-border)', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Briefcase style={{ color: '#10b981' }} size={24} />
                                Record Staff Salary Expense
                            </h3>
                            <button 
                                onClick={() => setShowSalaryModal(false)}
                                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddSalarySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Staff Member Name *
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Ramesh Kumar, Rahul, Waiter 1"
                                    value={salaryForm.staff_name}
                                    onChange={e => setSalaryForm({ ...salaryForm, staff_name: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Salary Month *
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. September 2026"
                                        value={salaryForm.salary_month}
                                        onChange={e => setSalaryForm({ ...salaryForm, salary_month: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Salary Amount (₹) *
                                    </label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        placeholder="0.00"
                                        value={salaryForm.amount}
                                        onChange={e => setSalaryForm({ ...salaryForm, amount: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Payment Date *
                                    </label>
                                    <input 
                                        type="date" 
                                        value={salaryForm.expense_date}
                                        onChange={e => setSalaryForm({ ...salaryForm, expense_date: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        Payment Mode *
                                    </label>
                                    <select
                                        value={salaryForm.payment_method}
                                        onChange={e => setSalaryForm({ ...salaryForm, payment_method: e.target.value })}
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Online">Online (UPI / Bank)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Notes / Description (Optional)
                                </label>
                                <textarea 
                                    rows="2"
                                    placeholder="e.g. Monthly salary disbursed via UPI"
                                    value={salaryForm.description}
                                    onChange={e => setSalaryForm({ ...salaryForm, description: e.target.value })}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setShowSalaryModal(false)}
                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 900, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
                                >
                                    {submitting ? 'Saving...' : 'Record Salary'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: VENDOR INDIVIDUAL TRANSACTIONS BREAKDOWN */}
            {showVendorDetailModal && selectedVendorDetail && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
                    <div style={{ width: '100%', maxWidth: '640px', maxHeight: '85vh', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--bg-border)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-border)', paddingBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Building size={20} color="#38bdf8" />
                                    {selectedVendorDetail.vendor?.name || 'Vendor Expense History'}
                                </h3>
                                <p style={{ margin: '4px 0 0', color: '#38bdf8', fontSize: '13px', fontWeight: 800 }}>
                                    Mobile: {selectedVendorDetail.vendor?.phone || 'N/A'} | Total Entries: {selectedVendorDetail.entries?.length || 0}
                                </p>
                            </div>
                            <button onClick={() => setShowVendorDetailModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {selectedVendorDetail.entries && selectedVendorDetail.entries.length > 0 ? (
                                selectedVendorDetail.entries.map((entry, idx) => (
                                    <div key={entry.id || idx} style={{ backgroundColor: 'var(--bg-base)', padding: '16px', borderRadius: '14px', border: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 900, color: '#0ea5e9', textTransform: 'uppercase' }}>ENTRY #{idx + 1} • {new Date(entry.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)' }}>{entry.title}</h4>
                                            {entry.description && <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{entry.description}</p>}
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Paid via {entry.payment_method}</span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 900, color: '#10b981' }}>₹{parseFloat(entry.amount).toFixed(2)}</span>
                                            {isOwner && (
                                                <button 
                                                    onClick={() => handleDeleteExpense(entry.id)} 
                                                    style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <Trash2 size={12} /> Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontWeight: 700 }}>
                                    No individual expenses found for this vendor.
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => setShowVendorDetailModal(false)}
                            style={{ padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                        >
                            Close Breakdown
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL 4: SINGLE EXPENSE DETAILS */}
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
