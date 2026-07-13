import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { playInternalChime } from '../components/Layout';
import { 
  ChefHat, 
  Clock, 
  Flame, 
  Volume2, 
  VolumeX,
  AlertTriangle,
  User,
  Calendar,
  Utensils,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const KitchenKOT = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(() => {
        return localStorage.getItem('kitchen_order_sound') === 'true';
    });
    const [expandedOrders, setExpandedOrders] = useState({});

    const prevCount = useRef(-1);

    const toggleExpand = (orderId) => {
        setExpandedOrders(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const activateSound = () => {
        localStorage.setItem('kitchen_order_sound', 'true');
        setAudioEnabled(true);
        playInternalChime();
        toast.success('Sound Alert Activated!', { icon: '🔊' });
    };

    const disableSound = () => {
        localStorage.setItem('kitchen_order_sound', 'false');
        setAudioEnabled(false);
        toast('Sound Notifications Muted', { icon: '🔕' });
    };

    const fetchKitchenOrders = async () => {
        try {
            const res = await api.get('/kitchen/orders');
            setOrders(res.data);
            
            const currentCount = res.data.length;
            if (prevCount.current !== -1 && currentCount > prevCount.current) {
                if (localStorage.getItem('kitchen_order_sound') === 'true') {
                    playInternalChime();
                    toast(`New KOT Order Received!`, { 
                        icon: '🍳',
                        style: { borderRadius: '20px', background: '#f59e0b', color: '#fff', fontWeight: 900 }
                    });
                }
            }
            prevCount.current = currentCount;
        } catch (err) {
            console.error('Error fetching kitchen orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKitchenOrders();
        const interval = setInterval(fetchKitchenOrders, 5000);
        return () => clearInterval(interval);
    }, []);

    const formatDateTime = (timestamp) => {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        let ampm = 'AM';
        let displayHours = date.getHours();
        if (displayHours >= 12) {
            ampm = 'PM';
            if (displayHours > 12) displayHours -= 12;
        }
        if (displayHours === 0) displayHours = 12;
        const displayHoursStr = String(displayHours).padStart(2, '0');
        return `${day}/${month}/${year} ${displayHoursStr}:${minutes} ${ampm}`;
    };

    const themeColor = '#f59e0b'; // Warm orange flame/kitchen aesthetic

    if (loading) {
        return (
            <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '4px solid var(--bg-border)', borderTopColor: themeColor, animation: 'spin 1s linear infinite' }}></div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 800 }}>Loading Kitchen Queue...</div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', color: 'var(--text-primary)' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                   <h2 style={{ fontSize: '22px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                       <ChefHat style={{ color: themeColor }} size={24} /> Kitchen Display (KOT)
                   </h2>
                   <p style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '13px', margin: '4px 0 0 0' }}>
                       Live orders being prepared by the kitchen crew.
                   </p>
                </div>
                
                {/* SOUND TOGGLE */}
                <button 
                    onClick={audioEnabled ? disableSound : activateSound}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        backgroundColor: audioEnabled ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-border)', 
                        color: audioEnabled ? themeColor : 'var(--text-muted)', 
                        border: `1px solid ${audioEnabled ? themeColor : 'var(--bg-border)'}`, 
                        padding: '8px 16px', 
                        borderRadius: '8px', 
                        fontSize: '13px', 
                        fontWeight: 600, 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    KITCHEN ALERT: {audioEnabled ? 'ON' : 'OFF'}
                </button>
            </div>

            {/* Compact unified List view */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Flame size={18} color={themeColor} />
                    <h3 style={{ margin: 0, fontWeight: 600, fontSize: '16px' }}>
                        Active Kitchen Orders ({orders.length})
                    </h3>
                </div>

                {orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '2px dashed var(--bg-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ChefHat size={30} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div>
                            <h4 style={{margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>All Caught Up!</h4>
                            <p style={{ color: 'var(--text-muted)', fontWeight: 500, margin: 0, fontSize: '13px' }}>No active waiter KOT orders are waiting in the kitchen.</p>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {orders.map(order => {
                            const isExpanded = !!expandedOrders[order.order_id];
                            return (
                                <div 
                                    key={order.order_id} 
                                    style={{ 
                                        backgroundColor: 'var(--bg-card)', 
                                        borderRadius: '12px', 
                                        padding: isExpanded ? '14px 20px' : '10px 20px', 
                                        border: '1px solid var(--bg-border)', 
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: isExpanded ? '12px' : '0px',
                                        transition: 'all 0.2s ease',
                                        animation: 'fadeIn 0.3s ease'
                                    }}
                                >
                                    {/* KOT Row Header */}
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        borderBottom: isExpanded ? '1px dashed var(--bg-border)' : 'none', 
                                        paddingBottom: isExpanded ? '10px' : '0px', 
                                        flexWrap: 'wrap', 
                                        gap: '10px' 
                                    }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <div style={{ 
                                                width: '10px', 
                                                height: '10px', 
                                                borderRadius: '50%', 
                                                backgroundColor: themeColor,
                                                boxShadow: `0 0 8px ${themeColor}`
                                            }} />
                                            <div>
                                                <h4 style={{margin: 0, fontWeight: 600, fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                                                    TABLE {order.table_number}
                                                </h4>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                    Location: {order.table_floor}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Order Metadata */}
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            {order.status !== 'active' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cleared</span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, backgroundColor: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-rgba-05)' }}>
                                                <User size={12} color="#0ea5e9" style={{ flexShrink: 0 }} />
                                                <span>Waiter: <span style={{color: 'var(--text-primary)' }}>{order.waiter_name || 'Waiter'}</span></span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, backgroundColor: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-rgba-05)' }}>
                                                <Calendar size={12} style={{ flexShrink: 0 }} />
                                                <span>Sent: <span style={{color: 'var(--text-primary)' }}>{formatDateTime(order.kot_sent_at)}</span></span>
                                            </div>
                                            <div style={{ fontSize: '15px', color: '#10b981', fontWeight: 600, marginRight: '4px' }}>
                                                 ₹{parseFloat(order.total_amount || 0).toFixed(0)}
                                            </div>
                                            <button
                                                onClick={() => toggleExpand(order.order_id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    backgroundColor: isExpanded ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-border)',
                                                    color: isExpanded ? themeColor : 'var(--text-secondary)',
                                                    border: `1px solid ${isExpanded ? themeColor : '#334155'}`,
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    outline: 'none'
                                                }}
                                            >
                                                <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* KOT Row Body (Items List & Instructions) */}
                                    {isExpanded && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.2s ease-out', marginTop: '10px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {order.items.map((item, idx) => (
                                                    <div key={idx} style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px',
                                                        backgroundColor: 'var(--bg-base)', 
                                                        padding: '6px 12px', 
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--bg-border)',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        color: 'var(--text-primary)'
                                                    }}>
                                                        <span>{item.name}</span>
                                                        <span style={{ color: themeColor, fontWeight: 800 }}>x{item.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Guest Note (Cooking Instructions) */}
                                            {order.guest_note && (
                                                <div style={{ 
                                                    display: 'flex', 
                                                    gap: '8px', 
                                                    backgroundColor: 'rgba(16, 185, 129, 0.05)', 
                                                    border: '1px solid rgba(16, 185, 129, 0.15)', 
                                                    padding: '8px 14px', 
                                                    borderRadius: '8px',
                                                    marginTop: '4px'
                                                }}>
                                                    <AlertTriangle size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                    <div>
                                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instruction: </span>
                                                        <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 500 }}>"{order.guest_note}"</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default KitchenKOT;
