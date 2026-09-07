import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  Wallet, 
  Search, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Trash2, 
  Edit, 
  Plus, 
  X,
  FileText,
  UserCheck,
  ChevronRight,
  History
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CreditManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions', 'customers', 'vendors'
  
  // Dashboard Summary stats
  const [summary, setSummary] = useState({
    customerOutstandingAmount: 0,
    vendorOutstandingAmount: 0,
    totalOutstandingAmount: 0,
    totalSettledAmount: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [partyType, setPartyType] = useState('all'); // 'all', 'customer', 'vendor'
  const [status, setStatus] = useState('all'); // 'all', 'pending', 'partial', 'settled'
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Grouped Customers state
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);

  // Transactions list state
  const [transactions, setTransactions] = useState([]);

  // Vendor Management states
  const [vendors, setVendors] = useState([]);
  const [editingVendor, setEditingVendor] = useState(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorGst, setVendorGst] = useState('');

  // Transaction detail view
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetails, setTxDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Partial Settlement Modal state
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null); // { type: 'customer'|'transaction', phone?, id?, maxAmount: number, name: string }
  const [settleAmount, setSettleAmount] = useState('');
  const [settlePaymentMethod, setSettlePaymentMethod] = useState('cash');
  const [settleNotes, setSettleNotes] = useState('');
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Fetch Dashboard Summary
  const fetchSummary = async () => {
    try {
      const res = await api.get('/credit/dashboard');
      setSummary(res.data || {});
    } catch (err) {
      toast.error('Failed to load dashboard summary');
    }
  };

  // Fetch Grouped Customers
  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/credit/customers', { params });
      setCustomers(res.data || []);
    } catch (err) {
      toast.error('Failed to load customer credit records');
    } finally {
      setLoadingCustomers(false);
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
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/credit/transactions', { params });
      setTransactions(res.data || []);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Vendors
  const fetchVendors = async () => {
    try {
      const res = await api.get('/credit/vendors');
      setVendors(res.data || []);
    } catch (err) {
      toast.error('Failed to load vendors');
    }
  };

  // Fetch Customer Credit History Details
  const handleViewCustomerDetails = async (phone) => {
    setSelectedCustomerPhone(phone);
    try {
      setLoadingCustomerDetails(true);
      const res = await api.get(`/credit/customers/${encodeURIComponent(phone)}`);
      setCustomerDetails(res.data);
    } catch (err) {
      toast.error('Failed to load customer credit history');
    } finally {
      setLoadingCustomerDetails(false);
    }
  };

  // Fetch Single Transaction detailed view
  const handleViewTxDetails = async (tx) => {
    setSelectedTx(tx);
    try {
      setLoadingDetails(true);
      const res = await api.get(`/credit/transactions/${tx.id}`);
      setTxDetails(res.data);
    } catch (err) {
      toast.error('Error fetching transaction details');
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchCustomers();
    fetchTransactions();
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType, status, dateFilter, startDate, endDate, searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCustomers();
    fetchTransactions();
  };

  // Open Partial Settlement Modal for Customer Account
  const openCustomerSettleModal = (customer) => {
    const rem = parseFloat(Number(customer.remaining_balance || 0).toFixed(2));
    setSettleTarget({
      type: 'customer',
      phone: customer.customer_phone,
      name: customer.customer_name,
      maxAmount: rem,
      title: `Settle Credit for ${customer.customer_name} (${customer.customer_phone})`
    });
    setSettleAmount(rem.toFixed(2));
    setSettlePaymentMethod('cash');
    setSettleNotes('');
    setShowSettleModal(true);
  };

  // Open Partial Settlement Modal for Single Transaction
  const openTxSettleModal = (tx) => {
    const rawRem = tx.remaining_amount !== undefined ? tx.remaining_amount : (tx.amount - (tx.paid_amount || 0));
    const rem = parseFloat(Number(rawRem || 0).toFixed(2));
    setSettleTarget({
      type: 'transaction',
      id: tx.id,
      billId: tx.bill_id,
      name: tx.party_type === 'vendor' ? (tx.vendor_name || 'Vendor') : (tx.customer_name || 'Customer'),
      maxAmount: rem,
      title: `Settle Bill #${tx.bill_id || tx.id} - ${tx.party_type === 'vendor' ? tx.vendor_name : tx.customer_name}`
    });
    setSettleAmount(rem.toFixed(2));
    setSettlePaymentMethod('cash');
    setSettleNotes('');
    setShowSettleModal(true);
  };

  // Submit Partial/Full Settlement
  const handleExecuteSettlement = async (shouldPrint = false) => {
    if (!settleTarget) return;
    const payVal = parseFloat(settleAmount);
    if (isNaN(payVal) || payVal <= 0) {
      return toast.error('Please enter a valid payment amount greater than ₹0');
    }
    if (payVal > settleTarget.maxAmount + 0.01) {
      return toast.error(`Payment amount (₹${payVal}) cannot exceed remaining balance (₹${settleTarget.maxAmount})`);
    }

    try {
      setSubmittingSettle(true);
      if (settleTarget.type === 'customer') {
        const res = await api.post(`/credit/customers/${encodeURIComponent(settleTarget.phone)}/settle`, {
          amount_paid: payVal,
          method: settlePaymentMethod,
          notes: settleNotes
        });
        toast.success(`Payment of ₹${payVal.toFixed(2)} recorded successfully!`);
        
        // Refresh customer details if modal is open
        if (selectedCustomerPhone === settleTarget.phone) {
          handleViewCustomerDetails(settleTarget.phone);
        }
      } else {
        const res = await api.post(`/credit/transactions/${settleTarget.id}/settle`, {
          amount_paid: payVal,
          method: settlePaymentMethod,
          notes: settleNotes
        });
        toast.success(`Payment of ₹${payVal.toFixed(2)} recorded! Status: ${res.data.status?.toUpperCase()}`);

        if (shouldPrint && settleTarget.billId) {
          try {
            await api.post(`/bills/${settleTarget.billId}/print`, { 
              paymentMethod: settlePaymentMethod, 
              isCreditSettlement: true, 
              settlementPaymentMethod: settlePaymentMethod 
            });
            toast.success('Receipt sent to printer');
          } catch (pErr) {
            toast.error('Print failed');
          }
        }

        if (selectedTx && selectedTx.id === settleTarget.id) {
          handleViewTxDetails(selectedTx);
        }
        if (selectedCustomerPhone) {
          handleViewCustomerDetails(selectedCustomerPhone);
        }
      }

      setShowSettleModal(false);
      fetchSummary();
      fetchCustomers();
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Settlement failed');
    } finally {
      setSubmittingSettle(false);
    }
  };

  // Vendor Save / Edit
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
      fetchTransactions();
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
    if (!window.confirm('Are you sure you want to delete this vendor? Existing credit records will remain.')) return;
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

  // Styles
  const cardStyle = { backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '8px' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden' };
  const thStyle = { padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em' };
  const tdStyle = { padding: '16px', borderBottom: '1px solid var(--border-rgba-05)', color: 'var(--text-primary)', fontWeight: '600' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', maxWidth: '1400px' }}>
      
      {/* Page Title & Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
              <Wallet style={{ color: '#f59e0b' }} size={32} />
              Credit Management
           </h2>
           <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '14px', marginTop: '6px' }}>Monitor customer & vendor credits, view complete customer history, and record partial or full settlements.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--bg-card)', padding: '6px', borderRadius: '14px', border: '1px solid var(--bg-border)' }}>
          <button 
            onClick={() => setActiveTab('transactions')}
            style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '13px', backgroundColor: activeTab === 'transactions' ? '#f59e0b' : 'transparent', color: activeTab === 'transactions' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s' }}
          >
            All Credit Bills
          </button>
          <button 
            onClick={() => setActiveTab('customers')}
            style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '13px', backgroundColor: activeTab === 'customers' ? '#f59e0b' : 'transparent', color: activeTab === 'customers' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s' }}
          >
            Customer Credit
          </button>
          <button 
            onClick={() => setActiveTab('vendors')}
            style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '13px', backgroundColor: activeTab === 'vendors' ? '#f59e0b' : 'transparent', color: activeTab === 'vendors' ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s' }}
          >
            Vendors Credit
          </button>
        </div>
      </div>

      {/* Global Dashboard Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <div style={cardStyle}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Outstanding</span>
          <h3 style={{ fontSize: '30px', fontWeight: 900, color: '#f43f5e', margin: 0 }}>₹{summary.totalOutstandingAmount ? summary.totalOutstandingAmount.toFixed(2) : '0.00'}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Total pending balances</span>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Outstanding</span>
          <h3 style={{ fontSize: '30px', fontWeight: 900, color: '#38bdf8', margin: 0 }}>₹{summary.customerOutstandingAmount ? summary.customerOutstandingAmount.toFixed(2) : '0.00'}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Pending from dining & parcels</span>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor Outstanding</span>
          <h3 style={{ fontSize: '30px', fontWeight: 900, color: '#f59e0b', margin: 0 }}>₹{summary.vendorOutstandingAmount ? summary.vendorOutstandingAmount.toFixed(2) : '0.00'}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Pending supplier credit</span>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Settled</span>
          <h3 style={{ fontSize: '30px', fontWeight: 900, color: '#10b981', margin: 0 }}>₹{summary.totalSettledAmount ? summary.totalSettledAmount.toFixed(2) : '0.00'}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>All-time cleared credit</span>
        </div>
      </div>

      {/* Global Search Bar & Filters Header */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Universal Search Field */}
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
            <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-muted)' }} size={18} />
            <input 
              placeholder="Search Customer Name, Vendor Name, or Mobile Number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '12px 16px 12px 48px', borderRadius: '12px', outline: 'none', fontWeight: 600, fontSize: '14px', boxSizing: 'border-box' }}
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            )}
          </form>

          {/* Filters for Transactions tab */}
          {activeTab === 'transactions' && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party Type</label>
                <select value={partyType} onChange={e => setPartyType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                  <option value="all">All Parties</option>
                  <option value="customer">Customers</option>
                  <option value="vendor">Vendors</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="settled">Settled</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date Range</label>
                <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {dateFilter === 'custom' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------- */}
      {/* TAB 1: GROUPED CUSTOMERS VIEW */}
      {/* ---------------------------------------- */}
      {activeTab === 'customers' && (
        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--bg-border)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Customer Name</th>
                <th style={thStyle}>Mobile Number</th>
                <th style={thStyle}>Total Bills</th>
                <th style={thStyle}>Total Credit</th>
                <th style={thStyle}>Paid Amount</th>
                <th style={thStyle}>Remaining Balance</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingCustomers ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', border: '3px solid var(--bg-border)', borderTopColor: '#f59e0b', animation: 'spin 1s linear infinite' }}></div>
                    <p style={{ margin: '8px 0 0', fontWeight: 600 }}>Loading customer credit accounts...</p>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No customer credit accounts found.</p>
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.customer_phone} style={{ transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-base)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={16} color="#38bdf8" />
                        <span>{c.customer_name || 'Customer'}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: '#38bdf8', fontWeight: 800 }}>{c.customer_phone}</td>
                    <td style={tdStyle}>{c.total_bills} bills</td>
                    <td style={tdStyle}>₹{parseFloat(c.total_credit).toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: '#10b981' }}>₹{parseFloat(c.total_paid).toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: c.remaining_balance > 0 ? '#f43f5e' : '#10b981', fontWeight: 900, fontSize: '15px' }}>
                      ₹{parseFloat(c.remaining_balance).toFixed(2)}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        fontSize: '11px', 
                        fontWeight: 900, 
                        textTransform: 'uppercase', 
                        backgroundColor: c.status === 'settled' ? 'rgba(16, 185, 129, 0.1)' : c.status === 'partial' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 63, 94, 0.1)', 
                        color: c.status === 'settled' ? '#10b981' : c.status === 'partial' ? '#f59e0b' : '#f43f5e' 
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleViewCustomerDetails(c.customer_phone)}
                          style={{ padding: '6px 12px', backgroundColor: 'var(--bg-border)', border: 'none', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <History size={14} /> View History
                        </button>
                        {c.remaining_balance > 0 && (
                          <button 
                            onClick={() => openCustomerSettleModal(c)}
                            style={{ padding: '6px 12px', backgroundColor: '#f59e0b', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '12px' }}
                          >
                            Settle Payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------------------------------- */}
      {/* TAB 2: ALL TRANSACTIONS VIEW */}
      {/* ---------------------------------------- */}
      {activeTab === 'transactions' && (
        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--bg-border)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Party Name</th>
                <th style={thStyle}>Mobile</th>
                <th style={thStyle}>Bill No</th>
                <th style={thStyle}>Total</th>
                <th style={thStyle}>Paid</th>
                <th style={thStyle}>Remaining</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', border: '3px solid var(--bg-border)', borderTopColor: '#f59e0b', animation: 'spin 1s linear infinite' }}></div>
                    <p style={{ margin: '8px 0 0', fontWeight: 600 }}>Loading transactions...</p>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No credit bills found.</p>
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
                    <td style={tdStyle}>₹{parseFloat(tx.amount).toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: '#10b981' }}>₹{parseFloat(tx.paid_amount || 0).toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: tx.remaining_amount > 0 ? '#f43f5e' : '#10b981', fontWeight: 900 }}>₹{parseFloat(tx.remaining_amount).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        fontWeight: 900, 
                        textTransform: 'uppercase', 
                        backgroundColor: tx.status === 'settled' ? 'rgba(16, 185, 129, 0.1)' : tx.status === 'partial' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 63, 94, 0.1)', 
                        color: tx.status === 'settled' ? '#10b981' : tx.status === 'partial' ? '#f59e0b' : '#f43f5e' 
                      }}>
                        {tx.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          onClick={() => handleViewTxDetails(tx)}
                          style={{ padding: '6px 10px', backgroundColor: 'var(--bg-border)', border: 'none', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                        >
                          Details
                        </button>
                        {tx.remaining_amount > 0 && (
                          <button 
                            onClick={() => openTxSettleModal(tx)}
                            style={{ padding: '6px 10px', backgroundColor: '#f59e0b', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '12px' }}
                          >
                            Settle
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------------------------------- */}
      {/* TAB 3: VENDORS DATABASE VIEW */}
      {/* ---------------------------------------- */}
      {activeTab === 'vendors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Suppliers & Vendors Database</h3>
            <button 
              onClick={() => { resetVendorForm(); setShowVendorModal(true); }}
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
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No vendors registered. Add vendors to record vendor credits.</td>
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

      {/* ---------------------------------------- */}
      {/* MODAL 1: CUSTOMER CREDIT HISTORY DRAWER/MODAL */}
      {/* ---------------------------------------- */}
      {selectedCustomerPhone && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '12px' : '40px', backdropFilter: 'blur(10px)' }}>
          <div style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', border: '1px solid var(--bg-border)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', padding: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-border)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck color="#38bdf8" size={24} />
                  {customerDetails?.customer_name || 'Customer'} History
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700 }}>
                  Mobile: <span style={{ color: '#38bdf8' }}>{selectedCustomerPhone}</span>
                </p>
              </div>
              <button 
                onClick={() => { setSelectedCustomerPhone(null); setCustomerDetails(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {loadingCustomerDetails ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ display: 'inline-block', width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--bg-border)', borderTopColor: '#f59e0b', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ margin: '12px 0 0', fontWeight: 700, color: 'var(--text-muted)' }}>Retrieving customer credit history...</p>
              </div>
            ) : customerDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                
                {/* Account Overview Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '16px', borderRadius: '16px', border: '1px solid var(--bg-border)' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Credit</span>
                    <h4 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>₹{customerDetails.total_credit.toFixed(2)}</h4>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid</span>
                    <h4 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 900, color: '#10b981' }}>₹{customerDetails.total_paid.toFixed(2)}</h4>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining Due</span>
                    <h4 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 900, color: customerDetails.remaining_balance > 0 ? '#f43f5e' : '#10b981' }}>₹{customerDetails.remaining_balance.toFixed(2)}</h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {customerDetails.remaining_balance > 0 && (
                      <button 
                        onClick={() => openCustomerSettleModal({ customer_phone: customerDetails.customer_phone, customer_name: customerDetails.customer_name, remaining_balance: customerDetails.remaining_balance })}
                        style={{ padding: '10px 16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
                      >
                        Settle Account
                      </button>
                    )}
                  </div>
                </div>

                {/* Detailed Transactions Timeline */}
                <h4 style={{ margin: '8px 0 0', fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)' }}>All Credit Bills ({customerDetails.transactions.length})</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {customerDetails.transactions.map(tx => (
                    <div key={tx.id} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--bg-border)', paddingBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)' }}>Bill #{tx.bill_id || tx.id}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '12px', fontWeight: 600 }}>{new Date(tx.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: '4px', 
                            fontSize: '10px', 
                            fontWeight: 900, 
                            textTransform: 'uppercase', 
                            backgroundColor: tx.status === 'settled' ? 'rgba(16, 185, 129, 0.1)' : tx.status === 'partial' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 63, 94, 0.1)', 
                            color: tx.status === 'settled' ? '#10b981' : tx.status === 'partial' ? '#f59e0b' : '#f43f5e' 
                          }}>
                            {tx.status}
                          </span>
                          {tx.remaining_amount > 0 && (
                            <button 
                              onClick={() => openTxSettleModal(tx)}
                              style={{ padding: '4px 10px', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}
                            >
                              Settle Bill
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Financial Breakdown for this bill */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                        <span>Total: ₹{tx.amount.toFixed(2)}</span>
                        <span style={{ color: '#10b981' }}>Paid: ₹{tx.paid_amount.toFixed(2)}</span>
                        <span style={{ color: tx.remaining_amount > 0 ? '#f43f5e' : '#10b981' }}>Remaining: ₹{tx.remaining_amount.toFixed(2)}</span>
                      </div>

                      {/* Items breakdown if present */}
                      {tx.items && tx.items.length > 0 && (
                        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>Invoice Items:</div>
                          {tx.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              <span>{item.name} x {item.quantity}</span>
                              <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Payments Log */}
                      {tx.payments && tx.payments.length > 0 && (
                        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '10px 12px', borderRadius: '8px', fontSize: '11px' }}>
                          <div style={{ fontWeight: 800, color: '#10b981', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>Settlement Logs ({tx.payments.length}):</div>
                          {tx.payments.map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontWeight: 700, marginTop: '2px' }}>
                              <span>Paid ₹{parseFloat(p.amount_paid).toFixed(2)} via {p.payment_method?.toUpperCase()}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ---------------------------------------- */}
      {/* MODAL 2: SINGLE TRANSACTION DETAILS MODAL */}
      {/* ---------------------------------------- */}
      {selectedTx && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '12px' : '40px', backdropFilter: 'blur(10px)' }}>
          <div style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', border: '1px solid var(--bg-border)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', padding: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-border)', paddingBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>
                Credit Transaction Details #{selectedTx.bill_id || selectedTx.id}
              </h3>
              <button onClick={() => { setSelectedTx(null); setTxDetails(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            {loadingDetails ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ display: 'inline-block', width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--bg-border)', borderTopColor: '#f59e0b', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : txDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                
                {/* Status banner */}
                <div style={{ 
                  backgroundColor: txDetails.credit.status === 'settled' ? 'rgba(16, 185, 129, 0.1)' : txDetails.credit.status === 'partial' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 63, 94, 0.1)', 
                  border: '1px solid ' + (txDetails.credit.status === 'settled' ? '#10b981' : txDetails.credit.status === 'partial' ? '#f59e0b' : '#f43f5e'), 
                  color: txDetails.credit.status === 'settled' ? '#10b981' : txDetails.credit.status === 'partial' ? '#f59e0b' : '#f43f5e', 
                  padding: '12px 16px', borderRadius: '12px', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  {txDetails.credit.status === 'settled' ? <CheckCircle size={16} /> : <Clock size={16} />}
                  Status: {txDetails.credit.status?.toUpperCase()}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: 'var(--bg-base)', padding: '16px', borderRadius: '12px' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party Name</label>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{txDetails.credit.party_type === 'vendor' ? txDetails.credit.vendor_name : txDetails.credit.customer_name}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mobile / Phone</label>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{(txDetails.credit.party_type === 'vendor' ? txDetails.credit.vendor_phone : txDetails.credit.customer_phone) || 'N/A'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Original Amount</label>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>₹{parseFloat(txDetails.credit.amount).toFixed(2)}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining Balance</label>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: txDetails.credit.remaining_amount > 0 ? '#f43f5e' : '#10b981' }}>
                      ₹{parseFloat(txDetails.credit.remaining_amount !== undefined ? txDetails.credit.remaining_amount : (txDetails.credit.amount - (txDetails.credit.paid_amount || 0))).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Itemized Bill items */}
                {txDetails.items && txDetails.items.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice Items</h4>
                    <div style={{ backgroundColor: 'var(--bg-base)', padding: '12px', borderRadius: '12px' }}>
                      {txDetails.items.map((i, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                          <span>{i.name} x {i.quantity}</span>
                          <span>₹{(i.price * i.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Settlement Payments Log */}
                {txDetails.payments && txDetails.payments.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Payment Logs</h4>
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      {txDetails.payments.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                          <span>₹{parseFloat(p.amount_paid).toFixed(2)} paid via {p.payment_method?.toUpperCase()}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action button */}
                {txDetails.credit.remaining_amount > 0 && (
                  <button 
                    onClick={() => { setSelectedTx(null); openTxSettleModal(txDetails.credit); }}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#f59e0b', color: 'white', fontWeight: 900, fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}
                  >
                    Record Partial / Full Settlement
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ---------------------------------------- */}
      {/* MODAL 3: PARTIAL / FULL SETTLEMENT MODAL */}
      {/* ---------------------------------------- */}
      {showSettleModal && settleTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '28px', borderRadius: '24px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--bg-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{settleTarget.title}</h3>
              <button onClick={() => setShowSettleModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
            </div>

            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '13px', fontWeight: 700, color: '#f59e0b', display: 'flex', justifyContent: 'space-between' }}>
              <span>Outstanding Balance:</span>
              <span style={{ fontWeight: 900, fontSize: '15px' }}>₹{settleTarget.maxAmount.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Settlement Payment Amount (₹)</label>
              <input 
                type="number"
                step="0.01"
                placeholder="Enter amount to pay"
                value={settleAmount}
                onChange={e => setSettleAmount(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 800, fontSize: '18px', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button 
                  type="button"
                  onClick={() => setSettleAmount(settleTarget.maxAmount.toFixed(2))}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: '#38bdf8', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}
                >
                  Pay Full Amount (₹{settleTarget.maxAmount.toFixed(2)})
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment Mode</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setSettlePaymentMethod('cash')}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: settlePaymentMethod === 'cash' ? 'none' : '1px solid var(--bg-border)', backgroundColor: settlePaymentMethod === 'cash' ? '#10b981' : 'transparent', color: settlePaymentMethod === 'cash' ? 'white' : 'var(--text-primary)', fontWeight: 900, cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase' }}
                >
                  Cash
                </button>
                <button 
                  type="button"
                  onClick={() => setSettlePaymentMethod('online')}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: settlePaymentMethod === 'online' ? 'none' : '1px solid var(--bg-border)', backgroundColor: settlePaymentMethod === 'online' ? '#0ea5e9' : 'transparent', color: settlePaymentMethod === 'online' ? 'white' : 'var(--text-primary)', fontWeight: 900, cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase' }}
                >
                  Online (UPI)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Notes / Reference (Optional)</label>
              <input 
                placeholder="e.g. Partial payment received"
                value={settleNotes}
                onChange={e => setSettleNotes(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button 
                onClick={() => handleExecuteSettlement(false)}
                disabled={submittingSettle}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#111827', color: 'white', fontWeight: 900, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase' }}
              >
                {submittingSettle ? 'Saving...' : 'SETTLE & NO PRINT'}
              </button>
              {settleTarget.type === 'transaction' && (
                <button 
                  onClick={() => handleExecuteSettlement(true)}
                  disabled={submittingSettle}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#111827', color: 'white', fontWeight: 900, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  {submittingSettle ? 'Saving...' : 'SETTLE & PRINT'}
                </button>
              )}
            </div>

            <button 
              onClick={() => setShowSettleModal(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------- */}
      {/* MODAL 4: VENDOR CREATE / EDIT MODAL */}
      {/* ---------------------------------------- */}
      {showVendorModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', backdropFilter: 'blur(8px)' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '36px', borderRadius: '32px', width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--bg-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{editingVendor ? 'Edit Vendor Details' : 'Register New Vendor'}</h3>
              <button onClick={() => setShowVendorModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
            </div>

            <form onSubmit={handleSaveVendor} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor / Firm Name *</label>
                <input required value={vendorName} onChange={e => setVendorName(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mobile / Phone Number</label>
                <input value={vendorPhone} onChange={e => setVendorPhone(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GSTIN Number</label>
                <input value={vendorGst} onChange={e => setVendorGst(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email Address</label>
                <input type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Address</label>
                <textarea value={vendorAddress} onChange={e => setVendorAddress(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, resize: 'vertical', minHeight: '60px' }} />
              </div>

              <button type="submit" style={{ padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 900, fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}>
                {editingVendor ? 'Save Changes' : 'Register Vendor'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CreditManagement;
