import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { shareBillPDFViaWhatsApp } from '../utils/pdfBill';
import { X, Plus, Minus, Receipt, Send, MessageSquare, MessageCircle, Utensils, Trash2, ChevronRight, IndianRupee, Clock, CheckCircle, Phone, ArrowLeft, RefreshCcw, Wallet, Printer, Search, ShoppingBag, ChevronUp, ChevronDown, ChevronsDown, Ticket, Ban, Edit2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import SwapModal from './SwapModal';
import { onUpdate } from '../services/socketService';

const OrderModal = ({ table, onClose, initialMenu, allTables: passedTables }) => {
  if (!table) return null;
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [categories, setCategories] = useState(initialMenu?.categories || []);
  const [allItems, setAllItems] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const handleConfirmCancelOrder = async () => {
    try {
      await api.post(`/tables/${table.id}/clear-order`, {
        reason: cancellationReason || 'Order Cancelled',
        items: orderItems
      });
      setOrderItems([]);
      toast.success('Order cancelled and table cleared!');
      setShowCancelConfirmModal(false);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    }
  };
  const [totalPages, setTotalPages] = useState(1);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [selectedDeliveryPartner, setSelectedDeliveryPartner] = useState('');
  const [discount, setDiscount] = useState('');
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
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [customDeliveryPartners, setCustomDeliveryPartners] = useState(() => {
    try {
      const saved = localStorage.getItem('cfg_custom_delivery_partners');
      return saved ? JSON.parse(saved) : ['Zomato', 'Swiggy'];
    } catch (e) {
      return ['Zomato', 'Swiggy'];
    }
  });
  const [showAddPartnerInput, setShowAddPartnerInput] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState(null);
  const [partnerToRename, setPartnerToRename] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const handleAddDeliveryPartner = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const name = newPartnerName.trim();
    if (!name) return;
    const updated = Array.from(new Set([...customDeliveryPartners, name]));
    setCustomDeliveryPartners(updated);
    localStorage.setItem('cfg_custom_delivery_partners', JSON.stringify(updated));
    setSelectedDeliveryPartner(name);
    setNewPartnerName('');
    setShowAddPartnerInput(false);
    toast.success(`Added ${name}`);
  };

  const handleRenamePartner = (oldName) => {
    setPartnerToRename(oldName);
    setRenameValue(oldName);
  };

  const handleDeletePartner = (partnerName) => {
    setPartnerToDelete(partnerName);
  };

  const isOnlineCounter = String(table?.table_number || table?.id || '').toLowerCase().includes('online');
  const isTokenCounter = String(table?.table_number || table?.id || '').toLowerCase().includes('token');
  const isParcelCounter = table?.table_number === 'Parcel Counter';
  const cancelOrdersEnabled = user?.cancelOrdersEnabled === true;
  const isWaiterAccessEnabled = user?.role === 'waiter' || user?.waiterModuleEnabled || localStorage.getItem('cfg_waiter_module') === 'true';
  const showKotButton = (user?.simpleKotEnabled || user?.kotEnabled || isWaiterAccessEnabled) && !isTokenCounter;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      if (!table || !table.id) return;
      try {
        const needsOrderFetch = !!table?.active_order_id;
        const needsStaticFetch = !initialMenu || !passedTables;

        const [catRes, orderRes, tablesRes] = await Promise.all([
          needsStaticFetch ? api.get('/menu/categories') : Promise.resolve({ data: initialMenu?.categories }),
          needsOrderFetch ? api.get(`/tables/${table.id}/order`) : Promise.resolve({ data: { items: [] } }),
          needsStaticFetch ? api.get('/tables') : Promise.resolve({ data: passedTables })
        ]);

        if (needsStaticFetch) {
            setCategories(catRes.data || []);
            setAllTables(tablesRes.data || []);
        }
        setOrderItems(orderRes.data?.items || []);
        
        await fetchAllMenu();
        
        setLoading(false);
      } catch (err) {
        console.error('Modal Init Error:', err);
        toast.error('Initialization failed');
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.id]);

  useEffect(() => {
    if (!table?.id) return;
    const unsubscribe = onUpdate(async () => {
      try {
        const orderRes = await api.get(`/tables/${table.id}/order`);
        setOrderItems(orderRes.data?.items || []);
      } catch (err) {}
    });
    return () => unsubscribe();
  }, [table?.id]);

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

    filtered.sort((a, b) => {
      const aInOrder = orderItems.some(i => i.menu_item_id === a.id);
      const bInOrder = orderItems.some(i => i.menu_item_id === b.id);
      if (aInOrder && !bInOrder) return -1;
      if (!aInOrder && bInOrder) return 1;
      return 0;
    });

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
    const item = orderItems.find(i => i.id === itemId || i.menu_item_id === itemId || i.tempId === itemId);
    if (!item) return;
    
    const newQty = item.quantity + change;
    if (newQty < 1) return removeFromOrder(itemId);

    // Optimistic Update
    const originalItems = [...orderItems];
    setOrderItems(prev => prev.map(i => (i.id === itemId || i.menu_item_id === itemId || i.tempId === itemId) ? { ...i, quantity: newQty } : i));

    try {
      const targetId = item.id || item.menu_item_id;
      await api.put(`/tables/${table.id}/order/items/${targetId}`, { quantity: newQty });
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
        style: { borderRadius: '16px', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 900 }
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
        waiter: user?.role === 'waiter' ? user.name : null,
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
  const printToken = async () => {
    if (!billData) return;
    try {
      await api.post(`/bills/${billData.id}/print`, { paymentMethod: selectedPaymentMethod, isToken: true });
      toast.success('Token ticket sent to printer!');
    } catch (err) {
      console.error('Token print failed:', err);
      toast.error(err.response?.data?.message || 'Token print failed');
    }
  };

  const printBill = async () => {
    if (!billData) return;
    try {
      await api.post(`/bills/${billData.id}/print`, { paymentMethod: selectedPaymentMethod });
      toast.success('Bill finalized!');
      if (!billData.is_paid) {
        await confirmPayment(selectedPaymentMethod);
      }
    } catch (err) {
      console.error('Print failed:', err);
      try {
        if (!billData.is_paid) {
          await confirmPayment(selectedPaymentMethod);
        } else {
          toast.success('Bill finalized!');
        }
      } catch (confirmErr) {
        toast.error(confirmErr.response?.data?.message || 'Settlement failed');
      }
    }
  };

  const settleWithoutPrint = async () => {
    if (!billData) return;
    try {
      if (!billData.is_paid) {
        await confirmPayment(selectedPaymentMethod);
      } else {
        toast.success('Transaction settled!');
      }
    } catch (err) {
      console.error('Settlement failed:', err);
      toast.error(err.response?.data?.message || 'Settlement failed');
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

  const shareViaWhatsApp = async () => {
    if (!customerPhone) {
      toast.error('Please enter a phone number first');
      return;
    }
    const toastId = toast.loading('Generating WhatsApp PDF bill...');
    try {
      await shareBillPDFViaWhatsApp(
        { ...billData, table: table.table_numberByFloor || table.table_number, delivery_partner: selectedDeliveryPartner },
        user,
        customerPhone
      );
      toast.success('WhatsApp PDF bill generated!', { id: toastId });
      if (!billData.is_paid) {
        await confirmPayment(selectedPaymentMethod);
      } else {
        onClose();
      }
    } catch (e) {
      toast.error('Failed to share PDF bill: ' + e.message, { id: toastId });
    }
  };

  const upiId = user?.upi_id || '';
  const hname = user?.hotel_name || '';
  const amountVal = billData?.final_amount || 0;
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(hname)}&am=${amountVal}&cu=INR`;

  if (loading) return null;

  return (
    <div className="order-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div className="order-modal-container" style={{ width: '100%', maxWidth: '1280px', height: '92vh', backgroundColor: 'var(--bg-base)', borderRadius: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,0.9)', border: '1px solid var(--border-color)' }}>
        
        {/* Header - Matching Screenshot Style */}
        <div className="order-modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              minWidth: '48px', 
              padding: '0 8px',
              height: '48px', 
              backgroundColor: '#10b981', 
              borderRadius: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#ffffff', 
              fontWeight: 950, 
              fontSize: String(table.table_number || '').length > 6 ? '14px' : '22px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
            }}>
              {String(table.table_number || table.id || '').toLowerCase().includes('parcel') 
                ? 'PC' 
                : String(table.table_number || table.id || '').toLowerCase().includes('token') 
                  ? 'TC' 
                  : String(table.table_number || table.id || '').toLowerCase().includes('online')
                    ? 'ONLINE'
                    : (table.table_number || table.id)
              }
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {String(table.table_number || '').toLowerCase().includes('parcel') 
                  ? 'Parcel Counter Summary' 
                  : String(table.table_number || '').toLowerCase().includes('token') 
                    ? 'Token Counter Summary' 
                    : String(table.table_number || '').toLowerCase().includes('online')
                      ? (selectedDeliveryPartner ? `${selectedDeliveryPartner.toUpperCase()} Order` : 'Online Order Summary')
                      : table.floor ? `Table ${table.table_number || table.id} (${table.floor})` : `Table ${table.table_number || table.id}`
                }
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                 <span style={{ fontSize: '10px', fontWeight: 900, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase' }}>BESTBILL POS</span>
                 {table.active_order_id && !showBill && (
                    <button onClick={() => setSwapModalOpen(true)} style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', border: '1px solid #0ea5e9', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}>SWAP TABLE</button>
                 )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--border-rgba-05)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Section */}
        <div className="order-modal-content" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Left Panel: Search & Menu Items */}
          <div className="order-modal-menu" style={{ flex: 1, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, backgroundColor: 'var(--bg-base)' }}>
            
            {/* Top Bar: Search Input & Category Scroll Bar */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
              
              {/* Search Menu Input */}
              <div className="search-bar-container" style={{ position: 'relative', width: '100%' }}>
                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Search size={16} />
                </div>
                <input 
                   type="text" 
                   placeholder="Search Menu..."
                   value={searchQuery}
                   onChange={handleSearchChange}
                   style={{
                     width: '100%', 
                     padding: '12px 40px 12px 44px', 
                     borderRadius: '16px', 
                     backgroundColor: 'var(--input-bg)', 
                     border: '1px solid var(--border-color)', 
                     color: 'var(--text-primary)', 
                     fontWeight: 700, 
                     outline: 'none', 
                     fontSize: '14px',
                     boxSizing: 'border-box'
                   }}
                />
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(''); setSuggestions([]); }}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={16} />
                  </button>
                )}

                {/* Suggestions Dropdown */}
                {suggestions.length > 0 && (
                  <div className="search-suggestions-scrollbar" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-card)', borderRadius: '16px', marginTop: '6px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', zIndex: 100, border: '1px solid var(--border-color)', overflowY: 'auto', maxHeight: '280px' }}>
                    {suggestions.map(s => (
                      <div key={s.id} onClick={() => { addToOrder(s); setSearchQuery(''); setSuggestions([]); }} style={{ padding: '12px 18px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Plus size={14} color="#0ea5e9" />
                          <span>{s.name}</span>
                        </div>
                        <span style={{ color: '#10b981' }}>₹{s.price}</span>
                      </div>
                    ))}
                    {suggestions.length > 4 && (
                      <div style={{
                        position: 'sticky',
                        bottom: 0,
                        backgroundColor: 'var(--bg-card)',
                        borderTop: '1px solid var(--border-color)',
                        padding: '8px 12px',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 900,
                        color: '#0ea5e9',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        boxShadow: '0 -4px 10px rgba(0,0,0,0.3)',
                        zIndex: 10
                      }}>
                        <span>SCROLL FOR MORE RESULTS</span>
                        <ChevronDown size={14} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Horizontal Category Bar */}
              <div className="category-bar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
                <button 
                  onClick={() => { setSelectedCategory('all'); setCurrentPage(1); }} 
                  style={{
                    padding: '8px 16px', 
                    borderRadius: '20px', 
                    border: 'none', 
                    fontWeight: 800, 
                    cursor: 'pointer', 
                    backgroundColor: selectedCategory === 'all' ? '#0ea5e9' : 'var(--border-rgba-05)', 
                    color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-secondary)', 
                    fontSize: '11px', 
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.03em',
                    transition: 'all 0.15s'
                  }}
                >
                  ALL ITEMS
                </button>
                {categories.map(cat => (
                  <button 
                    key={cat.id} 
                    onClick={() => { setSelectedCategory(cat.id); setCurrentPage(1); }} 
                    style={{
                      padding: '8px 16px', 
                      borderRadius: '20px', 
                      border: 'none', 
                      fontWeight: 800, 
                      cursor: 'pointer', 
                      backgroundColor: selectedCategory === cat.id ? '#0ea5e9' : 'var(--border-rgba-05)', 
                      color: selectedCategory === cat.id ? '#ffffff' : 'var(--text-secondary)', 
                      fontSize: '11px', 
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.03em',
                      transition: 'all 0.15s'
                    }}
                  >
                    {cat.name.toUpperCase()}
                  </button>
                ))}
              </div>

            </div>
            
            {/* Menu Items List - Neat & Compact Cards */}
            <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: isMobile && orderItems.length > 0 ? '80px' : '16px' }}>
              {items.map(item => {
                const cartItem = orderItems.find(i => (i.menu_item_id || i.id) === item.id);
                const currentQty = cartItem ? cartItem.quantity : 0;

                return (
                  <div 
                    key={item.id} 
                    onClick={() => { if (currentQty === 0) addToOrder(item); }} 
                    style={{ 
                      backgroundColor: currentQty > 0 ? 'rgba(14, 165, 233, 0.1)' : 'var(--bg-card)', 
                      border: currentQty > 0 ? '1px solid #0ea5e9' : '1px solid var(--border-color)', 
                      padding: '14px 18px', 
                      borderRadius: '16px', 
                      cursor: 'pointer', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{item.name}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 800, backgroundColor: 'var(--bg-base)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                          {item.category_name || 'Item'}
                        </span>
                      </div>
                      {item.description && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                          {item.description}
                        </p>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      <span style={{ color: '#10b981', fontSize: '17px', fontWeight: 900 }}>₹{item.price}</span>
                      
                      {currentQty === 0 ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); addToOrder(item); }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '10px',
                            border: '1px solid #0ea5e9',
                            backgroundColor: 'rgba(14, 165, 233, 0.15)',
                            color: '#38bdf8',
                            fontWeight: 900,
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={14} /> ADD
                        </button>
                      ) : (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: '#0ea5e9',
                            borderRadius: '10px',
                            padding: '4px 10px',
                            boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)'
                          }}
                        >
                          <button 
                            onClick={() => updateQuantity(cartItem.id, -1)}
                            style={{ border: 'none', background: 'none', color: '#ffffff', cursor: 'pointer', padding: '2px', display: 'flex' }}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={{ color: '#ffffff', fontWeight: 950, fontSize: '14px', minWidth: '16px', textAlign: 'center' }}>
                            {currentQty}
                          </span>
                          <button 
                            onClick={() => addToOrder(item)}
                            style={{ border: 'none', background: 'none', color: '#ffffff', cursor: 'pointer', padding: '2px', display: 'flex' }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
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
                const btn = { height: '34px', minWidth: '34px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '12px', transition: 'all 0.15s' };
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}
                      style={{ ...btn, padding: '0 10px', backgroundColor: currentPage === 1 ? 'var(--border-rgba-05)' : 'var(--border-rgba-1)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: currentPage === 1 ? 'default' : 'pointer' }}
                    >&#8249; Prev</button>
                    {getPages().map((p, i) => p === '...' ? (
                      <span key={`e${i}`} style={{ color: 'var(--text-muted)', fontWeight: 800, padding: '0 4px' }}>...</span>
                    ) : (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ ...btn, backgroundColor: currentPage === p ? '#0ea5e9' : 'var(--border-rgba-1)', color: currentPage === p ? 'white' : 'var(--text-secondary)' }}
                      >{p}</button>
                    ))}
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}
                      style={{ ...btn, padding: '0 10px', backgroundColor: currentPage === totalPages ? 'var(--border-rgba-05)' : 'var(--border-rgba-1)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: currentPage === totalPages ? 'default' : 'pointer' }}
                    >Next &#8250;</button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Floating Bottom Cart Bar for Mobile */}
          {isMobile && orderItems.length > 0 && !isMobileCartOpen && (
            <div 
              onClick={() => setIsMobileCartOpen(true)}
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                right: '16px',
                backgroundColor: '#0ea5e9',
                borderRadius: '20px',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 10px 30px rgba(14, 165, 233, 0.5)',
                cursor: 'pointer',
                zIndex: 50
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <ShoppingBag size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {orderItems.reduce((acc, i) => acc + i.quantity, 0)} {orderItems.reduce((acc, i) => acc + i.quantity, 0) === 1 ? 'Item' : 'Items'} Added
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 1000, color: '#ffffff' }}>
                    ₹{((orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (1 + (user?.gst_percentage || 0)/100)) * (1 - discount/100)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255, 255, 255, 0.25)', padding: '8px 14px', borderRadius: '12px', color: '#ffffff', fontWeight: 900, fontSize: '12px' }}>
                <span>VIEW CART</span>
                <ChevronUp size={16} />
              </div>
            </div>
          )}

          {/* Mobile Cart Bottom Sheet Drawer */}
          {isMobile && isMobileCartOpen && (
            <div 
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end'
              }}
              onClick={() => setIsMobileCartOpen(false)}
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  height: '90vh',
                  backgroundColor: '#070c18',
                  borderTopLeftRadius: '24px',
                  borderTopRightRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: '0 -20px 50px rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                {/* Drawer Header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={16} color="#0ea5e9" />
                    <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#ffffff', margin: 0 }}>Active Selection ({orderItems.length})</h3>
                  </div>
                  <button 
                    onClick={() => setIsMobileCartOpen(false)}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Drawer Cart List - Compact to fit 6+ items easily */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {orderItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '13px', wordBreak: 'break-word' }}>{item.name}</div>
                        <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 800, marginTop: '1px' }}>
                           ₹{Math.round(item.price * item.quantity)} {item.quantity > 1 && <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '9px' }}>(₹{Math.round(item.price)} each)</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                          onClick={() => updateQuantity(item.id, -1)} 
                          style={{ border: 'none', width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={11} />
                        </button>
                        <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '13px', minWidth: '14px', textAlign: 'center' }}>{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)} 
                          style={{ border: 'none', width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Drawer Cart Footer - Compact Bottom Section */}
                <div style={{ padding: '10px 16px', backgroundColor: '#0f172a', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>LOYALTY DISCOUNT (%)</span>
                    <input 
                       type="number" 
                       value={discount} 
                       onChange={e => setDiscount(Math.max(0, Math.min(100, e.target.value)))} 
                       style={{ width: '40px', background: 'none', border: 'none', borderBottom: '2px solid #0ea5e9', color: '#ffffff', textAlign: 'center', fontWeight: 900, outline: 'none', fontSize: '12px' }} 
                    />
                  </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '15px', fontWeight: 900, color: '#ffffff' }}>Final Due</span>
                    <span style={{ color: '#10b981', fontSize: '18px', fontWeight: 1000 }}>₹{((orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (1 + (user?.gst_percentage || 0)/100)) * (1 - discount/100)).toFixed(2)}</span>
                  </div>

                  {showKotButton ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button disabled={orderItems.length === 0} onClick={sendToKitchen} style={{ flex: 1, padding: '11px 6px', borderRadius: '12px', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}>PRINT KOT</button>
                      <button disabled={orderItems.length === 0} onClick={generateBill} style={{ flex: 1, padding: '11px 6px', borderRadius: '12px', backgroundColor: '#0ea5e9', color: '#ffffff', border: 'none', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}>SETTLE BILL</button>
                    </div>
                  ) : (
                    <button disabled={orderItems.length === 0} onClick={generateBill} style={{ width: '100%', padding: '11px', borderRadius: '12px', backgroundColor: '#0ea5e9', color: '#ffffff', border: 'none', fontWeight: 900, fontSize: '13px', cursor: 'pointer' }}>SETTLE TRANSACTION</button>
                  )}

                  {(cancelOrdersEnabled && (table.active_order_id || orderItems.length > 0)) && (
                    <button 
                      type="button" 
                      onClick={() => setShowCancelConfirmModal(true)} 
                      style={{ width: '100%', padding: '11px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 900, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}
                    >
                      <Ban size={14} /> CANCEL ORDER / CLEAR TABLE
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Right Panel: Desktop Active Selection Cart */}
          {!isMobile && (
            <div className="order-modal-cart" style={{ width: '400px', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
              
              {/* Active Selection Header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: 'rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                    <Receipt size={16} />
                 </div>
                 <h3 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Active Selection</h3>
              </div>
 
              {/* Cart Items List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {orderItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                    No items selected yet. Tap items on the left to add.
                  </div>
                ) : (
                  orderItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '14px', wordBreak: 'break-word' }}>{item.name}</div>
                        <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 900, marginTop: '2px' }}>
                          ₹{item.price}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-base)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border-color)' }}>
                          <button onClick={() => updateQuantity(item.id, -1, item.menu_item_id)} style={{ width: '28px', height: '28px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                          <span style={{ width: '28px', textAlign: 'center', fontWeight: 900, color: 'var(--text-primary)', fontSize: '14px' }}>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1, item.menu_item_id)} style={{ width: '28px', height: '28px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Active Selection Actions Footer */}
              <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700 }}>Subtotal</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '15px' }}>₹{orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                </div>
                
                {Boolean(user?.gst_percentage) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700 }}>GST ({user.gst_percentage}%)</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '15px' }}>₹{(orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (user.gst_percentage / 100)).toFixed(2)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 800 }}>DISCOUNT (%)</span>
                  <input 
                    type="number" 
                    value={discount} 
                    onChange={e => setDiscount(e.target.value === '' ? '' : Math.max(0, Math.min(100, e.target.value)))} 
                    style={{ width: '50px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 900, outline: 'none', fontSize: '13px', borderRadius: '6px', padding: '2px 4px' }} 
                  />
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>Grand Total</span>
                  <span style={{ color: '#10b981', fontSize: '22px', fontWeight: 1000 }}>₹{((orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) * (1 + (user?.gst_percentage || 0)/100)) * (1 - discount/100)).toFixed(2)}</span>
                </div>

                {showKotButton ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      disabled={orderItems.length === 0} 
                      onClick={sendToKitchen} 
                      style={{ 
                        flex: 1, 
                        padding: '14px', 
                        borderRadius: '14px', 
                        backgroundColor: '#f59e0b', 
                        color: '#ffffff', 
                        border: 'none', 
                        fontWeight: 900, 
                        fontSize: '13px', 
                        cursor: 'pointer', 
                        opacity: orderItems.length === 0 ? 0.3 : 1, 
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' 
                      }}
                    >
                      PRINT KOT
                    </button>
                    <button 
                      disabled={orderItems.length === 0} 
                      onClick={generateBill} 
                      style={{ 
                        flex: 1, 
                        padding: '14px', 
                        borderRadius: '14px', 
                        backgroundColor: '#0ea5e9', 
                        color: '#ffffff', 
                        border: 'none', 
                        fontWeight: 900, 
                        fontSize: '13px', 
                        cursor: 'pointer', 
                        opacity: orderItems.length === 0 ? 0.3 : 1, 
                        boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)' 
                      }}
                    >
                      SETTLE BILL
                    </button>
                  </div>
                ) : (
                  <button 
                    disabled={orderItems.length === 0} 
                    onClick={generateBill} 
                    style={{ 
                      width: '100%', 
                      padding: '14px', 
                      borderRadius: '14px', 
                      backgroundColor: '#0ea5e9', 
                      color: '#ffffff', 
                      border: 'none', 
                      fontWeight: 900, 
                      fontSize: '14px', 
                      cursor: 'pointer', 
                      opacity: orderItems.length === 0 ? 0.3 : 1, 
                      transition: '0.2s', 
                      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)' 
                    }}
                  >
                    {table.table_number === 'Parcel Counter' ? 'SETTLE BILL' : 'SETTLE TRANSACTION'}
                  </button>
                )}

                {(cancelOrdersEnabled && (table.active_order_id || orderItems.length > 0)) && (
                  <button 
                    type="button" 
                    onClick={() => setShowCancelConfirmModal(true)} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      borderRadius: '14px', 
                      backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                      color: '#f43f5e', 
                      border: '1px solid rgba(239, 68, 68, 0.3)', 
                      fontWeight: 900, 
                      fontSize: '13px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '6px', 
                      marginTop: '4px' 
                    }}
                  >
                    <Ban size={15} /> CANCEL ORDER / CLEAR TABLE
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bill & Settlement Modal */}
      {showBill && billData && (
        <div className="bill-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(10px)' }}>
          <div className="bill-container" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '32px', overflow: 'hidden', display: 'flex', flexDirection: isMobile ? 'column' : 'row', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.8)', border: '1px solid var(--border-color)', position: 'relative' }}>
             <div className="bill-preview-scroll" style={{ flex: 1, padding: '32px', borderRight: '1px solid var(--border-color)', backgroundColor: billData.is_paid ? '#10b981' : 'var(--bg-card)', transition: 'all 0.6s', overflowY: 'auto', position: 'relative' }}>

                {isSuccess && (
                   <div style={{ position: 'absolute', inset: 0, backgroundColor: '#10b981', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                      <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginBottom: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                         <CheckCircle size={64} strokeWidth={3} />
                      </div>
                      <h2 style={{ fontSize: '28px', fontWeight: 1000, color: '#ffffff', margin: 0 }}>Transaction Complete</h2>
                      <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', marginTop: '8px', fontWeight: 800 }}>Redirecting...</p>
                   </div>
                )}
                {!!billData.is_paid && !isSuccess && (
                   <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '50%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                         <CheckCircle size={80} color="#10b981" />
                      </div>
                   </div>
                )}
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '20px', opacity: billData.is_paid ? 0.3 : 1 }}>
                    <div style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', border: '1px solid #0ea5e9', color: billData.is_paid ? '#ffffff' : 'var(--text-primary)', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', zIndex: 5 }}>
                      <Receipt size={14} color="#0ea5e9" />
                      <span>FINALIZED BILL</span>
                    </div>
                    <h1 style={{ margin: 0, fontWeight: 950, fontSize: '24px', color: billData.is_paid ? '#ffffff' : 'var(--text-primary)', textAlign: 'center' }}>{(billData.hotel_name || user?.hotel_name || '').toUpperCase()}</h1>
                    <div style={{ color: billData.is_paid ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', fontWeight: 800, fontSize: '13px', textAlign: 'center' }}>{billData.hotel_location}</div>
                 </div>
                
                <div style={{ borderTop: '2px dashed var(--border-color)', borderBottom: '2px dashed var(--border-color)', padding: '14px 0', marginBottom: '20px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900, color: billData.is_paid ? '#ffffff' : 'var(--text-primary)' }}>
                      <span>TABLE NO: {table.table_numberByFloor || table.table_number}</span>
                      <span>BILL NO: #{billData.id}</span>
                   </div>
                   <div style={{ fontSize: '12px', color: billData.is_paid ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)' }}>DATE: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
                </div>
 
                <div style={{ marginBottom: '20px' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 60px 30px 70px' : '1fr 80px 60px 100px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px', marginBottom: '10px', fontSize: '11px', fontWeight: 900, color: billData.is_paid ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                      <span>Item</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Total</span>
                   </div>
                   {billData.items.map((i, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 60px 30px 70px' : '1fr 80px 60px 100px', fontSize: isMobile ? '12px' : '14px', fontWeight: 800, marginBottom: '6px', color: billData.is_paid ? '#ffffff' : 'var(--text-primary)' }}>
                        <span style={{ paddingRight: '8px' }}>{i.name}</span><span style={{ textAlign: 'right' }}>₹{Math.round(i.price)}</span><span style={{ textAlign: 'right' }}>{i.quantity}</span><span style={{ textAlign: 'right' }}>₹{(i.price * i.quantity).toFixed(2)}</span>
                      </div>
                   ))}
                </div>
 
                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px', color: billData.is_paid ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800 }}><span>SUBTOTAL</span><span>₹{parseFloat(billData.subtotal).toFixed(2)}</span></div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800 }}><span>GST</span><span>₹{parseFloat(billData.gst).toFixed(2)}</span></div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '32px', fontWeight: 1000, color: '#10b981', borderTop: '2px double var(--border-color)', marginTop: '10px', paddingTop: '10px' }}><span>TOTAL</span><span>₹{parseFloat(billData.final_amount).toFixed(2)}</span></div>
                </div>

                 {!billData.is_paid && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', margin: '20px 0 10px 0' }}>
                      <ChevronsDown size={28} style={{ animation: 'bounce 1.5s infinite', opacity: 0.8 }} />
                    </div>
                 )}

                 <div style={{ marginTop: '16px' }}>
                  {!billData.is_paid ? (
                    <button onClick={rollbackBill} className="btn-modify-invoice" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #475569', backgroundColor: '#334155', color: '#ffffff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', transition: 'background-color 0.2s' }}>MODIFY INVOICE</button>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', color: '#10b981', fontWeight: 950, fontSize: '18px' }}>SUCCESSFULLY SETTLED</div>
                  )}
                </div>
              </div>

              {/* Settlement Right Side */}
              <div style={{ width: isMobile ? '100%' : '340px', padding: isMobile ? '20px' : '28px', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', borderTop: isMobile ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {!billData.is_paid && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          
                          {/* Payment Method Section */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              PAYMENT METHOD
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                type="button"
                                onClick={() => setSelectedPaymentMethod('cash')} 
                                style={{ 
                                  flex: 1, 
                                  padding: '12px 6px', 
                                  backgroundColor: selectedPaymentMethod === 'cash' ? '#10b981' : 'var(--bg-card)', 
                                  color: selectedPaymentMethod === 'cash' ? '#ffffff' : 'var(--text-secondary)', 
                                  border: selectedPaymentMethod === 'cash' ? 'none' : '1px solid var(--border-color)', 
                                  borderRadius: '10px', 
                                  fontWeight: 900, 
                                  cursor: 'pointer', 
                                  fontSize: '12px', 
                                  textTransform: 'uppercase', 
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
                                  padding: '12px 6px', 
                                  backgroundColor: selectedPaymentMethod === 'upi' ? '#0ea5e9' : 'var(--bg-card)', 
                                  color: selectedPaymentMethod === 'upi' ? '#ffffff' : 'var(--text-secondary)', 
                                  border: selectedPaymentMethod === 'upi' ? 'none' : '1px solid var(--border-color)', 
                                  borderRadius: '10px', 
                                  fontWeight: 900, 
                                  cursor: 'pointer', 
                                  fontSize: '12px', 
                                  textTransform: 'uppercase', 
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
                                  padding: '12px 6px', 
                                  backgroundColor: selectedPaymentMethod === 'credit' ? '#f59e0b' : 'var(--bg-card)', 
                                  color: selectedPaymentMethod === 'credit' ? '#ffffff' : 'var(--text-secondary)', 
                                  border: selectedPaymentMethod === 'credit' ? 'none' : '1px solid var(--border-color)', 
                                  borderRadius: '10px', 
                                  fontWeight: 900, 
                                  cursor: 'pointer', 
                                  fontSize: '12px', 
                                  textTransform: 'uppercase', 
                                  transition: 'all 0.2s'
                                }}
                              >
                                Credit
                              </button>
                            </div>
                          </div>

                          {/* Food Delivery Partner Section (Only for Online Counter!) */}
                          {isOnlineCounter && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  FOOD DELIVERY SERVICE (OPTIONAL)
                                </label>
                                {selectedDeliveryPartner && (
                                  <button 
                                    type="button" 
                                    onClick={() => setSelectedDeliveryPartner('')} 
                                    style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {customDeliveryPartners.map(partner => {
                                  const isSelected = selectedDeliveryPartner === partner;
                                  return (
                                    <div 
                                      key={partner}
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        padding: '8px 10px', 
                                        backgroundColor: isSelected ? (partner === 'Zomato' ? '#e11d48' : partner === 'Swiggy' ? '#ea580c' : '#8b5cf6') : 'var(--bg-card)', 
                                        color: isSelected ? '#ffffff' : 'var(--text-primary)', 
                                        border: isSelected ? 'none' : '1px solid var(--border-color)', 
                                        borderRadius: '12px', 
                                        fontWeight: 900, 
                                        fontSize: '12px',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <span 
                                        onClick={() => setSelectedDeliveryPartner(isSelected ? '' : partner)}
                                        style={{ cursor: 'pointer', textTransform: 'uppercase' }}
                                      >
                                        {partner}
                                      </span>
                                      <button 
                                        type="button" 
                                        title={`Rename ${partner}`}
                                        onClick={(e) => { e.stopPropagation(); handleRenamePartner(partner); }}
                                        style={{ background: 'none', border: 'none', color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)', cursor: 'pointer', padding: '1px', display: 'flex', alignItems: 'center' }}
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button 
                                        type="button" 
                                        title={`Delete ${partner}`}
                                        onClick={(e) => { e.stopPropagation(); handleDeletePartner(partner); }}
                                        style={{ background: 'none', border: 'none', color: isSelected ? 'rgba(255,255,255,0.9)' : '#ef4444', cursor: 'pointer', padding: '1px', display: 'flex', alignItems: 'center' }}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              {!showAddPartnerInput ? (
                                <button 
                                  type="button" 
                                  onClick={() => setShowAddPartnerInput(true)} 
                                  style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: '12px', fontWeight: 800, cursor: 'pointer', textAlign: 'left', marginTop: '2px', padding: '2px 0' }}
                                >
                                  + Add Food Delivery Service
                                </button>
                              ) : (
                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                  <input 
                                    type="text" 
                                    placeholder="Partner Name (e.g. UberEats)" 
                                    value={newPartnerName}
                                    onChange={e => setNewPartnerName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDeliveryPartner(); } }}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                                  />
                                  <button type="button" onClick={handleAddDeliveryPartner} style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#a855f7', color: 'white', border: 'none', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}>Add</button>
                                  <button type="button" onClick={() => setShowAddPartnerInput(false)} style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'var(--bg-border)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                                </div>
                              )}
                            </div>
                          )}
  
                          {selectedPaymentMethod === 'credit' && (
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                  type="button" 
                                  className="btn-no-override"
                                  onClick={() => setPartyType('customer')}
                                  style={{ 
                                    flex: 1, 
                                    padding: '12px', 
                                    borderRadius: '12px', 
                                    fontSize: '13px', 
                                    fontWeight: 900, 
                                    backgroundColor: partyType === 'customer' ? '#0ea5e9' : 'var(--bg-card)', 
                                    color: partyType === 'customer' ? '#ffffff' : 'var(--text-secondary)', 
                                    border: '1px solid ' + (partyType === 'customer' ? '#0ea5e9' : 'var(--border-color)'), 
                                    cursor: 'pointer'
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
                                    padding: '12px', 
                                    borderRadius: '12px', 
                                    fontSize: '13px', 
                                    fontWeight: 900, 
                                    backgroundColor: partyType === 'vendor' ? '#0ea5e9' : 'var(--bg-card)', 
                                    color: partyType === 'vendor' ? '#ffffff' : 'var(--text-secondary)', 
                                    border: '1px solid ' + (partyType === 'vendor' ? '#0ea5e9' : 'var(--border-color)'), 
                                    cursor: 'pointer'
                                  }}
                                >
                                  Vendor
                                </button>
                              </div>
  
                              {partyType === 'customer' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  <input 
                                    placeholder="Customer Name"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    style={{ 
                                      padding: '12px 14px', 
                                      borderRadius: '12px', 
                                      border: '1px solid var(--border-color)', 
                                      backgroundColor: 'var(--bg-card)', 
                                      color: 'var(--text-primary)', 
                                      fontWeight: 800, 
                                      fontSize: '13px', 
                                      outline: 'none', 
                                      width: '100%', 
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                  <input 
                                    placeholder="Mobile Number"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    style={{ 
                                      padding: '12px 14px', 
                                      borderRadius: '12px', 
                                      border: '1px solid var(--border-color)', 
                                      backgroundColor: 'var(--bg-card)', 
                                      color: 'var(--text-primary)', 
                                      fontWeight: 800, 
                                      fontSize: '13px', 
                                      outline: 'none', 
                                      width: '100%', 
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                              ) : (
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                   {vendors.length === 0 ? (
                                     <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>No vendors registered.</div>
                                   ) : (
                                     <select 
                                       value={selectedVendorId || ''} 
                                       onChange={(e) => setSelectedVendorId(e.target.value)}
                                       style={{
                                         padding: '12px 14px', 
                                         borderRadius: '12px', 
                                         border: '1px solid var(--border-color)', 
                                         backgroundColor: 'var(--bg-card)', 
                                         color: 'var(--text-primary)', 
                                         fontWeight: 800, 
                                         fontSize: '13px', 
                                         outline: 'none', 
                                         width: '100%', 
                                         boxSizing: 'border-box'
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
                                  padding: '14px', 
                                  borderRadius: '14px', 
                                  backgroundColor: '#10b981', 
                                  color: '#ffffff', 
                                  border: 'none', 
                                  cursor: 'pointer', 
                                  fontWeight: '900', 
                                  fontSize: '14px', 
                                  textTransform: 'uppercase', 
                                  marginTop: '4px'
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
                     <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid var(--border-color)' }}>
                        <Phone size={16} color="var(--text-muted)" />
                        <input 
                           placeholder="Enter Mobile No" 
                           value={customerPhone} 
                           onChange={(e) => setCustomerPhone(e.target.value)}
                           style={{ border: 'none', width: '100%', outline: 'none', fontWeight: 800, fontSize: '13px', backgroundColor: 'transparent', color: 'var(--text-primary)', WebkitAppearance: 'none' }}
                        />
                     </div>
                   )}

                  {String(table.table_number || table.id || '').toLowerCase().includes('token') ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                       <button onClick={printToken} style={{ width: '100%', padding: '14px', borderRadius: '14px', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '900', fontSize: '13px', boxShadow: '0 4px 12px rgba(245,158,11,0.25)' }}>
                          <Ticket size={16} /> Print Token
                       </button>
                       <div style={{ display: 'flex', gap: '10px' }}>
                         <button onClick={printBill} style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '900', fontSize: '12px', boxShadow: '0 4px 12px rgba(59,130,246,0.25)' }}>
                            <Printer size={16} /> Settle & Print
                         </button>
                         <button onClick={settleWithoutPrint} style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '900', fontSize: '12px', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}>
                            <CheckCircle size={16} /> Settle Without Print
                         </button>
                       </div>
                       {user?.whatsAppBillingEnabled && selectedPaymentMethod !== 'credit' && (
                         <button onClick={shareViaWhatsApp} style={{ width: '100%', padding: '14px', borderRadius: '14px', backgroundColor: '#059669', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '800', fontSize: '13px' }}>
                            <MessageCircle size={16} /> WhatsApp
                         </button>
                       )}
                     </div>
                  ) : (
                     <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={printBill} style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '800', fontSize: '13px' }}>
                           <Printer size={16} /> {!billData.is_paid ? 'Print' : 'Re-Print'}
                        </button>
                        {user?.whatsAppBillingEnabled && selectedPaymentMethod !== 'credit' && (
                          <button onClick={shareViaWhatsApp} style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: '#22c55e', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '800', fontSize: '13px' }}>
                             <MessageCircle size={16} /> WhatsApp
                          </button>
                        )}
                     </div>
                  )}
              </div>
          </div>
        </div>
      )}
      {/* Cancel Order Confirmation Modal */}
      {showCancelConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '28px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <Ban size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Cancel Order & Clear Table</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0', fontWeight: 600 }}>Table: {table.table_numberByFloor || table.table_number}</p>
              </div>
            </div>

            <p style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
              Are you sure you want to cancel this order and clear the table? A record will be logged in <b>Cancel Orders</b> audit history.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cancellation Reason (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Customer left / Wrong order" 
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                onClick={() => setShowCancelConfirmModal(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}
              >
                Keep Order
              </button>
              <button 
                type="button" 
                onClick={handleConfirmCancelOrder}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: '#f43f5e', border: 'none', color: '#ffffff', fontWeight: 900, cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)' }}
              >
                Yes, Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custom Delete Partner Modal */}
      {partnerToDelete && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>Remove Delivery Partner?</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text-primary)' }}>"{partnerToDelete}"</strong>? This service option will be removed from your counter options.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setPartnerToDelete(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = customDeliveryPartners.filter(p => p !== partnerToDelete);
                  setCustomDeliveryPartners(updated);
                  localStorage.setItem('cfg_custom_delivery_partners', JSON.stringify(updated));
                  if (selectedDeliveryPartner === partnerToDelete) setSelectedDeliveryPartner('');
                  toast.success(`Removed ${partnerToDelete}`);
                  setPartnerToDelete(null);
                }}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 800, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Rename Partner Modal */}
      {partnerToRename && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Edit2 size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', textAlign: 'center' }}>Rename Delivery Service</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', textAlign: 'center' }}>
              Enter a new name for <strong style={{ color: 'var(--text-primary)' }}>"{partnerToRename}"</strong>
            </p>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (renameValue.trim() && renameValue.trim() !== partnerToRename) {
                    const updated = customDeliveryPartners.map(p => p === partnerToRename ? renameValue.trim() : p);
                    setCustomDeliveryPartners(updated);
                    localStorage.setItem('cfg_custom_delivery_partners', JSON.stringify(updated));
                    if (selectedDeliveryPartner === partnerToRename) setSelectedDeliveryPartner(renameValue.trim());
                    toast.success(`Renamed to ${renameValue.trim()}`);
                  }
                  setPartnerToRename(null);
                }
              }}
              placeholder="Delivery Service Name"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setPartnerToRename(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (renameValue.trim() && renameValue.trim() !== partnerToRename) {
                    const updated = customDeliveryPartners.map(p => p === partnerToRename ? renameValue.trim() : p);
                    setCustomDeliveryPartners(updated);
                    localStorage.setItem('cfg_custom_delivery_partners', JSON.stringify(updated));
                    if (selectedDeliveryPartner === partnerToRename) setSelectedDeliveryPartner(renameValue.trim());
                    toast.success(`Renamed to ${renameValue.trim()}`);
                  }
                  setPartnerToRename(null);
                }}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#a855f7', color: '#ffffff', fontWeight: 800, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <SwapModal isOpen={isSwapModalOpen} onClose={() => setSwapModalOpen(false)} tables={allTables} onSwap={handleSwapTable} currentTable={table} />
    </div>
  );
};

export default OrderModal;
