import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { playInternalChime } from '../components/Layout';
import { 
  Bell, 
  Search, 
  Clock, 
  Utensils, 
  Bed, 
  X,
  History,
  MessageSquare,
  Send,
  Volume2,
  VolumeX,
  CheckCircle2
} from 'lucide-react';

const GuestOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [ownerMessage, setOwnerMessage] = useState('');
    
    // PERSISTENT SOUND STATE
    const [audioEnabled, setAudioEnabled] = useState(() => {
        return localStorage.getItem('guest_order_sound') === 'true';
    });
    
    const activateSound = () => {
        localStorage.setItem('guest_order_sound', 'true');
        setAudioEnabled(true);
        playInternalChime();
        toast.success('Sound Engine Activated!', { icon: '🔊' });
    };

    const disableSound = () => {
        localStorage.setItem('guest_order_sound', 'false');
        setAudioEnabled(false);
        toast('Sound Notifications Muted', { icon: '🔕' });
    };

    const [chatMessages, setChatMessages] = useState([]);
    const chatEndRef = useRef(null);

    const fetchOrdersFeed = async () => {
        try {
            const res = await api.get('/rooms/guest-orders-all');
            setOrders(res.data);
            if (selectedOrder) {
                const chatRes = await api.get(`/rooms/orders/${selectedOrder.order.id}/chat`);
                setChatMessages(chatRes.data);
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => {
        fetchOrdersFeed();
        const interval = setInterval(fetchOrdersFeed, 5000);
        return () => clearInterval(interval);
    }, [selectedOrder]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const viewDetails = async (order) => {
        const l = toast.loading('Opening...');
        try {
            const res = await api.get(`/rooms/${order.room_id}/order`);
            const chatRes = await api.get(`/rooms/orders/${order.id}/chat`);
            setSelectedOrder({ order, items: res.data.items });
            setChatMessages(chatRes.data);
            setOwnerMessage('');
            toast.dismiss(l);
        } catch (err) { toast.error('Failed to load', { id: l }); }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!ownerMessage.trim()) return;
        try {
            await api.post(`/rooms/orders/${selectedOrder.order.id}/chat`, { message: ownerMessage });
            setOwnerMessage('');
            const chatRes = await api.get(`/rooms/orders/${selectedOrder.order.id}/chat`);
            setChatMessages(chatRes.data);
        } catch (err) { toast.error('Failed to send'); }
    };

    const markAsDelivered = async (orderId) => {
        try {
            await api.put(`/rooms/orders/${orderId}/deliver`);
            toast.success('Completed');
            fetchOrdersFeed();
            setSelectedOrder(null);
        } catch (err) { toast.error('Update failed'); }
    };

    const activeList = orders.filter(o => !o.is_delivered && o.room_status === 'occupied').filter(o => o.room_number.includes(searchQuery));
    const historyList = orders.filter(o => o.is_delivered || (o.room_status !== 'occupied' && !o.is_delivered)).filter(o => o.room_number.includes(searchQuery));
    const themeColor = '#0ea5e9';

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}><Bell style={{ color: themeColor }} size={28} /> Guest Orders</h2>
                    
                    {/* SIMPLE SOUND TOGGLE */}
                    <button 
                        onClick={audioEnabled ? disableSound : activateSound}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            backgroundColor: audioEnabled ? '#10b98115' : 'var(--bg-border)', 
                            color: audioEnabled ? '#10b981' : 'var(--text-muted)', 
                            border: `1px solid ${audioEnabled ? '#10b981' : 'var(--bg-border)'}`, 
                            padding: '8px 16px', 
                            borderRadius: '12px', 
                            fontSize: '13px', 
                            fontWeight: 900, 
                            cursor: 'pointer',
                            transition: '0.2s'
                        }}
                    >
                        {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        SOUND {audioEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>
                
                <div style={{ position: 'relative', width: '320px' }}><Search style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={18} /><input placeholder="Search rooms..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{width: '100%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', padding: '14px 16px 14px 48px', borderRadius: '20px', color: 'var(--text-primary)' }} /></div>
            </div>

            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}><Utensils size={20} color={themeColor} /><h3 style={{ margin: 0, fontWeight: 900 }}>Incoming Orders ({activeList.length})</h3></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                    {activeList.map(order => (
                        <div key={order.id} onClick={() => viewDetails(order)} style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '24px', border: '1px solid var(--bg-border)', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><div style={{ width: '50px', height: '50px', background: `${themeColor}15`, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bed color={themeColor} /></div><div><h4 style={{ margin: 0, fontWeight: 900 }}>Room {order.room_number}</h4><span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{order.guest_name}</span></div></div>
                                <span style={{ fontSize: '10px', fontWeight: 900, background: `${themeColor}15`, color: themeColor, padding: '6px 12px', borderRadius: '100px' }}>INCOMING</span>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '14px', marginBottom: '16px', fontSize: '14px', fontWeight: 700, color: themeColor }}>{order.items_summary}</div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={(e) => { e.stopPropagation(); viewDetails(order); }} style={{flex: 1, background: 'var(--bg-border)', color: 'var(--text-primary)', padding: '12px', border: 'none', borderRadius: '12px', fontWeight: 800 }}>Chat</button>
                                <button onClick={(e) => { e.stopPropagation(); markAsDelivered(order.id); }} style={{flex: 1, background: themeColor, color: 'var(--text-primary)', padding: '12px', border: 'none', borderRadius: '12px', fontWeight: 800 }}>Complete</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* History Feed */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}><History size={20} color="#10b981" /><h3 style={{ margin: 0, fontWeight: 900 }}>Order History</h3></div>
                <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--bg-border)', overflow: 'hidden' }}>
                    {historyList.map(order => (
                        <div key={order.id} onClick={() => viewDetails(order)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid var(--bg-border)', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '200px' }}><div style={{ width: '38px', height: '38px', background: '#10b98110', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bed size={18} color="#10b981" /></div><span style={{ fontWeight: 920, fontSize: '16px' }}>Room {order.room_number}</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}><CheckCircle2 size={14} color="#10b981" /><span style={{ color: '#10b981', fontWeight: 800, fontSize: '12px' }}>DELIVERED</span></div>
                            <div style={{ fontSize: '18px', fontWeight: 1000, color: '#10b981' }}>₹{order.total_amount || 0}</div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedOrder && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.98)', backdropFilter: 'blur(32px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ width: '100%', maxWidth: '900px', backgroundColor: 'var(--bg-card)', borderRadius: '48px', padding: '48px', border: '1px solid var(--border-rgba-05)', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '48px' }}>
                        <div>
                            <h3 style={{fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 32px' }}>Room {selectedOrder.order.room_number}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                                {selectedOrder.items.map(item => (
                                    <div key={item.id} style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        backgroundColor: 'rgba(255,255,255,0.02)', 
                                        padding: '16px 20px', 
                                        borderRadius: '16px',
                                        border: '1px solid var(--border-rgba-05)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '32px', height: '32px', backgroundColor: `${themeColor}15`, color: themeColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 900 }}>
                                                {item.quantity}
                                            </div>
                                            <span style={{fontWeight: 800, color: 'var(--text-primary)', fontSize: '15px' }}>{item.name}</span>
                                        </div>
                                        <span style={{ fontWeight: 900, color: themeColor }}>₹{item.price * item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '32px', borderTop: '1px solid var(--bg-border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Grand Total</span>
                                    <div style={{fontSize: '32px', fontWeight: 1000, color: 'var(--text-primary)' }}>₹{selectedOrder.order.total_amount || selectedOrder.items.reduce((s, i) => s + (i.price * i.quantity), 0)}</div>
                                </div>
                                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 900, backgroundColor: '#10b98115', padding: '6px 12px', borderRadius: '100px' }}>VERIFIED GUEST</span>
                            </div>
                        </div>
                        <div style={{ borderLeft: '1px solid var(--bg-border)', paddingLeft: '48px', display: 'flex', flexDirection: 'column', height: '600px' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}><h4 style={{ fontWeight: 900, color: '#0ea5e9' }}>Chat</h4><button onClick={() => setSelectedOrder(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={32}/></button></div><div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-base)', borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--bg-border)', marginBottom: '20px' }}>{chatMessages.map(msg => (<div key={msg.id} style={{ alignSelf: msg.sender === 'owner' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: msg.sender === 'owner' ? 'var(--bg-border)' : '#0ea5e920', padding: '10px 16px', borderRadius: '14px' }}><p style={{margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>{msg.message}</p></div>))}<div ref={chatEndRef} /></div><form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}><input placeholder="Type..." value={ownerMessage} onChange={e => setOwnerMessage(e.target.value)} style={{flex: 1, backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', padding: '14px', borderRadius: '16px', color: 'var(--text-primary)' }} /><button type="submit" style={{backgroundColor: themeColor, color: 'var(--text-primary)', padding: '14px 20px', borderRadius: '16px', border: 'none' }}><Send size={18}/></button></form></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuestOrders;
