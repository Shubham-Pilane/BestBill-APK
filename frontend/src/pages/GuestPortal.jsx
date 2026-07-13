import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { toast, Toaster } from 'react-hot-toast';
import { 
  Plus, 
  Minus, 
  Smartphone, 
  Bed, 
  CheckCircle2,
  MessageCircle,
  PhoneCall,
  Send,
  X,
  Store,
  LogOut,
  User,
  ShoppingBag,
  Clock
} from 'lucide-react';

const GuestPortal = () => {
  const { hotelId } = useParams();
  const [step, setStep] = useState('onboarding'); 
  const [hotel, setHotel] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isPlacing, setIsPlacing] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = useRef(null);
  
  const [guestData, setGuestData] = useState({
    name: '',
    phone: '',
    room: ''
  });

  const [cart, setCart] = useState({});

  useEffect(() => {
    const fetchHotelData = async () => {
      try {
        const res = await api.get(`/guest/hotel/${hotelId}`);
        setHotel(res.data.hotel);
        setCategories(res.data.categories || []);
        setMenu(res.data.menu || []);
        if (res.data.categories?.length > 0) setActiveCategory(res.data.categories[0].id);
        
        const savedGuest = localStorage.getItem(`guest_${hotelId}`);
        if (savedGuest) {
            setGuestData(JSON.parse(savedGuest));
            setStep('menu');
        }
      } catch (err) { toast.error('Check internet.'); } finally { setLoading(false); }
    };
    fetchHotelData();
  }, [hotelId]);

  const handleLogout = () => {
    if (window.confirm('Clear session?')) {
        localStorage.removeItem(`guest_${hotelId}`);
        window.location.reload();
    }
  };

  useEffect(() => {
    if (!guestData.room || !hotel) return;
    const poll = async () => {
        try {
            const res = await api.get(`/guest/order-status-ext/${hotelId}/${guestData.room}`);
            if (res.data) {
                setActiveOrder(res.data);
                const chatRes = await api.get(`/guest/order/${res.data.id}/chat`);
                if (chatRes.data.length > chatMessages.length) {
                    const lastMsg = chatRes.data[chatRes.data.length - 1];
                    if (lastMsg && lastMsg.sender === 'owner') {
                        new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3').play().catch(() => {});
                        toast('Manager Reply: ' + lastMsg.message);
                    }
                    setChatMessages(chatRes.data);
                }
            } else { setActiveOrder(null); }
        } catch (e) {}
    };
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [hotel, guestData.room, chatMessages.length]);

  useEffect(() => {
    if (isChatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  const sendChatMessage = async (e) => { e.preventDefault();
    if (!chatInput.trim() || !activeOrder) return;
    try {
        await api.post(`/guest/order/${activeOrder.id}/chat`, { message: chatInput });
        setChatInput('');
        const chatRes = await api.get(`/guest/order/${activeOrder.id}/chat`);
        setChatMessages(chatRes.data);
    } catch (err) { toast.error('Failed'); }
  };

  const handleOnboard = async (e) => { 
    e.preventDefault();
    if (!guestData.name || !guestData.phone || !guestData.room) return toast.error('Fill Name, Phone, Room.');
    
    const l = toast.loading('Verifying identity...');
    try {
        const res = await api.post('/guest/verify-guest', {
            hotelId,
            roomNumber: guestData.room,
            phone: guestData.phone
        });
        
        const finalData = { ...guestData, name: res.data.guest_name || guestData.name };
        setGuestData(finalData);
        localStorage.setItem(`guest_${hotelId}`, JSON.stringify(finalData));
        
        toast.success(res.data.message, { id: l });
        setStep('menu');
    } catch (err) {
        toast.error(err.response?.data?.message || 'Verification Failed', { id: l });
    }
  };

  const updateCart = (item, delta) => {
    const newCart = { ...cart };
    const cur = newCart[item.id]?.quantity || 0;
    const next = cur + delta;
    if (next <= 0) delete newCart[item.id];
    else newCart[item.id] = { ...item, quantity: next };
    setCart(newCart);
  };

  const totalItems = Object.values(cart).reduce((s, i) => s + i.quantity, 0);
  const totalPrice = Object.values(cart).reduce((s, i) => s + (i.price * i.quantity), 0);

  const placeOrder = async () => {
    setIsPlacing(true);
    const l = toast.loading('Sending order to kitchen...');
    setTimeout(async () => {
        try {
            await api.post(`/guest/order`, {
                hotelId, guestName: guestData.name, guestPhone: guestData.phone, roomNumber: guestData.room, 
                items: Object.values(cart)
            });
            setCart({});
            setIsPlacing(false);
            setStep('success');
            toast.success('Successfully sent to kitchen!', { id: l });
        } catch (err) {
            setIsPlacing(false);
            toast.error('Failed.', { id: l });
        }
    }, 2500);
  };

  if (loading) return <div style={{ height: '100vh', background: 'var(--bg-base)' }}></div>;

  return (
    <div style={{minHeight: '100vh', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: '"Outfit", sans-serif', maxWidth: '600px', margin: '0 auto', overflowX: 'hidden', position: 'relative' }}>
        <Toaster position="top-center" />
        <style>{`
            @keyframes spin { 
                0% { transform: rotate(0deg); } 
                100% { transform: rotate(360deg); } 
            }
            .rotating {
                animation: spin 1s linear infinite;
            }
        `}</style>

        {isPlacing && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="rotating" style={{ width: '60px', height: '60px', border: '5px solid #0ea5e9', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                <h3 style={{ marginTop: '24px', fontWeight: 900 }}>Sending to Kitchen...</h3>
            </div>
        )}

        {step === 'onboarding' && (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <h1 style={{ fontWeight: 900 }}>Welcome to {hotel?.name}</h1>
                <form onSubmit={handleOnboard} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
                    <div style={{ position: 'relative' }}><User size={18} style={{ position: 'absolute', top: '20px', left: '20px', color: 'var(--text-muted)' }} /><input placeholder="Guest Name" value={guestData.name} onChange={e => setGuestData({...guestData, name: e.target.value})} style={{width: '100%', padding: '20px 20px 20px 52px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: '16px', color: 'var(--text-primary)', fontSize: '16px', outline: 'none' }} /></div>
                    
                    <div>
                        <label style={{ fontSize: '11px', color: '#f43f5e', fontWeight: 800, textAlign: 'left', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                           * Enter number registered during check-in
                        </label>
                        <div style={{ position: 'relative' }}>
                           <Smartphone size={18} style={{ position: 'absolute', top: '20px', left: '20px', color: 'var(--text-muted)' }} />
                           <input placeholder="Mobile Number" value={guestData.phone} onChange={e => setGuestData({...guestData, phone: e.target.value})} style={{width: '100%', padding: '20px 20px 20px 52px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: '16px', color: 'var(--text-primary)', fontSize: '16px', outline: 'none' }} />
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}><Bed size={18} style={{ position: 'absolute', top: '20px', left: '20px', color: 'var(--text-muted)' }} /><input placeholder="Room Number" value={guestData.room} onChange={e => setGuestData({...guestData, room: e.target.value})} style={{width: '100%', padding: '20px 20px 20px 52px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: '16px', color: 'var(--text-primary)', fontSize: '16px', outline: 'none' }} /></div>
                    <button type="submit" style={{ backgroundColor: '#0ea5e9', color: 'white', padding: '20px', borderRadius: '16px', fontWeight: 900 }}>Start Ordering</button>
                </form>
            </div>
        )}

        {step === 'menu' && (
            <div style={{ paddingBottom: '120px' }}>
                <header style={{ padding: '24px', position: 'sticky', top: 0, backgroundColor: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(10px)', zIndex: 100 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><h2 style={{ fontSize: '20px', fontWeight: 920, margin: 0 }}>{hotel?.name}</h2><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Room {guestData.room}</p></div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {activeOrder && (
                                <button onClick={() => setShowOrderDetails(true)} style={{ width: '46px', height: '46px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}><ShoppingBag size={20}/></button>
                            )}
                            <button onClick={() => setIsChatOpen(true)} style={{ width: '46px', height: '46px', backgroundColor: '#0ea5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: 'none' }}><MessageCircle size={22} /></button>
                            <a href={`tel:${hotel?.phone || ''}`} style={{width: '46px', height: '46px', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}><PhoneCall size={20} /></a>
                            <button onClick={handleLogout} style={{ width: '46px', height: '46px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}><LogOut size={20} /></button>
                        </div>
                    </div>
                </header>
                <main style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '32px' }}>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{ whiteSpace: 'nowrap', padding: '10px 18px', borderRadius: '10px', background: activeCategory === cat.id ? '#0ea5e9' : 'var(--bg-card)', color: activeCategory === cat.id ? 'white' : 'var(--text-muted)', border: 'none', fontWeight: 900 }}>{cat.name.toUpperCase()}</button>
                        ))}
                    </div>
                    {menu.filter(m => m.category_id === activeCategory).map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--bg-border)' }}>
                            <div><h4 style={{ margin: 0, fontWeight: 800 }}>{item.name}</h4><span style={{ color: '#10b981', fontWeight: 1000 }}>₹{item.price}</span></div>
                            <button onClick={() => updateCart(item, 1)} style={{ padding: '10px 18px', borderRadius: '10px', backgroundColor: '#0ea5e9', border: 'none', color: 'white', fontWeight: 800 }}>{cart[item.id] ? `${cart[item.id].quantity}` : 'ADD'}</button>
                        </div>
                    ))}
                </main>
                {totalItems > 0 && <div style={{ position: 'fixed', bottom: '24px', left: '24px', right: '24px', zIndex: 1000 }}><button onClick={() => setStep('cart')} style={{width: '100%', background: '#0ea5e9', color: 'var(--text-primary)', padding: '22px', borderRadius: '24px', fontWeight: 900, border: 'none', display: 'flex', justifyContent: 'space-between' }}><span>{totalItems} Items | Checkout</span><span>₹{totalPrice}</span></button></div>}
            </div>
        )}

        {step === 'cart' && (
            <div style={{ padding: '40px 24px' }}>
                <h1 style={{ fontWeight: 900 }}>Summary</h1>
                <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', margin: '24px 0' }}>
                    {Object.values(cart).map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}><span style={{ fontWeight: 700 }}>{item.quantity}× {item.name}</span><span>₹{item.price * item.quantity}</span></div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: '16px', fontWeight: 920, fontSize: '20px', color: '#10b981' }}>Total: ₹{totalPrice}</div>
                </div>
                <button onClick={placeOrder} style={{width: '100%', background: '#10b981', color: 'var(--text-primary)', padding: '24px', borderRadius: '24px', border: 'none', fontWeight: 920 }}>Send to Kitchen</button>
            </div>
        )}

        {step === 'success' && (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                <CheckCircle2 size={80} color="#10b981" />
                <h1 style={{ fontWeight: 1000, margin: '24px 0' }}>Sent!</h1>
                <button onClick={() => setStep('menu')} style={{background: '#0ea5e9', color: 'var(--text-primary)', padding: '18px 40px', borderRadius: '16px', border: 'none', fontWeight: 800 }}>Back to Menu</button>
            </div>
        )}

        {showOrderDetails && activeOrder && (
            <div style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '600px', zIndex: 3000, background: 'rgba(2, 6, 23, 0.95)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ background: 'var(--bg-card)', borderTopLeftRadius: '40px', borderTopRightRadius: '40px', padding: '40px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}><h2 style={{ fontWeight: 1000, margin: 0 }}>My Order</h2><button onClick={() => setShowOrderDetails(false)} style={{ background: 'none', color: 'var(--text-muted)', border: 'none' }}><X size={32}/></button></div>
                    <div style={{ background: 'var(--bg-base)', padding: '24px', borderRadius: '24px', marginBottom: '24px' }}><p style={{ fontWeight: 800 }}>{activeOrder.items_summary}</p></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 800 }}>Total Paid:</span><span style={{ fontWeight: 1000, color: '#10b981', fontSize: '24px' }}>₹{activeOrder.total_amount}</span></div>
                </div>
            </div>
        )}

        {isChatOpen && (
            <div style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '600px', zIndex: 4000, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-rgba-05)', borderRight: '1px solid var(--border-rgba-05)' }}>
                <header style={{ padding: '24px', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><Store size={22} color="#0ea5e9"/><h4 style={{ margin: 0, fontWeight: 900 }}>Manager</h4></div>
                    <button onClick={() => setIsChatOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={32}/></button>
                </header>
                <main style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {chatMessages.map(msg => (<div key={msg.id} style={{ alignSelf: msg.sender === 'guest' ? 'flex-end' : 'flex-start', background: msg.sender === 'guest' ? '#0ea5e9' : 'var(--bg-border)', padding: '12px 16px', borderRadius: '16px' }}>{msg.message}</div>))}
                    <div ref={chatEndRef} />
                </main>
                <footer style={{ padding: '16px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-rgba-05)' }}>
                    <form onSubmit={sendChatMessage} style={{ display: 'flex', gap: '8px' }}><input placeholder="Type..." value={chatInput} onChange={e => setChatInput(e.target.value)} style={{flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--bg-base)', border: 'none', color: 'var(--text-primary)', fontSize: '16px', outline: 'none' }} /><button type="submit" style={{width: '56px', height: '56px', background: '#0ea5e9', borderRadius: '16px', border: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Send size={20}/></button></form>
                </footer>
            </div>
        )}
    </div>
  );
};

export default GuestPortal;
