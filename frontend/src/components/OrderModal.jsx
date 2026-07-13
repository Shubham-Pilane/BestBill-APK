import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { X, Plus, Minus, Receipt, Send, MessageSquare, MessageCircle, Utensils, Trash2, ChevronRight, IndianRupee, Clock, CheckCircle, Phone, ArrowLeft, RefreshCcw, Wallet, Printer, Search } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import SwapModal from './SwapModal';
const OrderModal = ({ table, onClose, initialMenu, allTables: passedTables }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState(initialMenu?.categories || []);
  const [allItems, setAllItems] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [isSwapModalOpen, setSwapModalOpen] = useState(false);
  const [allTables, setAllTables] = useState(passedTables || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [syncingItems, setSyncingItems] = useState(new Set());
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [partyType, setPartyType] = useState('customer'); // 'customer' or 'vendor'
  const [customerName, setCustomerName] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    if (selectedPaymentMethod === 'credit') {
      const fetchVendors = async () => {
        try {
          const res = await api.get('/credit/vendors');
          setVendors(res.data || []);
        } catch (err) {
          toast.error('Failed to load vendors');
        }
      };
      fetchVendors();
    }
  }, [selectedPaymentMethod]);


  const fetchAllMenu = async () => {
    try {
      const res = await api.get('/menu/items');
      setAllItems(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const needsOrderFetch = !!table.active_order_id;
        const needsStaticFetch = !initialMenu || !passedTables;

        const [catRes, orderRes, tablesRes] = await Promise.all([
          needsStaticFetch ? api.get('/menu/categories') : Promise.resolve({ data: initialMenu.categories }),
          needsOrderFetch ? api.get(`/tables/${table.id}/order`) : Promise.resolve({ data: { items: [] } }),
          needsStaticFetch ? api.get('/tables') : Promise.resolve({ data: passedTables })
        ]);

        if (needsStaticFetch) {
            setCategories(catRes.data || []);
            setAllTables(tablesRes.data || []);
        }
        setOrderItems(orderRes.data.items || []);
        
        await fetchAllMenu();
        
        setLoading(false);
      } catch (err) {
        console.error('Modal Init Error:', err);
        toast.error('Initialization failed');
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id]);

  useEffect(() => {
    let filtered = allItems;
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(i => String(i.category_id) === String(selectedCategory));
    }
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().replace(/\s/g, '');
      filtered = filtered.filter(i => {
        const name = i.name.toLowerCase();
        const categoryName = (i.category_name || '').toLowerCase();
        if (name.includes(searchQuery.toLowerCase()) || categoryName.includes(searchQuery.toLowerCase())) return true;
        
        let patternIdx = 0;
        for (let char of name) {
          if (char === query[patternIdx]) patternIdx++;
          if (patternIdx === query.length) return true;
        }

        patternIdx = 0;
        for (let char of categoryName) {
          if (char === query[patternIdx]) patternIdx++;
          if (patternIdx === query.length) return true;
        }

        return false;
      });
    }
    setTotalPages(Math.ceil(filtered.length / 10) || 1);
    const startIndex = (currentPage - 1) * 10;
    setItems(filtered.slice(startIndex, startIndex + 10));
    
    if (searchQuery.trim().length > 0) {
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [allItems, currentPage, selectedCategory, searchQuery]);

  const addToOrder = async (item) => {
    // Optimistic Update
    const originalItems = [...orderItems];
    let found = false;
    const newItems = originalItems.map(i => {
      if (i.menu_item_id === item.id || i.id === item.id) {
        found = true;
        return { ...i, quantity: i.quantity + 1 };
      }
      return i;
    });
    if (!found) {
      newItems.push({ ...item, quantity: 1, menu_item_id: item.id, tempId: Date.now() });
    }
    setOrderItems(newItems);
    toast.success(`+ ${item.name}`, { id: `add-${item.id}` });

    try {
      const res = await api.post(`/tables/${table.id}/order`, {
        menuItemId: item.id,
        quantity: 1
      });
      // Replace with official state from backend to ensure all IDs are perfect
      setOrderItems(res.data.items);
    } catch (err) {
      setOrderItems(originalItems);
      toast.error('Add failed');
    }
  };

  const updateQuantity = async (itemId, change) => {
    const item = orderItems.find(i => i.id === itemId);
    if (!item) return;
    
    const newQty = item.quantity + change;
    if (newQty < 1) return removeFromOrder(itemId);

    // Optimistic Update
    const originalItems = [...orderItems];
    setOrderItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i));

    try {
      await api.put(`/tables/${table.id}/order/items/${itemId}`, { quantity: newQty });
      // We rely entirely on our optimistic state, no need to overwrite with API response
    } catch (err) {
      if (err.response?.status !== 404) {
        setOrderItems(originalItems);
        toast.error('Sync failed');
      }
    }
  };

  const removeFromOrder = async (itemId) => {
    if (!itemId || syncingItems.has(itemId)) return;
    
    const originalItems = [...orderItems];
    setSyncingItems(prev => new Set(prev).add(itemId));
    setOrderItems(prev => prev.filter(i => i.id !== itemId));
    
    try {
      const res = await api.delete(`/tables/${table.id}/order/items/${itemId}`);
      if (res.data.order_deleted) {
         toast.success('Table Cleared', { icon: '✨' });
         onClose();
      }
    } catch (err) {
      setOrderItems(originalItems);
      if (err.response?.status !== 404) {
        toast.error('Removal failed');
      }
    } finally {
      setSyncingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const savePriceChange = async (orderItemId, menuItemId) => {
    try {
      // Find the full menu item to preserve other fields
      const originalItem = items.find(i => i.id === menuItemId);
      if (originalItem && editPriceValue) {
        await api.put(`/menu/items/${menuItemId}`, {
           ...originalItem,
           price: parseFloat(editPriceValue)
        });
        
        // Update local items state
        setItems(items.map(i => i.id === menuItemId ? { ...i, price: parseFloat(editPriceValue) } : i));
        
        // Update local orderItems state
        setOrderItems(orderItems.map(i => i.id === orderItemId ? { ...i, price: parseFloat(editPriceValue) } : i));
        
        toast.success('Price updated in master menu');
      }
      setEditingPriceId(null);
    } catch (err) {
      toast.error('Failed to update price');
      setEditingPriceId(null);
    }
  };

  const generateBill = async () => {
    try {
      const res = await api.post(`/tables/${table.id}/bill`, { discount_percentage: discount });
      setBillData(res.data);
      setShowBill(true);
      toast.success('Bill finalized!', {
        icon: '🧾',
        style: { borderRadius: '16px', background: 'var(--bg-card)', color: '#fff', fontWeight: 900 }
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Billing failed');
    }
  };

  const sendToKitchen = async () => {
    if (orderItems.length === 0) return toast.error('No items to send');
    const t = toast.loading('Sending KOT to kitchen...');
    try {
      const res = await api.post(`/tables/${table.id}/order/kot`, {
        waiter: user?.name || 'Waiter',
        notes: kitchenNotes
      });
      
      if (res.data && res.data.success === false) {
          toast.error(res.data.message || 'No new item added to cart', { id: t });
          return;
      }
      
      toast.success('KOT sent to kitchen successfully!', { id: t });
      
      if (table.table_number !== 'Parcel Counter') {
        onClose();
        // Force navigation to dashboard just in case the user feels they are not redirected
        if (window.location.hash !== '#/') {
            window.location.hash = '#/';
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to print KOT';
      toast.error(errorMsg, { id: t });
    }
  };
  const printBill = async () => {
    if (!billData) return;
    try {
      await api.post(`/bills/${billData.id}/print`, { paymentMethod: selectedPaymentMethod });
      toast.success('Sent to printer successfully!');
      if (!billData.is_paid) {
        await confirmPayment(selectedPaymentMethod);
      }
    } catch (err) {
      console.error('Print and settle failed:', err);
      toast.error('Print failed');
    }
  };

  const rollbackBill = async () => {
    if (billData?.is_paid) return toast.error('Paid invoices cannot be rolled back');
    try {
      await api.delete(`/tables/${table.id}/bill/${billData.id}`);
      setShowBill(false);
      setBillData(null);
      toast.success('Bill cancelled. Returning to order.');
    } catch (err) {
      toast.error('Rollback failed');
    }
  };

  const confirmPayment = async (method = 'upi') => {
    try {
       if (method === 'credit') {
          const payload = {
            bill_id: billData.id,
            party_type: partyType,
            amount: parseFloat(billData.final_amount),
            vendor_id: partyType === 'vendor' ? Number(selectedVendorId) : null,
            customer_name: partyType === 'customer' ? customerName : null,
            customer_phone: partyType === 'customer' ? customerPhone : null
          };
          if (partyType === 'customer' && !customerName.trim()) {
            return toast.error('Customer Name is required');
          }
          if (partyType === 'vendor' && !selectedVendorId) {
            return toast.error('Please select a vendor');
          }
          await api.post('/credit/save', payload);
          setBillData(prev => ({ ...prev, is_paid: false, payment_method: 'credit' }));
          setIsSuccess(true);
          toast.success('Credit Bill Recorded!');
          setTimeout(() => {
             onClose();
          }, 1800);
          return;
       }
       await api.put(`/tables/bill/${billData.id}/pay`, { method });
       setBillData(prev => ({ ...prev, is_paid: true }));
       setIsSuccess(true);
       toast.success('Transaction Completed');
       
       setTimeout(() => {
          onClose();
       }, 1800);
    } catch (err) {
       toast.error(err.response?.data?.message || 'Payment verification failed');
    }
  };

  const sendNotification = async (method) => {
    if (!customerPhone || customerPhone.length < 10) {
      return toast.error('Enter a valid mobile number');
    }
    try {
      await api.post(`/tables/${table.id}/bill/send`, { 
        method, 
        customerPhone,
        billId: billData.id
      });
      toast.success(`Invoice dispatched via ${method.toUpperCase()}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transmission failed');
    }
  };

  const handleSwapTable = async (targetTableId) => {
    try {
      await api.post(`/tables/${table.id}/swap`, { targetTableId });
      toast.success('Table migration successful');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Swap protocol failed');
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const shareViaWhatsApp = () => {
    if (!customerPhone) {
      toast.error('Please enter a phone number first');
      return;
    }
    const subVal = parseFloat(billData.subtotal);
    const taxVal = parseFloat(billData.gst);
    const preVal = subVal + taxVal;
    
    let msg = `*--- ${user?.hotel_name?.toUpperCase() || 'BESTBILL'} RECEIPT ---*\n\n`;
    msg += `Table No: ${table.table_numberByFloor || table.table_number}\n`;
    msg += `Bill No: #${billData.id}\n`;
    msg += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    msg += `\n*Items:*\n`;
    (billData.items || []).forEach(i => msg += `• ${i.name} x ${i.quantity} = ₹${(i.price * i.quantity).toFixed(2)}\n`);
    msg += `\n*------------------------*\n`;
    msg += `*Subtotal:* ₹${subVal.toFixed(2)}\n`;
    msg += `*GST (${billData.gst_percentage}%):* ₹${taxVal.toFixed(2)}\n`;
    if (billData.discount_percentage > 0) msg += `*Discount (${billData.discount_percentage}%):* -₹${(preVal * billData.discount_percentage / 100).toFixed(2)}\n`;
    msg += `*GRAND TOTAL: ₹${parseFloat(billData.final_amount).toFixed(2)}*\n`;
    msg += `\n*Visit Again!* - ${(user?.hotel_name || 'BestBill').toUpperCase()}\n`;
    
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const upiId = user?.upi_id || '';
  const hname = user?.hotel_name || 'BestBill';
  const amountVal = billData?.final_amount || 0;
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(hname)}&am=${amountVal}&cu=INR`;

  if (loading) return null;

  return (
    <div className="order-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="order-modal-container" style={{ width: '100%', maxWidth: '1440px', height: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '40px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.8)', border: '1px solid var(--border-rgba-05)' }}>
        {/* Header */}
        <div className="order-modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-rgba-05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{width: '64px', height: '64px', backgroundColor: table.active_order_id ? '#f43f5e' : '#10b981', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 900, fontSize: '28px' }}>
              {String(table.table_number || '').toLowerCase().includes('parcel') 
                ? 'PC' 
                : String(table.table_number || '').toLowerCase().includes('token') 
                  ? 'TC' 
                  : table.table_number
              }
            </div>
            <div>
              <h2 style={{fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                {String(table.table_number || '').toLowerCase().includes('parcel') 
                  ? 'Parcel Counter Summary' 
                  : String(table.table_number || '').toLowerCase().includes('token') 
                    ? 'Token Counter Summary' 
                    : `Table ${table.table_number} Summary`
                }
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>BestBill POS</span>
                 {table.active_order_id && !showBill && (
                    <button onClick={() => setSwapModalOpen(true)} style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', border: '1px solid #0ea5e9', color: '#0ea5e9', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}>SWAP TABLE</button>
                 )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-border)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
        </div>

        <div className="order-modal-content" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Menu */}
          <div className="order-modal-menu" style={{ flex: 1, borderRight: '1px solid var(--border-rgba-05)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ padding: '16px 48px', display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: 'var(--bg-base)', borderBottom: '1px solid var(--border-rgba-05)' }}>
              <div className="category-bar" style={{ display: 'flex', gap: '10px', overflowX: 'auto', flex: 1 }}>
                <button onClick={() => { setSelectedCategory('all'); setCurrentPage(1); }} style={{padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: 900, cursor: 'pointer', backgroundColor: selectedCategory === 'all' ? '#0ea5e9' : 'var(--bg-border)', color: 'var(--text-primary)', fontSize: '12px', whiteSpace: 'nowrap' }}>ALL ITEMS</button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setCurrentPage(1); }} style={{padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: 900, cursor: 'pointer', backgroundColor: selectedCategory === cat.id ? '#0ea5e9' : 'var(--bg-border)', color: 'var(--text-primary)', fontSize: '12px', whiteSpace: 'nowrap' }}>{cat.name.toUpperCase()}</button>
                ))}
              </div>

              <div className="search-bar-container" style={{ position: 'relative', width: '300px' }}>
                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Search size={18} />
                </div>
                <input 
                   type="text" 
                   placeholder="Search Menu..."
                   value={searchQuery}
                   onChange={handleSearchChange}
                   style={{width: '100%', padding: '14px 44px 14px 48px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '14px' }}
                />
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(''); setSuggestions([]); }}
                    style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={16} />
                  </button>
                )}
                {suggestions.length > 0 && (
                  <div className="search-suggestions-scrollbar" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-card)', borderRadius: '16px', marginTop: '8px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 100, border: '1px solid var(--bg-border)', overflowY: 'auto', maxHeight: '350px' }}>
                    {suggestions.map(s => (
                      <div key={s.id} onClick={() => { addToOrder(s); setSearchQuery(''); setSuggestions([]); }} style={{padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Plus size={14} color="#0ea5e9" />
                          <span>{s.name}</span>
                        </div>
                        <span style={{ color: '#10b981' }}>₹{s.price}</span>
                      </div>
                    ))}
                    {suggestions.length > 6 && (
                      <div style={{
                        position: 'sticky',
                        bottom: 0,
                        backgroundColor: 'var(--bg-card)',
                        padding: '10px 20px',
                        textAlign: 'center',
                        fontSize: '11px',
                        color: '#0ea5e9',
                        fontWeight: 900,
                        borderTop: '1px solid var(--bg-border)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: 0.95,
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.25)',
                        borderBottomLeftRadius: '16px',
                        borderBottomRightRadius: '16px',
                        pointerEvents: 'none'
                      }}>
                        <span>Scroll for more results</span>
                        <span className="bounce-arrow" style={{ display: 'inline-block' }}>↓</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', alignContent: 'start' }}>
              {items.map(item => (
                <div key={item.id} onClick={() => addToOrder(item)} style={{ 
                  backgroundColor: 'var(--bg-base)', 
                  border: '1px solid var(--bg-border)', 
                  padding: '16px 24px', 
                  borderRadius: '16px', 
                  cursor: 'pointer', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.borderColor = '#0ea5e9';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-base)';
                  e.currentTarget.style.borderColor = 'var(--bg-border)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{item.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, backgroundColor: 'rgba(100, 116, 139, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>{item.category_name?.toUpperCase()}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{item.description || 'Standard culinary selection'}</p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ color: '#10b981', fontSize: '18px', fontWeight: 900 }}>₹{item.price}</span>
                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: 'rgba(14, 165, 233, 0.1)', border: '1px solid #0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                      <Plus size={18} strokeWidth={3} />
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination Bar */}
              {(() => {
                const getPages = () => {
                  const pages = [];
                  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); return pages; }
                  pages.push(1);
                  if (currentPage > 4) pages.push('...');
                  const start = Math.max(2, currentPage - 1);
                  const end = Math.min(totalPages - 1, currentPage + 1);
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (currentPage < totalPages - 3) pages.push('...');
                  pages.push(totalPages);
                  return pages;
                };
                if (totalPages <= 1) return null;
                const btn = { height: '38px', minWidth: '38px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '13px', transition: 'all 0.15s' };
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '24px', flexWrap: 'wrap' }}>
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}
                      style={{ ...btn, padding: '0 12px', backgroundColor: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'var(--bg-border)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: currentPage === 1 ? 'default' : 'pointer' }}
                    >&#8249; Prev</button>
                    {getPages().map((p, i) => p === '...' ? (
                      <span key={`e${i}`} style={{ color: 'var(--text-muted)', fontWeight: 800, padding: '0 4px' }}>...</span>
                    ) : (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ ...btn, backgroundColor: currentPage === p ? '#0ea5e9' : 'var(--bg-border)', color: currentPage === p ? 'white' : 'var(--text-secondary)', boxShadow: currentPage === p ? '0 4px 12px rgba(14,165,233,0.4)' : 'none' }}
                      >{p}</button>
                    ))}
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}
                      style={{ ...btn, padding: '0 12px', backgroundColor: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'var(--bg-border)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: currentPage === totalPages ? 'default' : 'pointer' }}
                    >Next &#8250;</button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Cart */}
          <div className="order-modal-cart" style={{ width: '420px', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '32px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
               <Receipt size={20} color="#0ea5e9" />
               <h3 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Active Selection</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {orderItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: '20px' }}>
                  <div>
                    <div style={{color: 'var(--text-primary)', fontWeight: 900 }}>{item.name}</div>
                    {editingPriceId === item.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                         <span style={{ color: '#10b981', fontSize: '13px' }}>₹</span>
                         <input 
                           type="number" 
                           autoFocus
                           value={editPriceValue} 
                           onChange={e => setEditPriceValue(e.target.value)}
                           onBlur={() => savePriceChange(item.id, item.menu_item_id)}
                           onKeyDown={e => e.key === 'Enter' && savePriceChange(item.id, item.menu_item_id)}
                           style={{ width: '85px', backgroundColor: 'var(--bg-base)', border: '1px solid #10b981', color: '#10b981', borderRadius: '6px', padding: '4px 6px', fontSize: '13px', outline: 'none', fontWeight: 800 }}
                         />
                         <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>/ unit</span>
                      </div>
                    ) : (
                      <div 
                        onClick={() => { setEditingPriceId(item.id); setEditPriceValue(Math.round(item.price)); }}
                        style={{ color: '#10b981', fontSize: '13px', cursor: 'pointer', display: 'inline-block', borderBottom: '1px dashed rgba(16,185,129,0.4)', paddingBottom: '2px', marginTop: '4px' }}
                        title="Edit Unit Price (Updates Master Menu)"
                      >
                         ₹{Math.round(item.price * item.quantity)} {item.quantity > 1 && <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>(₹{Math.round(item.price)} each)</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={() => updateQuantity(item.id, -1)} 
                      disabled={!item.id}
                      style={{cursor: !item.id ? 'not-allowed' : 'pointer', opacity: !item.id ? 0.3 : 1, border: 'none', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)' }}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{color: 'var(--text-primary)', fontWeight: 900 }}>{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)} 
                      disabled={!item.id}
                      style={{cursor: !item.id ? 'not-allowed' : 'pointer', opacity: !item.id ? 0.3 : 1, border: 'none', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)' }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--bg-border)' }}>
              <div style={{ marginBottom: '16px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 900, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                   <span>Loyalty Discount (%)</span>
                   <input 
                      type="number" 
                      value={discount} 
                      onChange={e => setDiscount(Math.max(0, Math.min(100, e.target.value)))} 
                      style={{width: '50px', background: 'none', border: 'none', borderBottom: '2px solid #0ea5e9', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 900, outline: 'none' }} 
                   />
                 </div>
                 <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)' }}>
                   <span style={{ fontSize: '22px', fontWeight: 1000 }}>Final Due</span>
                    <span style={{ color: '#10b981', fontSize: '22px', fontWeight: 1000 }}>₹{((orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (1 + (user?.gst_percentage || 0)/100)) * (1 - discount/100)).toFixed(2)}</span>
                 </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <input 
                  type="text" 
                  value={kitchenNotes} 
                  onChange={e => setKitchenNotes(e.target.value)}
                  placeholder="Add notes for kitchen (e.g. less spicy)..." 
                  style={{width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'var(--bg-border)', border: '1px solid #334155', color: 'var(--text-primary)', fontWeight: 600, outline: 'none', fontSize: '13px' }} 
                />
              </div>
              {user?.role === 'waiter' ? (
                <button 
                  disabled={orderItems.length === 0} 
                  onClick={sendToKitchen} 
                  style={{ width: '100%', padding: '16px', borderRadius: '16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', fontWeight: 1000, fontSize: '15px', cursor: 'pointer', scale: orderItems.length === 0 ? '1' : '1.02', transition: '0.2s', opacity: orderItems.length === 0 ? 0.3 : 1 }}
                >
                  SEND TO KITCHEN
                </button>
              ) : (table.table_number === 'Parcel Counter' || user?.simpleKotEnabled) ? (
                <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                  <button disabled={orderItems.length === 0} onClick={sendToKitchen} style={{ width: '100%', padding: '16px', borderRadius: '16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', fontWeight: 1000, fontSize: '15px', cursor: 'pointer', scale: orderItems.length === 0 ? '1' : '1.02', transition: '0.2s', opacity: orderItems.length === 0 ? 0.3 : 1 }}>SEND TO KITCHEN</button>
                  <button disabled={orderItems.length === 0} onClick={generateBill} style={{ width: '100%', padding: '16px', borderRadius: '16px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', fontWeight: 1000, fontSize: '15px', cursor: 'pointer', scale: orderItems.length === 0 ? '1' : '1.02', transition: '0.2s', opacity: orderItems.length === 0 ? 0.3 : 1 }}>SETTLE TRANSACTION</button>
                </div>
              ) : (
                <button disabled={orderItems.length === 0} onClick={generateBill} style={{ width: '100%', padding: '16px', borderRadius: '16px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', fontWeight: 1000, fontSize: '15px', cursor: 'pointer', scale: orderItems.length === 0 ? '1' : '1.02', transition: '0.2s', opacity: orderItems.length === 0 ? 0.3 : 1 }}>SETTLE TRANSACTION</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBill && billData && (
        <div className="bill-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', backdropFilter: 'blur(10px)' }}>
          <div className="bill-container" style={{width: '100%', maxWidth: '850px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '40px', overflow: 'hidden', display: 'flex', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)', border: '1px solid var(--border-rgba-05)', position: 'relative' }}>
             <div style={{ flex: 1, padding: '48px', borderRight: '1px solid var(--border-rgba-05)', backgroundColor: billData.is_paid ? '#10b981' : '#0f172a', transition: 'all 0.6s', overflowY: 'auto', position: 'relative' }}>
                {isSuccess && (
                   <div style={{ position: 'absolute', inset: 0, backgroundColor: '#10b981', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                      <div style={{width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginBottom: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                         <CheckCircle size={80} strokeWidth={3} />
                      </div>
                      <h2 style={{fontSize: '32px', fontWeight: 1000, color: 'var(--text-primary)', margin: 0 }}>Transaction Complete</h2>
                      <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', marginTop: '8px', fontWeight: 800 }}>Redirecting...</p>
                   </div>
                )}
                {!!billData.is_paid && !isSuccess && (
                   <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                      <div style={{backgroundColor: 'var(--text-primary)', padding: '24px', borderRadius: '50%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                         <CheckCircle size={100} color="#10b981" />
                      </div>
                   </div>
                )}
                <div style={{ textAlign: 'center', marginBottom: '24px', opacity: billData.is_paid ? 0.3 : 1 }}>
                   <h1 style={{ margin: 0, fontWeight: 950, fontSize: '28px', color: 'white' }}>{(billData.hotel_name || user?.hotel_name || 'BESTBILL').toUpperCase()}</h1>
                   <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>{billData.hotel_location}</div>
                </div>
                
                <div style={{ borderTop: '2px dashed var(--border-rgba-05)', borderBottom: '2px dashed var(--border-rgba-05)', padding: '16px 0', marginBottom: '24px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900, color: 'white' }}>
                      <span>TABLE NO: {table.table_numberByFloor || table.table_number}</span>
                      <span>BILL NO: #{billData.id}</span>
                   </div>
                   <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>DATE: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 100px', borderBottom: '1px dashed var(--border-rgba-05)', paddingBottom: '8px', marginBottom: '12px', fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>
                      <span>Item</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Total</span>
                   </div>
                   {billData.items.map((i, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 100px', fontSize: '15px', fontWeight: 800, marginBottom: '8px', color: 'white' }}>
                        <span>{i.name}</span><span style={{ textAlign: 'right' }}>₹{Math.round(i.price)}</span><span style={{ textAlign: 'right' }}>{i.quantity}</span><span style={{ textAlign: 'right' }}>₹{(i.price * i.quantity).toFixed(2)}</span>
                      </div>
                   ))}
                </div>

                <div style={{ borderTop: '1px dashed var(--border-rgba-05)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'rgba(255,255,255,0.8)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800 }}><span>SUBTOTAL</span><span>₹{parseFloat(billData.subtotal).toFixed(2)}</span></div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800 }}><span>GST</span><span>₹{parseFloat(billData.gst).toFixed(2)}</span></div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '42px', fontWeight: 1000, color: '#10b981', borderTop: '4px double var(--border-rgba-05)', marginTop: '12px', paddingTop: '12px' }}><span>TOTAL</span><span>₹{parseFloat(billData.final_amount).toFixed(2)}</span></div>
                </div>

                <div style={{ marginTop: '48px' }}>
                  {!billData.is_paid ? (
                    <button onClick={rollbackBill} className="btn-modify-invoice" style={{ width: '100%', padding: '20px', borderRadius: '24px', border: '1px solid #475569', backgroundColor: '#334155', color: 'white', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', transition: 'background-color 0.2s' }}>MODIFY INVOICE</button>
                  ) : (
                    <div style={{textAlign: 'center', padding: '24px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '24px', color: '#10b981', fontWeight: 950, fontSize: '20px' }}>SUCCESSFULLY SETTLED</div>
                  )}
                </div>
              </div>
              <div style={{ width: '380px', padding: '36px', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     {!billData.is_paid && (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                         <div style={{ display: 'flex', gap: '8px' }}>
                           <button 
                             type="button"
                             onClick={() => setSelectedPaymentMethod('cash')} 
                             style={{ 
                               flex: 1, 
                               padding: '14px 8px', 
                               backgroundColor: selectedPaymentMethod === 'cash' ? '#10b981' : '#ffffff', 
                               color: selectedPaymentMethod === 'cash' ? 'white' : '#475569', 
                               border: selectedPaymentMethod === 'cash' ? 'none' : '1px solid #cbd5e1', 
                               borderRadius: '12px', 
                               fontWeight: 1000, 
                               cursor: 'pointer', 
                               fontSize: '13px', 
                               textTransform: 'uppercase', 
                               letterSpacing: '0.05em', 
                               boxShadow: selectedPaymentMethod === 'cash' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                               transition: 'all 0.2s'
                             }}
                           >
                             Cash
                           </button>
                           <button 
                             type="button"
                             onClick={() => setSelectedPaymentMethod('upi')} 
                             style={{ 
                               flex: 1, 
                               padding: '14px 8px', 
                               backgroundColor: selectedPaymentMethod === 'upi' ? '#0ea5e9' : '#ffffff', 
                               color: selectedPaymentMethod === 'upi' ? 'white' : '#475569', 
                               border: selectedPaymentMethod === 'upi' ? 'none' : '1px solid #cbd5e1', 
                               borderRadius: '12px', 
                               fontWeight: 1000, 
                               cursor: 'pointer', 
                               fontSize: '13px', 
                               textTransform: 'uppercase', 
                               letterSpacing: '0.05em', 
                               boxShadow: selectedPaymentMethod === 'upi' ? '0 4px 12px rgba(14, 165, 233, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                               transition: 'all 0.2s'
                             }}
                           >
                             Online
                           </button>
                           <button 
                             type="button"
                             onClick={() => setSelectedPaymentMethod('credit')} 
                             style={{ 
                               flex: 1, 
                               padding: '14px 8px', 
                               backgroundColor: selectedPaymentMethod === 'credit' ? '#f59e0b' : '#ffffff', 
                               color: selectedPaymentMethod === 'credit' ? 'white' : '#475569', 
                               border: selectedPaymentMethod === 'credit' ? 'none' : '1px solid #cbd5e1', 
                               borderRadius: '12px', 
                               fontWeight: 1000, 
                               cursor: 'pointer', 
                               fontSize: '13px', 
                               textTransform: 'uppercase', 
                               letterSpacing: '0.05em', 
                               boxShadow: selectedPaymentMethod === 'credit' ? '0 4px 12px rgba(245, 158, 11, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                               transition: 'all 0.2s'
                             }}
                           >
                             Credit
                           </button>
                         </div>
 
                         {selectedPaymentMethod === 'credit' && (
                           <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                             <div style={{ display: 'flex', gap: '12px' }}>
                               <button 
                                 type="button" 
                                 className="btn-no-override"
                                 onClick={() => setPartyType('customer')}
                                 style={{ 
                                   flex: 1, 
                                   padding: '16px', 
                                   borderRadius: '20px', 
                                   fontSize: '15px', 
                                   fontWeight: 900, 
                                   backgroundColor: partyType === 'customer' ? '#0ea5e9' : 'white', 
                                   color: partyType === 'customer' ? 'white' : '#475569', 
                                   border: '2px solid ' + (partyType === 'customer' ? '#0ea5e9' : '#cbd5e1'), 
                                   cursor: 'pointer', 
                                   transition: 'all 0.2s',
                                   boxShadow: partyType === 'customer' ? '0 8px 16px rgba(14, 165, 233, 0.15)' : 'none'
                                 }}
                               >
                                 Customer
                               </button>
                               <button 
                                 type="button" 
                                 className="btn-no-override"
                                 onClick={() => setPartyType('vendor')}
                                 style={{ 
                                   flex: 1, 
                                   padding: '16px', 
                                   borderRadius: '20px', 
                                   fontSize: '15px', 
                                   fontWeight: 900, 
                                   backgroundColor: partyType === 'vendor' ? '#0ea5e9' : 'white', 
                                   color: partyType === 'vendor' ? 'white' : '#475569', 
                                   border: '2px solid ' + (partyType === 'vendor' ? '#0ea5e9' : '#cbd5e1'), 
                                   cursor: 'pointer', 
                                   transition: 'all 0.2s',
                                   boxShadow: partyType === 'vendor' ? '0 8px 16px rgba(14, 165, 233, 0.15)' : 'none'
                                 }}
                               >
                                 Vendor
                               </button>
                             </div>
 
                             {partyType === 'customer' ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                 <input 
                                   placeholder="Customer Name"
                                   value={customerName}
                                   onChange={e => setCustomerName(e.target.value)}
                                   style={{ 
                                     padding: '16px 20px', 
                                     borderRadius: '20px', 
                                     border: '2px solid #cbd5e1', 
                                     backgroundColor: 'white', 
                                     color: '#0f172a', 
                                     fontWeight: 800, 
                                     fontSize: '15px', 
                                     outline: 'none', 
                                     width: '100%', 
                                     boxSizing: 'border-box',
                                     transition: 'border-color 0.2s'
                                   }}
                                 />
                                 <input 
                                   placeholder="Mobile Number"
                                   value={customerPhone}
                                   onChange={e => setCustomerPhone(e.target.value)}
                                   style={{ 
                                     padding: '16px 20px', 
                                     borderRadius: '20px', 
                                     border: '2px solid #cbd5e1', 
                                     backgroundColor: 'white', 
                                     color: '#0f172a', 
                                     fontWeight: 800, 
                                     fontSize: '15px', 
                                     outline: 'none', 
                                     width: '100%', 
                                     boxSizing: 'border-box',
                                     transition: 'border-color 0.2s'
                                   }}
                                 />
                               </div>
                             ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  {vendors.length === 0 ? (
                                    <div style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>No vendors registered.</div>
                                  ) : (
                                    <select 
                                      value={selectedVendorId || ''} 
                                      onChange={(e) => setSelectedVendorId(e.target.value)}
                                      style={{
                                        padding: '16px 20px', 
                                        borderRadius: '20px', 
                                        border: '2px solid #cbd5e1', 
                                        backgroundColor: 'white', 
                                        color: '#0f172a', 
                                        fontWeight: 800, 
                                        fontSize: '15px', 
                                        outline: 'none', 
                                        width: '100%', 
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <option value="" disabled>Select Vendor</option>
                                      {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name} {v.phone ? `(${v.phone})` : ''}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              )}
 
                             <button 
                               type="button"
                               className="btn-no-override"
                               onClick={() => confirmPayment('credit')}
                               style={{ 
                                 width: '100%', 
                                 padding: '18px', 
                                 borderRadius: '20px', 
                                 backgroundColor: '#10b981', 
                                 color: 'white', 
                                 border: 'none', 
                                 cursor: 'pointer', 
                                 fontWeight: '900', 
                                 fontSize: '15px', 
                                 boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)', 
                                 textTransform: 'uppercase', 
                                 marginTop: '8px',
                                 transition: 'transform 0.1s'
                               }}
                             >
                               Settle Without Print
                             </button>
                           </div>
                         )}
                       </div>
                     )}
                  </div>
 
                  {user?.whatsAppBillingEnabled && selectedPaymentMethod !== 'credit' && (
                     <div style={{backgroundColor: 'white', padding: '20px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #cbd5e1' }}>
                        <Phone size={18} color="#64748b" />
                        <input 
                           placeholder="Enter Mobile No" 
                           value={customerPhone} 
                           onChange={(e) => setCustomerPhone(e.target.value)}
                           style={{ border: 'none', width: '100%', outline: 'none', fontWeight: 800, fontSize: '15px', background: 'white', color: '#0f172a' }}
                        />
                     </div>
                   )}

                  <div style={{ display: 'flex', gap: '12px' }}>
                     <button onClick={printBill} style={{flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800', fontSize: '14px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)', transition: 'background-color 0.2s' }}>
                        <Printer size={18} /> {!billData.is_paid ? 'Print' : 'Re-Print'}
                     </button>
                     {user?.whatsAppBillingEnabled && selectedPaymentMethod !== 'credit' && (
                       <button onClick={shareViaWhatsApp} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#22c55e', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800', fontSize: '14px', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)' }}>
                          <MessageCircle size={18} /> WhatsApp
                       </button>
                     )}
                 </div>
             </div>
          </div>
        </div>
      )}
      <SwapModal isOpen={isSwapModalOpen} onClose={() => setSwapModalOpen(false)} tables={allTables} onSwap={handleSwapTable} currentTable={table} />
    </div>
  );
};

export default OrderModal;
