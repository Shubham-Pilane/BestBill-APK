import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  Wallet, 
  IndianRupee, 
  Search, 
  Calendar, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ArrowLeft, 
  Trash2, 
  Edit, 
  Plus, 
  X,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CreditManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' or 'vendors'
  
  // Dashboard & Transactions states
  const [summary, setSummary] = useState({
    customerOutstandingAmount: 0,
    vendorOutstandingAmount: 0,
    totalOutstandingAmount: 0,
    totalSettledAmount: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [partyType, setPartyType] = useState('all'); // 'all', 'customer', 'vendor'
  const [status, setStatus] = useState('all'); // 'all', 'pending', 'settled'
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detail Modal
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetails, setTxDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState('cash');
  
  // Vendor Management states
  const [vendors, setVendors] = useState([]);
  const [editingVendor, setEditingVendor] = useState(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorGst, setVendorGst] = useState('');

  // Fetch Summary statistics
  const fetchSummary = async () => {
    try {
      const res = await api.get('/credit/dashboard');
      setSummary(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard summary');
    }
  };

  // Fetch Transactions list
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (partyType !== 'all') params.party_type = partyType;
      if (status !== 'all') params.status = status;
      if (dateFilter !== 'all') {
        params.date_filter = dateFilter;
        if (dateFilter === 'custom') {
          params.startDate = startDate;
          params.endDate = endDate;
        }
      }
      if (searchQuery.trim()) params.search = searchQuery;

      const res = await api.get('/credit/transactions', { params });
      setTransactions(res.data || []);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Vendors list
  const fetchVendors = async () => {
    try {
      const res = await api.get('/credit/vendors');
      setVendors(res.data || []);
    } catch (err) {
      toast.error('Failed to load vendors');
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchTransactions();
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType, status, dateFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTransactions();
  };

  // Fetch transaction detailed invoice view
  const handleViewDetails = async (tx) => {
    setSelectedTx(tx);
    try {
      setLoadingDetails(true);
      const res = await api.get(`/credit/transactions/${tx.id}`);
      setTxDetails(res.data);
    } catch (err) {
      toast.error('Error fetching details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Settle Outstanding credit transaction
  const handleSettleTransaction = async (method) => {
    if (!selectedTx) return;
    try {
      await api.post(`/credit/transactions/${selectedTx.id}/settle`, { method });
      toast.success('Credit settled successfully!');
      setShowSettleModal(false);
      
      // Reload states
      fetchSummary();
      fetchTransactions();
      
      // Update local details modal state
      if (txDetails) {
        setTxDetails(prev => ({
          ...prev,
          credit: {
            ...prev.credit,
            status: 'settled',
            settled_at: new Date().toISOString(),
            settlement_payment_method: method
          },
          bill: {
            ...prev.bill,
            is_paid: true,
            payment_method: method
          }
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Settlement failed');
    }
  };

  // Vendor Create / Edit Save
  const handleSaveVendor = async (e) => {
    e.preventDefault();
    if (!vendorName.trim()) return toast.error('Vendor Name is required');
    try {
      const payload = {
        name: vendorName,
        phone: vendorPhone,
        email: vendorEmail,
        address: vendorAddress,
        gst_number: vendorGst
      };

      if (editingVendor) {
        const res = await api.put(`/credit/vendors/${editingVendor.id}`, payload);
        toast.success('Vendor details updated!');
        setVendors(prev => prev.map(v => v.id === editingVendor.id ? res.data : v));
      } else {
        const res = await api.post('/credit/vendors', payload);
        toast.success('Vendor registered successfully!');
        setVendors(prev => [...prev, res.data]);
      }
      
      setShowVendorModal(false);
      resetVendorForm();
      fetchTransactions(); // in case vendor name matches current filters
    } catch (err) {
      toast.error('Failed to save vendor details');
    }
  };

  const handleEditVendorClick = (vendor) => {
    setEditingVendor(vendor);
    setVendorName(vendor.name || '');
    setVendorPhone(vendor.phone || '');
    setVendorEmail(vendor.email || '');
    setVendorAddress(vendor.address || '');
    setVendorGst(vendor.gst_number || '');
    setShowVendorModal(true);
  };

  const handleDeleteVendor = async (vendorId) => {
    if (!window.confirm('Are you sure you want to delete this vendor? This will not affect existing transactions, but vendor references will be set to empty.')) return;
    try {
      await api.delete(`/credit/vendors/${vendorId}`);
      toast.success('Vendor deleted');
      setVendors(prev => prev.filter(v => v.id !== vendorId));
    } catch (err) {
      toast.error('Failed to delete vendor');
    }
  };

  const resetVendorForm = () => {
    setEditingVendor(null);
    setVendorName('');
    setVendorPhone('');
    setVendorEmail('');
    setVendorAddress('');
    setVendorGst('');
  };

  const openNewVendorModal = () => {
    resetVendorForm();
    setShowVendorModal(true);
  };

  // Styles
  const cardStyle = { backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '8px' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden' };
  const thStyle = { padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em' };
  const tdStyle = { padding: '16px', borderBottom: '1px solid var(--border-rgba-05)', color: 'var(--text-primary)', fontWeight: '600' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1400px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
              <Wallet style={{ color: '#f59e0b' }} size={32} />
              Credit Management
           </h2>
           <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '15px', marginTop: '8px' }}>Monitor outstanding balances, track transactions, and settle customer/vendor bills.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setActiveTab('transactions')}
            style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '14px', backgroundColor: activeTab === 'transactions' ? '#f59e0b' : 'var(--bg-border)', color: activeTab === 'transactions' ? 'white' : 'var(--text-secondary)' }}
          >
            Credit Transactions
          </button>
          <button 
            onClick={() => setActiveTab('vendors')}
            style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '14px', backgroundColor: activeTab === 'vendors' ? '#f59e0b' : 'var(--bg-border)', color: activeTab === 'vendors' ? 'white' : 'var(--text-secondary)' }}
          >
            Manage Vendors
          </button>
        </div>
      </div>

      {activeTab === 'transactions' ? (
        <>
          {/* Summary Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
            <div style={cardStyle}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Outstanding</span>
              <h3 style={{ fontSize: '32px', fontWeight: 900, color: '#f43f5e', margin: 0 }}>₹{summary.totalOutstandingAmount.toFixed(2)}</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Active balances pending settlement</span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Outstanding</span>
              <h3 style={{ fontSize: '32px', fontWeight: 900, color: '#38bdf8', margin: 0 }}>₹{summary.customerOutstandingAmount.toFixed(2)}</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Pending from dining & parcels</span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor Outstanding</span>
              <h3 style={{ fontSize: '32px', fontWeight: 900, color: '#f59e0b', margin: 0 }}>₹{summary.vendorOutstandingAmount.toFixed(2)}</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Pending supply adjustments</span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Settled</span>
              <h3 style={{ fontSize: '32px', fontWeight: 900, color: '#10b981', margin: 0 }}>₹{summary.totalSettledAmount.toFixed(2)}</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>All-time cleared credit invoices</span>
            </div>
          </div>

          {/* Filters Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--bg-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                
                {/* Party Type Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party Type</label>
                  <select value={partyType} onChange={e => setPartyType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }}>
                    <option value="all">All Parties</option>
                    <option value="customer">Customers</option>
                    <option value="vendor">Vendors</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }}>
                    <option value="all">All Records</option>
                    <option value="pending">Pending</option>
                    <option value="settled">Settled</option>
                  </select>
                </div>

                {/* Date Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date Range</label>
                  <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }}>
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {/* Custom Date Inputs */}
                {dateFilter === 'custom' && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Start Date</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>End Date</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Search Box */}
              <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '300px', marginTop: '16px' }}>
                <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-muted)' }} size={16} />
                <input 
                  placeholder="Search Name, Phone or Bill No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '10px 16px 10px 44px', borderRadius: '8px', outline: 'none', fontWeight: 600, fontSize: '14px', boxSizing: 'border-box' }}
                />
              </form>
            </div>
          </div>

          {/* Transactions Table */}
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Party Name</th>
                  <th style={thStyle}>Mobile</th>
                  <th style={thStyle}>Bill No</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', border: '3px solid var(--bg-border)', borderTopColor: '#f59e0b', animation: 'spin 1s linear infinite' }}></div>
                      <p style={{ margin: '8px 0 0', fontWeight: 600 }}>Loading transactions...</p>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5, color: 'var(--text-muted)' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>No outstanding credit records found.</p>
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.id} style={{ transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-base)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={tdStyle}>{new Date(tx.created_at).toLocaleDateString([], { dateStyle: 'medium' })}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', backgroundColor: tx.party_type === 'vendor' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(56, 189, 248, 0.1)', color: tx.party_type === 'vendor' ? '#f59e0b' : '#38bdf8' }}>
                          {tx.party_type}
                        </span>
                      </td>
                      <td style={tdStyle}>{tx.party_type === 'vendor' ? tx.vendor_name : tx.customer_name}</td>
                      <td style={tdStyle}>{(tx.party_type === 'vendor' ? tx.vendor_phone : tx.customer_phone) || 'N/A'}</td>
                      <td style={tdStyle}>#{tx.bill_id}</td>
                      <td style={{ ...tdStyle, color: tx.status === 'settled' ? '#10b981' : '#f43f5e', fontWeight: 900 }}>₹{parseFloat(tx.amount).toFixed(2)}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', backgroundColor: tx.status === 'settled' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', color: tx.status === 'settled' ? '#10b981' : '#f43f5e' }}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button 
                          onClick={() => handleViewDetails(tx)}
                          style={{ padding: '6px 12px', backgroundColor: 'var(--bg-border)', border: 'none', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Vendor Management tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Suppliers & Vendors Database</h3>
            <button 
              onClick={openNewVendorModal}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 800, cursor: 'pointer' }}
            >
              <Plus size={16} /> Add Vendor
            </button>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Vendor Name</th>
                  <th style={thStyle}>Mobile / Phone</th>
                  <th style={thStyle}>GSTIN</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Address</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No vendors registered. Add new vendors to record purchase/vendor credits.</td>
                  </tr>
                ) : (
                  vendors.map(v => (
                    <tr key={v.id}>
                      <td style={tdStyle}>{v.name}</td>
                      <td style={tdStyle}>{v.phone || 'N/A'}</td>
                      <td style={tdStyle}>{v.gst_number || 'N/A'}</td>
                      <td style={tdStyle}>{v.email || 'N/A'}</td>
                      <td style={tdStyle}>{v.address || 'N/A'}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleEditVendorClick(v)}
                            style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}
                            title="Edit Vendor"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteVendor(v.id)}
                            style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                            title="Delete Vendor"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit Details Modal */}
      {selectedTx && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', backdropFilter: 'blur(10px)' }}>
          <div className="order-modal-container" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '40px', overflow: 'hidden', display: 'flex', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)', border: '1px solid var(--border-rgba-05)', position: 'relative' }}>
            
            {/* Modal Body */}
            {loadingDetails ? (
              <div style={{ flex: 1, padding: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'inline-block', width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--bg-border)', borderTopColor: '#f59e0b', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ margin: '16px 0 0', fontWeight: 800, color: 'var(--text-muted)' }}>Retrieving credit records...</p>
              </div>
            ) : txDetails ? (
              <>
                {/* Left Side: Invoice Summary */}
                <div style={{ flex: 1, padding: '40px', backgroundColor: 'var(--bg-base)', overflowY: 'auto', borderRight: '1px solid var(--bg-border)' }}>
                  
                  {/* Status Banner */}
                  {txDetails.credit.status === 'settled' ? (
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '14px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontWeight: 700, fontSize: '13px' }}>
                      <CheckCircle size={16} /> Credit Balance Settled successfully.
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '1px solid #f43f5e', color: '#f43f5e', padding: '14px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontWeight: 700, fontSize: '13px' }}>
                      <Clock size={16} /> Credit Outstanding Payment pending.
                    </div>
                  )}

                  {/* Bill Details */}
                  {txDetails.bill ? (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h4 style={{ margin: 0, fontWeight: 950, fontSize: '20px', color: 'var(--text-primary)' }}>{(txDetails.bill.hotel_name || user?.hotel_name || 'BESTBILL').toUpperCase()}</h4>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px', marginTop: '4px' }}>{txDetails.bill.hotel_location}</div>
                      </div>

                      <div style={{ borderTop: '1px dashed var(--bg-border)', borderBottom: '1px dashed var(--bg-border)', padding: '12px 0', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                          <span>BILL NO: #{txDetails.bill.id}</span>
                          <span>DATE: {new Date(txDetails.bill.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 80px', borderBottom: '1px dashed var(--bg-border)', paddingBottom: '6px', marginBottom: '10px', fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          <span>Item</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Total</span>
                        </div>
                        {txDetails.items.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>No items recorded or cleared.</div>
                        ) : (
                          txDetails.items.map((i, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 80px', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                              <span>{i.name}</span><span style={{ textAlign: 'right' }}>₹{Math.round(i.price)}</span><span style={{ textAlign: 'right' }}>{i.quantity}</span><span style={{ textAlign: 'right' }}>₹{(i.price * i.quantity).toFixed(2)}</span>
                            </div>
                          ))
                        )}
                      </div>

                      <div style={{ borderTop: '1px dashed var(--bg-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>SUBTOTAL</span><span>₹{parseFloat(txDetails.bill.total_amount).toFixed(2)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>GST ({txDetails.bill.gst_percentage || 0}%)</span><span>₹{parseFloat(txDetails.bill.gst).toFixed(2)}</span></div>
                        {txDetails.bill.discount_percentage > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#f43f5e' }}><span>DISCOUNT ({txDetails.bill.discount_percentage}%)</span><span>-₹{( (parseFloat(txDetails.bill.total_amount) + parseFloat(txDetails.bill.gst)) * txDetails.bill.discount_percentage / 100).toFixed(2)}</span></div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px', fontWeight: 1000, color: '#10b981', borderTop: '2px double var(--bg-border)', marginTop: '8px', paddingTop: '8px' }}><span>TOTAL DUE</span><span>₹{parseFloat(txDetails.bill.final_amount).toFixed(2)}</span></div>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      <FileText size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <p>Linked invoice data is unavailable.</p>
                    </div>
                  )}
                </div>

                {/* Right Side: Credit / Settlement Info */}
                <div style={{ width: '360px', padding: '40px', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '28px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>Account Details</h3>
                    <button 
                      onClick={() => setSelectedTx(null)} 
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', backgroundColor: 'var(--bg-base)', borderRadius: '20px', border: '1px solid var(--bg-border)' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party Type</label>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', textTransform: 'capitalize' }}>{txDetails.credit.party_type}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Name</label>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{txDetails.credit.party_type === 'vendor' ? txDetails.credit.vendor_name : txDetails.credit.customer_name}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mobile / Phone</label>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{(txDetails.credit.party_type === 'vendor' ? txDetails.credit.vendor_phone : txDetails.credit.customer_phone) || 'N/A'}</div>
                    </div>
                    {txDetails.credit.party_type === 'vendor' && txDetails.credit.vendor_gst && (
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GST Number</label>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{txDetails.credit.vendor_gst}</div>
                      </div>
                    )}
                  </div>

                  {/* Settlement Info */}
                  <div style={{ flex: 1 }}>
                    {txDetails.credit.status === 'settled' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <h4 style={{ margin: 0, color: '#10b981', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' }}>Settlement Log</h4>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Settle Date</label>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{new Date(txDetails.credit.settled_at).toLocaleString()}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment Mode</label>
                          <div style={{ fontSize: '13px', fontWeight: 900, color: '#10b981', marginTop: '2px', textTransform: 'uppercase' }}>{txDetails.credit.settlement_payment_method}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '16px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          This balance is currently active. Settle this credit transaction if payment has been received in Cash or Online.
                        </div>
                        {showSettleModal ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Select Settle Payment Mode</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                type="button"
                                onClick={() => setSettlePaymentMethod('cash')}
                                style={{ 
                                  flex: 1, 
                                  padding: '14px 8px', 
                                  backgroundColor: settlePaymentMethod === 'cash' ? '#10b981' : 'transparent', 
                                  color: settlePaymentMethod === 'cash' ? 'white' : 'var(--text-primary)', 
                                  border: settlePaymentMethod === 'cash' ? 'none' : '1px solid var(--border-rgba-1)', 
                                  borderRadius: '12px', 
                                  fontWeight: 900, 
                                  fontSize: '12px', 
                                  cursor: 'pointer', 
                                  textTransform: 'uppercase',
                                  transition: 'all 0.2s'
                                }}
                              >
                                Cash
                              </button>
                              <button 
                                type="button"
                                onClick={() => setSettlePaymentMethod('online')}
                                style={{ 
                                  flex: 1, 
                                  padding: '14px 8px', 
                                  backgroundColor: settlePaymentMethod === 'online' ? '#0ea5e9' : 'transparent', 
                                  color: settlePaymentMethod === 'online' ? 'white' : 'var(--text-primary)', 
                                  border: settlePaymentMethod === 'online' ? 'none' : '1px solid var(--border-rgba-1)', 
                                  borderRadius: '12px', 
                                  fontWeight: 900, 
                                  fontSize: '12px', 
                                  cursor: 'pointer', 
                                  textTransform: 'uppercase',
                                  transition: 'all 0.2s'
                                }}
                              >
                                Online (UPI)
                              </button>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button 
                                onClick={() => handleSettleTransaction(settlePaymentMethod)}
                                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border-rgba-1)', backgroundColor: '#111827', color: 'white', fontWeight: 900, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(17, 24, 39, 0.2)' }}
                              >
                                SETTLE & NO PRINT
                              </button>
                              <button 
                                onClick={async () => {
                                  await handleSettleTransaction(settlePaymentMethod);
                                  if (txDetails?.bill?.id) {
                                    try {
                                      await api.post(`/bills/${txDetails.bill.id}/print`);
                                      toast.success('Sent to printer successfully!');
                                    } catch (err) {
                                      toast.error('Print failed');
                                    }
                                  } else {
                                    setTimeout(() => window.print(), 500);
                                  }
                                }}
                                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border-rgba-1)', backgroundColor: '#111827', color: 'white', fontWeight: 900, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(17, 24, 39, 0.2)' }}
                              >
                                SETTLE & PRINT
                              </button>
                            </div>

                            <button 
                              onClick={() => setShowSettleModal(false)}
                              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setShowSettleModal(true)}
                            style={{ width: '100%', padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#f59e0b', color: 'white', fontWeight: 1000, fontSize: '14px', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
                          >
                            Settle Credit Balance
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, padding: '100px', textAlign: 'center' }}>
                <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
                <p>Transaction details could not be retrieved.</p>
                <button onClick={() => setSelectedTx(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vendor Create/Edit Modal */}
      {showVendorModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', backdropFilter: 'blur(8px)' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '36px', borderRadius: '32px', width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--bg-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{editingVendor ? 'Edit Vendor Details' : 'Register New Vendor'}</h3>
              <button onClick={() => setShowVendorModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
            </div>

            <form onSubmit={handleSaveVendor} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor / Supplier Name *</label>
                <input 
                  type="text" 
                  value={vendorName} 
                  onChange={e => setVendorName(e.target.value)} 
                  placeholder="e.g. ABC Traders"
                  required
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mobile / Phone Number</label>
                <input 
                  type="text" 
                  value={vendorPhone} 
                  onChange={e => setVendorPhone(e.target.value)} 
                  placeholder="e.g. 9876543210"
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GST Number (GSTIN)</label>
                <input 
                  type="text" 
                  value={vendorGst} 
                  onChange={e => setVendorGst(e.target.value)} 
                  placeholder="e.g. 27AAAAA1111A1Z1"
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email Address</label>
                <input 
                  type="email" 
                  value={vendorEmail} 
                  onChange={e => setVendorEmail(e.target.value)} 
                  placeholder="e.g. contact@abctraders.com"
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Postal Address</label>
                <textarea 
                  value={vendorAddress} 
                  onChange={e => setVendorAddress(e.target.value)} 
                  placeholder="Street address, city, state..."
                  rows={2}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowVendorModal(false)}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#f59e0b', color: 'white', fontWeight: 800, boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spinner keyframe styling */}
      <style>{`
        @keyframes spin { 
          0% { transform: rotate(0deg); } 
          100% { transform: rotate(360deg); } 
        }
      `}</style>
    </div>
  );
};

export default CreditManagement;
