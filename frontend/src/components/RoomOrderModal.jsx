import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { X, Plus, Minus, Receipt, Send, MessageSquare, Utensils, Trash2, ChevronRight, IndianRupee, Clock, CheckCircle, Phone, ArrowLeft, RefreshCcw, Wallet, Printer, Search, User, Calendar, Bed, MessageCircle } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
const RoomOrderModal = ({ room, onClose, onRefresh, initialMenu }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState(initialMenu?.categories || []);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [orderItems, setOrderItems] = useState([]);
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState(null);
  const [customerPhone, setCustomerPhone] = useState(room.guest_phone || '');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isEditingStay, setEditingStay] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editStayCheckIn, setEditStayCheckIn] = useState('');
  const [editStayCheckOut, setEditStayCheckOut] = useState('');
  const [editStayTotalCost, setEditStayTotalCost] = useState('');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [syncingItems, setSyncingItems] = useState(new Set());
  const isOccupied = room.status === 'occupied';
  
  const calculateDaysBetween = (startStr, endStr) => {
    if (!startStr || !endStr) return 1;
    const start = new Date(startStr);
    const end = new Date(endStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const [bookingData, setBookingData] = useState({
    guest_name: room.guest_name || '',
    guest_phone: room.guest_phone || '',
    booking_days: room.booking_days || '1',
    total_cost: room.total_cost || '',
    check_in_date: room.check_in_date ? new Date(room.check_in_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    check_out_date: room.check_in_date ? new Date(new Date(room.check_in_date).getTime() + (room.booking_days || 1) * 86400000).toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0]
  });

  useEffect(() => {
    if (room) {
      const checkIn = room.check_in_date ? new Date(room.check_in_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const checkOut = room.check_in_date ? new Date(new Date(room.check_in_date).getTime() + (room.booking_days || 1) * 86400000).toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0];
      setBookingData({
        guest_name: room.guest_name || '',
        guest_phone: room.guest_phone || '',
        booking_days: room.booking_days || '1',
        total_cost: room.total_cost || '',
        check_in_date: checkIn,
        check_out_date: checkOut
      });
      setCustomerPhone(room.guest_phone || '');
    }
  }, [room]);

  const fetchMenuPage = async (page = 1, category = 'all', search = '') => {
    try {
      const res = await api.get(`/menu/items?page=${page}&limit=10&category_id=${category}&search=${encodeURIComponent(search)}`);
      setItems(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.currentPage || 1);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const needsOrderFetch = isOccupied;
        const needsStaticFetch = !initialMenu || categories.length === 0;

        const [catRes, orderRes] = await Promise.all([
          needsStaticFetch ? api.get('/menu/categories') : Promise.resolve({ data: categories }),
          needsOrderFetch ? api.get(`/rooms/${room.id}/order`) : Promise.resolve({ data: { items: [] } })
        ]);
        setCategories(catRes.data || []);
        setOrderItems(orderRes.data.items || []);
        
        await fetchMenuPage(1, 'all', '');
        
        setLoading(false);
      } catch (err) {
        toast.error('Initialization failed');
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  useEffect(() => {
    if (!loading) {
      fetchMenuPage(currentPage, selectedCategory, searchQuery);
    }
  }, [currentPage, selectedCategory, searchQuery]);

  const addToOrder = async (item) => {
    if (!isOccupied) return toast.error('Please confirm booking first');
    
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
      const res = await api.post(`/rooms/${room.id}/order`, {
        menuItemId: item.id,
        quantity: 1
      });
      // Adopting full backend state for perfect ID sync
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
      await api.put(`/rooms/${room.id}/order/items/${itemId}`, { quantity: newQty });
      // We rely entirely on our optimistic state
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
    // Optimistic Update
    setOrderItems(prev => prev.filter(i => i.id !== itemId));
    
    try {
      const res = await api.delete(`/rooms/${room.id}/order/items/${itemId}`);
      // For rooms, we stay in the modal even if the food order is empty
      if (res.data.order_deleted) {
         setOrderItems([]);
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
      const originalItem = items.find(i => i.id === menuItemId);
      if (originalItem && editPriceValue) {
        await api.put(`/menu/items/${menuItemId}`, {
           ...originalItem,
           price: parseFloat(editPriceValue)
        });
        setItems(items.map(i => i.id === menuItemId ? { ...i, price: parseFloat(editPriceValue) } : i));
        setOrderItems(orderItems.map(i => i.id === orderItemId ? { ...i, price: parseFloat(editPriceValue) } : i));
        toast.success('Price updated in master menu');
      }
      setEditingPriceId(null);
    } catch (err) {
      toast.error('Failed to update price');
      setEditingPriceId(null);
    }
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/rooms/${room.id}/book`, bookingData);
      toast.success('Guest Onboarded Successfully');
      onRefresh(); 
    } catch (err) {
      toast.error('Booking failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateBill = async () => {
    try {
      const res = await api.post(`/rooms/${room.id}/bill`, { discount_percentage: discount });
      setBillData(res.data);
      setShowBill(true);
      toast.success('Bill finalized!', { icon: '🧾' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Billing failed');
    }
  };

  const rollbackBill = async () => {
    if (!billData) return;
    try {
      await api.delete(`/rooms/${room.id}/bill/${billData.id}`);
      setShowBill(false);
      setBillData(null);
      toast.success('Bill cancelled. You can now modify the order.');
    } catch (err) {
      toast.error('Rollback failed');
    }
  };

  const handleStartEditStay = () => {
    const checkIn = room.check_in_date ? new Date(room.check_in_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const checkOut = room.check_in_date ? new Date(new Date(room.check_in_date).getTime() + (room.booking_days || 1) * 86400000).toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setEditStayCheckIn(checkIn);
    setEditStayCheckOut(checkOut);
    setEditStayTotalCost(room.total_cost || '0');
    setEditingStay(true);
  };

  const updateStayDetails = async () => {
    try {
      const finalDays = calculateDaysBetween(editStayCheckIn, editStayCheckOut);
      const finalCost = parseFloat(editStayTotalCost) || 0;
      const finalCheckIn = new Date(editStayCheckIn).toISOString();

      await api.put(`/rooms/${room.id}`, {
        booking_days: finalDays,
        total_cost: finalCost,
        check_in_date: finalCheckIn
      });
      setEditingStay(false);
      onRefresh();
      toast.success('Stay Details Updated');
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const confirmPayment = async (method = 'upi') => {
    try {
      await api.put(`/bills/${billData.id}/pay`, { method });
      await api.post(`/rooms/${room.id}/checkout`);
      
      setIsSuccess(true);
      toast.success('Transaction Complete');
      
      setTimeout(() => {
        onClose();
        onRefresh();
      }, 1800);
    } catch (err) {
      toast.error('Checkout automation failed');
    }
  };

  const sendToKitchen = async () => {
    if (orderItems.length === 0) return toast.error('No items to send');
    const t = toast.loading('Sending KOT to kitchen...');
    try {
      await api.post(`/rooms/${room.id}/order/kot`, {
        waiter: user?.name || 'Waiter',
        notes: kitchenNotes
      });
      toast.success('KOT sent to kitchen successfully!', { id: t });
    } catch (err) {
      toast.error('Failed to print KOT', { id: t });
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

  const shareViaWhatsApp = () => {
    if (!customerPhone) return toast.error('Enter guest phone number');
    let msg = `*--- ${user?.hotel_name?.toUpperCase() || 'BESTBILL'} ---*\n\n`;
    msg += `Room: ${room.room_number}\nGuest: ${room.guest_name}\nBill No: #${billData.id}\n`;
    msg += `\n*Items:*\n• Room Charge: ₹${billData.room_charge}\n`;
    (billData.items || []).forEach(i => msg += `• ${i.name} x ${i.quantity} = ₹${(i.price * i.quantity).toFixed(2)}\n`);
    msg += `\n*GRAND TOTAL: ₹${parseFloat(billData.final_amount).toFixed(2)}*\n\n*Thank you for staying with us!* - ${(user?.hotel_name || 'BestBill').toUpperCase()}`;
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const upiId = user?.upi_id || '';
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(user?.hotel_name || 'BestBill')}&am=${billData?.final_amount || 0}&cu=INR`;

  const totalFoodAmount = orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const subtotalVal = totalFoodAmount + parseFloat(room.total_cost || 0);

  const filteredItems = items;

  if (loading && items.length === 0) return null;

  return (
    <div className="order-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: '1440px', height: '90vh', backgroundColor: isSuccess ? '#064e3b' : 'var(--bg-card)', borderRadius: '40px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)', border: '1px solid var(--border-rgba-05)', position: 'relative', transition: 'all 0.5s ease' }}>
        
        {/* Header */}
        <div style={{ padding: '32px 48px', borderBottom: '1px solid var(--border-rgba-05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
             <div style={{width: '64px', height: '64px', backgroundColor: isOccupied ? '#f43f5e' : '#10b981', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
                <Bed size={32} />
             </div>
             <div>
                <h2 style={{fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Room {room.room_number} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>({room.floor})</span></h2>
                <span style={{ fontSize: '11px', fontWeight: 900, color: isOccupied ? '#f43f5e' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{isOccupied ? 'Occupied - Guest In Residence' : 'Available for Booking'}</span>
             </div>
          </div>
          <button onClick={onClose} style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-border)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Menu */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-rgba-05)', overflow: 'hidden', minWidth: 0 }}>
             <div style={{ padding: '16px 48px', display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: 'var(--bg-base)', borderBottom: '1px solid var(--border-rgba-05)' }}>
                <div className="category-bar-container" style={{ display: 'flex', gap: '10px', overflowX: 'auto', flex: 1, paddingBottom: '4px' }}>
                   <button onClick={() => { setSelectedCategory('all'); setCurrentPage(1); }} style={{padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: selectedCategory === 'all' ? '#0ea5e9' : 'var(--bg-border)', color: 'var(--text-primary)', fontWeight: 900, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>ALL MENU</button>
                   {categories.map(cat => (
                      <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setCurrentPage(1); }} style={{padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: parseInt(selectedCategory) === cat.id ? '#0ea5e9' : 'var(--bg-border)', color: 'var(--text-primary)', fontWeight: 900, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{cat.name.toUpperCase()}</button>
                   ))}
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                    <input type="text" placeholder="Filter items..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} style={{width: '100%', padding: '14px 48px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }} />
                </div>
             </div>
             
             <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', alignContent: 'start' }}>
                {filteredItems.map(item => (
                   <div key={item.id} onClick={() => isOccupied && addToOrder(item)} style={{ 
                     backgroundColor: 'var(--bg-base)', 
                     border: '1px solid var(--bg-border)', 
                     padding: '16px 24px', 
                     borderRadius: '16px', 
                     cursor: isOccupied ? 'pointer' : 'not-allowed', 
                     opacity: isOccupied ? 1 : 0.4, 
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'space-between',
                     transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                     position: 'relative'
                   }}
                   onMouseEnter={(e) => {
                     if (isOccupied) {
                       e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                       e.currentTarget.style.borderColor = '#0ea5e9';
                       e.currentTarget.style.transform = 'translateX(4px)';
                     }
                   }}
                   onMouseLeave={(e) => {
                     if (isOccupied) {
                       e.currentTarget.style.backgroundColor = 'var(--bg-base)';
                       e.currentTarget.style.borderColor = 'var(--bg-border)';
                       e.currentTarget.style.transform = 'translateX(0)';
                     }
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

          {/* Cart / Guest Details */}
          <div style={{ width: '420px', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
             {!isOccupied ? (
                <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                   <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <div style={{ width: '80px', height: '80px', backgroundColor: '#10b98110', border: '1px solid #10b981', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                         <User size={40} style={{ color: '#10b981' }} />
                      </div>
                      <h3 style={{fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>Guest Arrival</h3>
                   </div>
                   <form onSubmit={handleBooking} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <input type="text" placeholder="Guest Name" required value={bookingData.guest_name} onChange={(e) => setBookingData({...bookingData, guest_name: e.target.value})} style={{padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700 }} />
                      <input type="text" placeholder="Phone Number" required value={bookingData.guest_phone} onChange={(e) => setBookingData({...bookingData, guest_phone: e.target.value})} style={{padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700 }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900 }}>CHECK-IN DATE</label>
                         <input 
                           type="date" 
                           required 
                           value={bookingData.check_in_date || ''} 
                           onChange={(e) => {
                             const newCheckIn = e.target.value;
                             const newCheckOut = bookingData.check_out_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
                             const days = calculateDaysBetween(newCheckIn, newCheckOut);
                             setBookingData({
                               ...bookingData,
                               check_in_date: newCheckIn,
                               booking_days: String(days)
                             });
                           }} 
                           style={{padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700 }} 
                         />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900 }}>CHECK-OUT DATE</label>
                         <input 
                           type="date" 
                           required 
                           value={bookingData.check_out_date || ''} 
                           onChange={(e) => {
                             const newCheckOut = e.target.value;
                             const newCheckIn = bookingData.check_in_date || new Date().toISOString().split('T')[0];
                             const days = calculateDaysBetween(newCheckIn, newCheckOut);
                             setBookingData({
                               ...bookingData,
                               check_out_date: newCheckOut,
                               booking_days: String(days)
                             });
                           }} 
                           style={{padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700 }} 
                         />
                       </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900 }}>STAY DAYS</label>
                         <input 
                           type="number" 
                           required 
                           value={bookingData.booking_days} 
                           onFocus={e => e.target.select()} 
                           onChange={(e) => {
                             const days = parseInt(e.target.value) || 1;
                             const checkIn = bookingData.check_in_date || new Date().toISOString().split('T')[0];
                             const checkOutDateObj = new Date(new Date(checkIn).getTime() + days * 86400000);
                             setBookingData({
                               ...bookingData,
                               booking_days: String(days),
                               check_out_date: checkOutDateObj.toISOString().split('T')[0]
                             });
                           }} 
                           style={{padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700 }} 
                         />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900 }}>TOTAL RENT</label>
                         <input type="number" required value={bookingData.total_cost} onFocus={e => e.target.select()} onChange={(e) => setBookingData({...bookingData, total_cost: e.target.value})} style={{padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700 }} />
                       </div>
                    </div>
                      <button type="submit" disabled={isSubmitting} style={{padding: '20px', borderRadius: '20px', backgroundColor: isSubmitting ? 'var(--bg-border)' : '#10b981', color: 'var(--text-primary)', border: 'none', fontWeight: 1000, fontSize: '18px', cursor: isSubmitting ? 'not-allowed' : 'pointer', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        {isSubmitting ? <><RefreshCcw size={20} className="animate-spin" /> PROVISIONING...</> : 'CHECK-IN GUEST'}
                      </button>
                   </form>
                </div>
             ) : (
                   <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <div style={{ padding: '32px', borderBottom: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)' }}>
                         {isEditingStay ? (
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                               <div style={{ padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '14px', border: '1px dashed var(--bg-border)' }}>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>CURRENT STAY: {room.booking_days} NIGHTS / ₹{room.total_cost}</div>
                               </div>
                               <div style={{ display: 'flex', gap: '8px' }}>
                                 <div style={{ flex: 1 }}>
                                   <label style={{ fontSize: '10px', color: '#0ea5e9', fontWeight: 900, marginBottom: '4px', display: 'block' }}>CHECK-IN DATE</label>
                                   <input 
                                     type="date" 
                                     value={editStayCheckIn} 
                                     onChange={e => {
                                       const newCheckIn = e.target.value;
                                       setEditStayCheckIn(newCheckIn);
                                     }} 
                                     style={{width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 800 }} 
                                   />
                                 </div>
                                 <div style={{ flex: 1 }}>
                                   <label style={{ fontSize: '10px', color: '#0ea5e9', fontWeight: 900, marginBottom: '4px', display: 'block' }}>CHECK-OUT DATE</label>
                                   <input 
                                     type="date" 
                                     value={editStayCheckOut} 
                                     onChange={e => {
                                       const newCheckOut = e.target.value;
                                       setEditStayCheckOut(newCheckOut);
                                     }} 
                                     style={{width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 800 }} 
                                   />
                                 </div>
                               </div>
                               <div>
                                 <label style={{ fontSize: '10px', color: '#0ea5e9', fontWeight: 900, marginBottom: '4px', display: 'block' }}>TOTAL RENT (₹)</label>
                                 <input 
                                   type="number" 
                                   value={editStayTotalCost} 
                                   onFocus={e => e.target.select()}
                                   onChange={e => setEditStayTotalCost(e.target.value)} 
                                   style={{width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 800 }} 
                                   placeholder="Total Rent" 
                                 />
                               </div>
                               <div style={{ padding: '16px', backgroundColor: '#0ea5e910', borderRadius: '14px', border: '1px solid #0ea5e9' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                     <span style={{ fontSize: '11px', color: '#0ea5e9', fontWeight: 900 }}>NEW STAY DURATION</span>
                                     <span style={{ fontSize: '15px', color: '#0ea5e9', fontWeight: 1000 }}>{calculateDaysBetween(editStayCheckIn, editStayCheckOut)} Nights</span>
                                  </div>
                               </div>
                               <div style={{ display: 'flex', gap: '8px' }}>
                                 <button onClick={() => setEditingStay(false)} style={{flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                                 <button onClick={updateStayDetails} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#0ea5e9', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Save Stay Details</button>
                               </div>
                             </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                 <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><User size={24} /></div>
                                 <div>
                                    <div style={{color: 'var(--text-primary)', fontWeight: 900 }}>{room.guest_name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{room.guest_phone}</div>
                                 </div>
                              </div>
                              <button onClick={handleStartEditStay} style={{ padding: '8px 12px', borderRadius: '10px', backgroundColor: 'var(--bg-border)', color: '#0ea5e9', border: 'none', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>EDIT STAY</button>
                            </div>
                          )}
                      </div>
                      
                      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
                         <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--bg-border)' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 800 }}>ROOM CHARGE ({room.booking_days}D)</span>
                            <span style={{ color: '#f43f5e', fontWeight: 900 }}>₹{room.total_cost}</span>
                         </div>
                         {orderItems.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '16px' }}>
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
                                    onClick={() => item.id && updateQuantity(item.id, -1)} 
                                    disabled={!item.id}
                                    style={{cursor: !item.id ? 'not-allowed' : 'pointer', opacity: !item.id ? 0.3 : 1, border: 'none', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)' }}
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span style={{color: 'var(--text-primary)', fontWeight: 1000 }}>{item.quantity}</span>
                                  <button 
                                    onClick={() => item.id && updateQuantity(item.id, 1)} 
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
                         <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 900, marginBottom: '8px' }}>
                            <span>DISCOUNT (%)</span>
                            <input type="number" value={discount} onFocus={e => e.target.select()} onChange={e => setDiscount(e.target.value)} style={{width: '50px', background: 'none', border: 'none', borderBottom: '2px solid #0ea5e9', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 900, outline: 'none' }} />
                         </div>
                         <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)' }}>
                            <span style={{ fontSize: '22px', fontWeight: 1000 }}>Total Due</span>
                            <span style={{ color: '#10b981', fontSize: '22px', fontWeight: 1000 }}>₹{((subtotalVal * (1 + (user?.gst_percentage || 0)/100)) * (1 - discount/100)).toFixed(2)}</span>
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
                             style={{ width: '100%', padding: '16px', borderRadius: '16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', fontWeight: 1000, fontSize: '15px', cursor: 'pointer', opacity: orderItems.length === 0 ? 0.3 : 1 }}
                          >
                             SEND TO KITCHEN
                          </button>
                       ) : (
                          <button onClick={generateBill} style={{ width: '100%', padding: '16px', borderRadius: '16px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', fontWeight: 1000, fontSize: '15px', cursor: 'pointer' }}>SETTLE ROOM BILL</button>
                       )}
                   </div>
                </div>
             )}
          </div>
        </div>
      </div>

      {showBill && billData && (
        <div className="bill-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
             <div style={{width: '100%', maxWidth: '850px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '40px', overflow: 'hidden', display: 'flex', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)', border: '1px solid var(--border-rgba-05)', position: 'relative' }}>
                <div style={{ flex: 1, padding: '48px', borderRight: '1px solid var(--border-rgba-05)', backgroundColor: billData?.is_paid ? '#10b981' : '#0f172a', overflowY: 'auto', position: 'relative', transition: 'all 0.6s' }}>
                 {isSuccess && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: '#10b981', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                       <div style={{width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginBottom: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                          <CheckCircle size={80} strokeWidth={3} />
                       </div>
                       <h2 style={{fontSize: '32px', fontWeight: 1000, color: 'var(--text-primary)', margin: 0 }}>Transaction Complete</h2>
                       <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', marginTop: '8px', fontWeight: 800 }}>Redirecting...</p>
                    </div>
                 )}
                 {!!billData?.is_paid && !isSuccess && (
                    <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                       <div style={{backgroundColor: 'var(--text-primary)', padding: '24px', borderRadius: '50%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}><CheckCircle size={100} color="#10b981" /></div>
                    </div>
                 )}
                 <div style={{ textAlign: 'center', marginBottom: '24px', opacity: billData?.is_paid ? 0.3 : 1 }}>
                    <h1 style={{ margin: 0, fontWeight: 950, fontSize: '28px', color: 'white' }}>{(user?.hotel_name || 'BESTBILL').toUpperCase()}</h1>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>{user?.hotel_location}</div>
                 </div>
                 
                 <div style={{ borderTop: '2px dashed var(--border-rgba-05)', borderBottom: '2px dashed var(--border-rgba-05)', padding: '16px 0', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900, color: 'white' }}>
                       <span>ROOM NO: {room?.room_number}</span>
                       <span>BILL NO: #{billData?.id}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>GUEST: {room?.guest_name?.toUpperCase()}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 800, marginTop: '4px' }}>
                       <span>CHECK-IN: {room?.check_in_date ? new Date(room.check_in_date).toLocaleDateString() : ''}</span>
                       <span>CHECK-OUT: {room?.check_in_date ? new Date(new Date(room.check_in_date).getTime() + (room.booking_days || 1) * 86400000).toLocaleDateString() : ''}</span>
                    </div>
                 </div>

                 <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', borderBottom: '1px dashed var(--border-rgba-05)', paddingBottom: '8px', marginBottom: '12px', fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>
                       <span>Service / Item</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Total</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', fontSize: '15px', fontWeight: 800, marginBottom: '8px', color: 'white' }}>
                       <span>Room Charge ({room?.booking_days} Days)</span><span style={{ textAlign: 'right' }}>1</span><span style={{ textAlign: 'right' }}>₹{billData?.room_charge}</span>
                    </div>
                    {(billData?.items || []).map((i, idx) => (
                       <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', fontSize: '15px', fontWeight: 800, marginBottom: '8px', color: 'white' }}>
                          <span>{i?.name}</span><span style={{ textAlign: 'right' }}>{i?.quantity}</span><span style={{ textAlign: 'right' }}>₹{(i?.price * i?.quantity).toFixed(2)}</span>
                       </div>
                    ))}
                 </div>

                 <div style={{ borderTop: '1px dashed var(--border-rgba-05)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>
                        <span>Subtotal</span>
                        <span>₹{parseFloat(billData?.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {parseFloat(billData?.gst || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>
                            <span>GST ({billData?.gst_percentage}%)</span>
                            <span>₹{parseFloat(billData?.gst || 0).toFixed(2)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '42px', fontWeight: 1000, color: '#10b981', borderTop: '4px double var(--border-rgba-05)', marginTop: '12px', paddingTop: '12px' }}>
                        <span>TOTAL</span>
                        <span>₹{parseFloat(billData?.final_amount || 0).toFixed(0)}</span>
                    </div>
                 </div>

                 {!billData?.is_paid && (
                   <button onClick={rollbackBill} className="btn-modify-invoice" style={{ width: '100%', marginTop: '32px', padding: '20px', borderRadius: '24px', border: '1px solid #475569', backgroundColor: '#334155', color: 'white', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', transition: 'background-color 0.2s' }}>MODIFY INVOICE</button>
                 )}
              </div>
              <div style={{ width: '380px', padding: '36px', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                 <div style={{textAlign: 'center', backgroundColor: 'var(--text-primary)', padding: '24px', borderRadius: '32px' }}>
                    <QRCodeCanvas id="upi-qr-canvas" value={upiLink} size={180} />
                    {!billData?.is_paid && (
                       <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                         <button 
                           type="button"
                           onClick={() => setSelectedPaymentMethod('cash')} 
                           style={{ 
                             flex: 1, 
                             padding: '16px', 
                             backgroundColor: selectedPaymentMethod === 'cash' ? '#10b981' : 'transparent', 
                             color: selectedPaymentMethod === 'cash' ? 'white' : 'var(--text-muted)', 
                             border: selectedPaymentMethod === 'cash' ? 'none' : '2px solid var(--bg-border)', 
                             borderRadius: '16px', 
                             fontWeight: 1000, 
                             cursor: 'pointer', 
                             fontSize: '12px', 
                             textTransform: 'uppercase', 
                             letterSpacing: '0.05em', 
                             boxShadow: selectedPaymentMethod === 'cash' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none',
                             transition: 'all 0.2s'
                           }}
                         >
                           Cash Payment
                         </button>
                         <button 
                           type="button"
                           onClick={() => setSelectedPaymentMethod('upi')} 
                           style={{ 
                             flex: 1, 
                             padding: '16px', 
                             backgroundColor: selectedPaymentMethod === 'upi' ? '#0ea5e9' : 'transparent', 
                             color: selectedPaymentMethod === 'upi' ? 'white' : 'var(--text-muted)', 
                             border: selectedPaymentMethod === 'upi' ? 'none' : '2px solid var(--bg-border)', 
                             borderRadius: '16px', 
                             fontWeight: 1000, 
                             cursor: 'pointer', 
                             fontSize: '12px', 
                             textTransform: 'uppercase', 
                             letterSpacing: '0.05em', 
                             boxShadow: selectedPaymentMethod === 'upi' ? '0 4px 12px rgba(14, 165, 233, 0.2)' : 'none',
                             transition: 'all 0.2s'
                           }}
                         >
                           Online Payment
                         </button>
                       </div>
                     )}
                  </div>
                  {user?.whatsAppBillingEnabled && (
                    <div style={{backgroundColor: 'var(--text-primary)', padding: '20px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--text-primary)' }}>
                       <Phone size={18} color="var(--text-secondary)" />
                       <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={{ border: 'none', outline: 'none', fontWeight: 800, fontSize: '15px', width: '100%', background: 'white', color: 'var(--bg-border)' }} placeholder="Guest Phone" />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px' }}>
                     <button onClick={printBill} style={{flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800', fontSize: '14px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)' }}>
                        <Printer size={18} /> {!billData?.is_paid ? 'Print' : 'Re-Print'}
                     </button>
                     {user?.whatsAppBillingEnabled && (
                       <button onClick={shareViaWhatsApp} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#22c55e', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800', fontSize: '14px', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)' }}>
                          <MessageCircle size={18} /> WhatsApp
                       </button>
                     )}
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RoomOrderModal;
