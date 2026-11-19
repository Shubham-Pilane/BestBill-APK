import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
    Users, 
    Plus, 
    Search, 
    Phone, 
    MapPin, 
    Edit2, 
    Trash2, 
    X, 
    Check, 
    User,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const CustomerManagement = () => {
    const { user } = useAuth();
    const { t } = useLanguage();

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerToDelete, setCustomerToDelete] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: ''
    });
    const [formErrors, setFormErrors] = useState({});

    const fetchCustomers = async (page = currentPage, query = searchQuery) => {
        setLoading(true);
        try {
            const res = await api.get('/customers', {
                params: {
                    page,
                    limit: 10,
                    search: query
                }
            });
            const data = res.data || {};
            setCustomers(data.customers || []);
            setTotalCount(data.totalCount || 0);
            setTotalPages(data.totalPages || 1);
            setCurrentPage(data.currentPage || 1);
        } catch (err) {
            console.error('Failed to load customers:', err);
            toast.error(t('toast_failed_load_customers', 'Failed to load customers'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchCustomers(1, searchQuery);
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            fetchCustomers(newPage, searchQuery);
        }
    };

    const handleOpenAdd = () => {
        setModalMode('add');
        setSelectedCustomer(null);
        setFormData({ name: '', phone: '', address: '' });
        setFormErrors({});
        setShowModal(true);
    };

    const handleOpenEdit = (cust) => {
        setModalMode('edit');
        setSelectedCustomer(cust);
        setFormData({
            name: cust.name || '',
            phone: cust.phone || '',
            address: cust.address || ''
        });
        setFormErrors({});
        setShowModal(true);
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.name.trim()) {
            errors.name = t('customer_name_required', 'Customer Name is required');
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setSubmitting(true);
        try {
            if (modalMode === 'add') {
                await api.post('/customers', {
                    name: formData.name.trim(),
                    phone: formData.phone.trim(),
                    address: formData.address.trim()
                });
                toast.success(t('toast_customer_added', 'Customer added successfully!'));
            } else {
                await api.put(`/customers/${selectedCustomer.id}`, {
                    name: formData.name.trim(),
                    phone: formData.phone.trim(),
                    address: formData.address.trim()
                });
                toast.success(t('toast_customer_updated', 'Customer updated successfully!'));
            }
            setShowModal(false);
            fetchCustomers(currentPage, searchQuery);
        } catch (err) {
            toast.error(err.response?.data?.message || t('toast_operation_failed', 'Operation failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!customerToDelete) return;
        setSubmitting(true);
        try {
            await api.delete(`/customers/${customerToDelete.id}`);
            toast.success(t('toast_customer_deleted', 'Customer deleted successfully!'));
            setCustomerToDelete(null);
            // Refresh current or previous page if last item on page deleted
            const targetPage = customers.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
            fetchCustomers(targetPage, searchQuery);
        } catch (err) {
            toast.error(err.response?.data?.message || t('toast_delete_failed', 'Failed to delete customer'));
        } finally {
            setSubmitting(false);
        }
    };

    const tableStyle = {
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '0 8px',
        textAlign: 'left'
    };

    const thStyle = {
        padding: '12px 16px',
        color: 'var(--text-muted)',
        fontWeight: 800,
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    };

    const tdStyle = {
        padding: '16px',
        backgroundColor: 'var(--bg-base)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '14px',
        fontWeight: 600
    };

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: 'rgba(14, 165, 233, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9', border: '1px solid rgba(14, 165, 233, 0.25)' }}>
                        <Users size={28} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                            {t('customers_title', 'Customer Management')}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '14px', margin: '4px 0 0' }}>
                            {t('customers_subtitle', 'Manage saved customers, contact information, and billing details.')}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleOpenAdd}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        borderRadius: '14px',
                        backgroundColor: '#0ea5e9',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 900,
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
                        transition: 'transform 0.15s, background-color 0.15s'
                    }}
                >
                    <Plus size={18} />
                    <span>{t('add_customer', 'Add Customer')}</span>
                </button>
            </div>

            {/* Main Content Card */}
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Search & Counter Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
                        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder={t('search_customer_placeholder', 'Search by name or mobile number...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 36px 12px 42px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-base)',
                                color: 'var(--text-primary)',
                                fontWeight: 700,
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '2px'
                                }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '13px' }}>
                        {t('total_records', 'Total')}: <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> {t('customers_count', 'Customers')}
                    </div>
                </div>

                {/* Customers Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }}>{t('customer_name', 'Customer Name')}</th>
                                <th style={thStyle}>{t('mobile_number', 'Mobile Number')}</th>
                                <th style={thStyle}>{t('address', 'Address')}</th>
                                <th style={{ ...thStyle, textAlign: 'right', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }}>{t('actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="4" style={{ ...tdStyle, textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                        {t('loading_customers', 'Loading customers...')}
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ ...tdStyle, textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                        {searchQuery ? t('no_customers_matching', 'No customers matching your search.') : t('no_customers_yet', 'No customers saved yet. Add your first customer or save one during billing.')}
                                    </td>
                                </tr>
                            ) : (
                                customers.map((c) => (
                                    <tr key={c.id}>
                                        <td style={{ ...tdStyle, borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px' }}>
                                                    {c.name ? c.name.charAt(0).toUpperCase() : <User size={16} />}
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '14px' }}>{c.name}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>ID: #{c.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            {c.phone ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 700 }}>
                                                    <Phone size={14} color="#0ea5e9" />
                                                    <span>{c.phone}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            {c.address ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                    <MapPin size={14} color="var(--text-muted)" />
                                                    <span>{c.address}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleOpenEdit(c)}
                                                    title={t('edit', 'Edit')}
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '10px',
                                                        backgroundColor: 'var(--bg-card)',
                                                        border: '1px solid var(--border-color)',
                                                        color: '#0ea5e9',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontWeight: 700,
                                                        fontSize: '12px',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    <Edit2 size={14} />
                                                    <span>{t('edit', 'Edit')}</span>
                                                </button>
                                                <button
                                                    onClick={() => setCustomerToDelete(c)}
                                                    title={t('delete', 'Delete')}
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '10px',
                                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                                        color: '#ef4444',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontWeight: 700,
                                                        fontSize: '12px',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                    <span>{t('delete', 'Delete')}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700 }}>
                            {t('page', 'Page')} {currentPage} {t('of', 'of')} {totalPages} ({totalCount} {t('records', 'records')})
                        </span>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                                disabled={currentPage === 1}
                                onClick={() => handlePageChange(currentPage - 1)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: currentPage === 1 ? 'var(--bg-base)' : 'var(--bg-card)',
                                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                                    fontWeight: 800,
                                    cursor: currentPage === 1 ? 'default' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px'
                                }}
                            >
                                <ChevronLeft size={16} />
                                <span>{t('prev', 'Prev')}</span>
                            </button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => handlePageChange(p)}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        border: p === currentPage ? 'none' : '1px solid var(--border-color)',
                                        backgroundColor: p === currentPage ? '#0ea5e9' : 'var(--bg-base)',
                                        color: p === currentPage ? '#ffffff' : 'var(--text-primary)',
                                        fontWeight: 800,
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {p}
                                </button>
                            ))}

                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => handlePageChange(currentPage + 1)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: currentPage === totalPages ? 'var(--bg-base)' : 'var(--bg-card)',
                                    color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                                    fontWeight: 800,
                                    cursor: currentPage === totalPages ? 'default' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px'
                                }}
                            >
                                <span>{t('next', 'Next')}</span>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add / Edit Customer Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ width: '100%', maxWidth: '460px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '28px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Users size={22} />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                                    {modalMode === 'add' ? t('add_new_customer', 'Add New Customer') : t('edit_customer', 'Edit Customer')}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    {t('customer_name', 'Customer Name')} *
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('enter_customer_name', 'Enter customer name (e.g. Shubham Pilane)')}
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, name: e.target.value }));
                                        if (e.target.value.trim()) setFormErrors(prev => ({ ...prev, name: '' }));
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        border: formErrors.name ? '1.5px solid #ef4444' : '1px solid var(--border-color)',
                                        backgroundColor: 'var(--bg-base)',
                                        color: 'var(--text-primary)',
                                        fontWeight: 700,
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                {formErrors.name && (
                                    <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                                        {formErrors.name}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    {t('mobile_number', 'Mobile Number')} ({t('optional', 'Optional')})
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                    <input
                                        type="tel"
                                        placeholder={t('enter_mobile_no', 'Enter 10-digit mobile number')}
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px 12px 40px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--bg-base)',
                                            color: 'var(--text-primary)',
                                            fontWeight: 700,
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    {t('address', 'Address')} ({t('optional', 'Optional')})
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                                    <textarea
                                        rows={3}
                                        placeholder={t('enter_address', 'Enter delivery address or locality')}
                                        value={formData.address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px 12px 40px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--bg-base)',
                                            color: 'var(--text-primary)',
                                            fontWeight: 700,
                                            fontSize: '14px',
                                            outline: 'none',
                                            resize: 'none',
                                            boxSizing: 'border-box',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '12px',
                                        backgroundColor: 'var(--bg-base)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)',
                                        fontWeight: 800,
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('cancel', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '12px',
                                        backgroundColor: '#0ea5e9',
                                        border: 'none',
                                        color: '#ffffff',
                                        fontWeight: 900,
                                        fontSize: '13px',
                                        cursor: submitting ? 'wait' : 'pointer',
                                        boxShadow: '0 4px 12px rgba(14, 165, 233, 0.35)'
                                    }}
                                >
                                    {submitting ? t('saving', 'Saving...') : (modalMode === 'add' ? t('save_customer', 'Save Customer') : t('update_customer', 'Update Customer'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {customerToDelete && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '28px', border: '1px solid var(--border-color)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                            <Trash2 size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                                {t('delete_customer_title', 'Delete Customer?')}
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                                {t('delete_customer_confirm', 'Are you sure you want to delete')} <strong style={{ color: 'var(--text-primary)' }}>"{customerToDelete.name}"</strong>? {t('action_cannot_be_undone', 'This action cannot be undone.')}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setCustomerToDelete(null)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    backgroundColor: 'var(--bg-base)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontWeight: 800,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('cancel', 'Cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={handleDelete}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    backgroundColor: '#ef4444',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontWeight: 900,
                                    fontSize: '13px',
                                    cursor: submitting ? 'wait' : 'pointer',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)'
                                }}
                            >
                                {submitting ? t('deleting', 'Deleting...') : t('delete', 'Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerManagement;

