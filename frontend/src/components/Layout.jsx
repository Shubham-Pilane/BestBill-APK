import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { toast } from 'react-hot-toast';
import api from '../services/api';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  LogOut, 
  UserCircle, 
  History, 
  Wallet, 
  Menu, 
  X, 
  Bed, 
  Bell,
  ShieldCheck,
  ChefHat,
  Headset,
  Phone,
  Mail,
  Boxes
} from 'lucide-react';

const playInternalChime = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const playNote = (freq, startTime, duration) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.className = "generated-note";
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.1, startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        const now = audioCtx.currentTime;
        playNote(880, now, 0.4);      
        playNote(1108.73, now + 0.1, 0.4); 
        playNote(1318.51, now + 0.2, 0.6); 
    } catch (e) { console.error("Audio Error:", e); }
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();

  const location = useLocation();
  const isWaiter = user?.role === 'waiter';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [pendingGuestOrders, setPendingGuestOrders] = useState(0);

  // SIMPLIFIED DETECTION LOGIC
  const prevCount = useRef(-1); 

  const fetchPendingOrders = async () => {
    if (isWaiter || !user || !user.lodgingEnabled) return;
    try {
        const res = await api.get('/rooms/guest-orders-all');
        const activeOrders = res.data.filter(o => !o.is_delivered && o.room_status === 'occupied');
        const currentCount = activeOrders.length;

        // --- AUTOMATIC CHIME TRIGGER ---
        if (prevCount.current !== -1 && currentCount > prevCount.current) {
            if (localStorage.getItem('guest_order_sound') === 'true') {
                playInternalChime();
                toast(`NEW ORDER RECEIVED!`, { 
                    icon: '🔔',
                    style: { borderRadius: '20px', background: '#0ea5e9', color: '#fff', fontWeight: 900 }
                });
            }
        }
        
        prevCount.current = currentCount;
        setPendingGuestOrders(currentCount);
    } catch (e) {}
  };

  useEffect(() => {
    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const lodgingEnabled = user?.lodgingEnabled || false;
  const inventoryEnabled = user?.inventoryEnabled || false;

  const baseNavItems = isWaiter 
      ? [
          { name: 'Table Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
          { name: 'Profile Settings', path: '/profile', icon: <UserCircle size={20} /> },
        ]
      : [
          { name: 'Table Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
          { name: 'Manage Menu', path: '/menu', icon: <UtensilsCrossed size={20} /> },
          { name: 'Billing History', path: '/history', icon: <History size={20} /> },
          { name: 'Credit Management', path: '/credit', icon: <Wallet size={20} /> },
          { name: 'Profile Settings', path: '/profile', icon: <UserCircle size={20} /> },
        ];

  const kotEnabled = user?.kotEnabled || false;

  const navItems = baseNavItems.filter(item => {
    if (item.path === '/kitchen-kot' && !kotEnabled) return false;
    if (item.path === '/inventory' && !inventoryEnabled) return false;
    if (item.path === '/lodging' && !lodgingEnabled) return false;
    if (item.path === '/orders' && !lodgingEnabled) return false;
    return true;
  });

  const handleNavClick = (e, item) => {
    if (item.path === '/kitchen-kot' && !kotEnabled) {
      e.preventDefault();
      toast.error("You need licencse for that to unloack this fetaure contact Shubham Pilane 9822401802", {
        style: {
          borderRadius: '12px',
          background: 'var(--bg-card)',
          color: '#fff',
          border: '1px solid #ef4444',
          fontWeight: '900',
          fontSize: '14px'
        }
      });
      return;
    }
    if (item.path === '/inventory' && !inventoryEnabled) {
      e.preventDefault();
      toast.error("You need license for that to unlock this feature contact Shubham Pilane 9822401802", {
        style: {
          borderRadius: '12px',
          background: 'var(--bg-card)',
          color: '#fff',
          border: '1px solid #ef4444',
          fontWeight: '900',
          fontSize: '14px'
        }
      });
      return;
    }
    if ((item.path === '/lodging' || item.path === '/orders') && !lodgingEnabled) {
      e.preventDefault();
      toast.error("You need licencse for that to unloack this fetaure contact Shubham Pilane 9822401802", {
        style: {
          borderRadius: '12px',
          background: 'var(--bg-card)',
          color: '#fff',
          border: '1px solid #ef4444',
          fontWeight: '900',
          fontSize: '14px'
        }
      });
      return;
    }
    setMobileMenuOpen(false);
  };


  return (
    <div style={{display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-layout)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', zIndex: 150 }}
        />
      )}

      {/* Sidebar */}
      <aside 
        style={{ 
          width: '280px', 
          backgroundColor: 'var(--bg-card)', 
          borderRight: '1px solid var(--bg-border)', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'fixed', 
          top: 0, 
          left: 0,
          bottom: 0,
          height: '100vh', 
          zIndex: 200,
          transition: 'transform 0.3s ease',
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          overflowY: 'auto'
        }} 
        className="sidebar-responsive"
      >
        <div style={{ padding: '40px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '54px', height: '54px', backgroundColor: '#0ea5e9', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UtensilsCrossed color="white" size={30} /></div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, margin: 0 }}>Best<span style={{ color: '#38bdf8' }}>Bill</span></h1>
          </div>
          {/* Close button only for mobile */}
          <button className="mobile-only" onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              onClick={(e) => handleNavClick(e, item)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderRadius: '14px', textDecoration: 'none', color: location.pathname === item.path ? '#0ea5e9' : 'var(--text-secondary)', backgroundColor: location.pathname === item.path ? 'rgba(14, 165, 233, 0.1)' : 'transparent', fontWeight: 700, fontSize: '16px' }}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.name}</span>
              {(item.path === '/orders') && pendingGuestOrders > 0 && (
                <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '100px' }}>{pendingGuestOrders}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Customer Care */}
        <div style={{ padding: '0 24px', marginTop: '8px' }}>
          <button
            onClick={() => setShowSupport(!showSupport)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', borderRadius: '14px', backgroundColor: showSupport ? 'rgba(14, 165, 233, 0.1)' : 'transparent', border: 'none', cursor: 'pointer', color: showSupport ? '#0ea5e9' : 'var(--text-secondary)', fontWeight: 700, fontSize: '16px', textAlign: 'left' }}
          >
            <Headset size={20} />
            <span style={{ flex: 1 }}>Customer Care</span>
          </button>
          {showSupport && (
            <div style={{ backgroundColor: 'rgba(14, 165, 233, 0.05)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(14, 165, 233, 0.1)', marginTop: '6px', animation: 'fadeIn 0.2s ease' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, margin: '0 0 8px 0', lineHeight: '1.5' }}>Founder — <span style={{ color: 'var(--text-primary)' }}>Shubham Pilane</span></p>
              <a href="tel:+919822401802" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, textDecoration: 'none', marginBottom: '4px' }}>
                <Phone size={12} style={{ color: '#10b981' }} /> +91 9822401802
              </a>
              <a href="mailto:bestbillsolutions@gmail.com" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                <Mail size={12} style={{ color: '#f59e0b' }} /> bestbillsolutions@gmail.com
              </a>
              <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, margin: '10px 0 0 0', lineHeight: '1.5' }}>For any support, queries, or technical assistance, please contact us.</p>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={logout} style={{ width: '100%', padding: '14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
        <header className="responsive-header" style={{ height: '72px', backgroundColor: 'var(--bg-card)', padding: '0 24px', display: 'none', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bg-border)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setMobileMenuOpen(true)} style={{color: 'var(--text-primary)', background: 'var(--border-rgba-05)', border: '1px solid var(--border-rgba-1)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Menu size={24} />
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 900, margin: 0 }}>Best<span style={{ color: '#38bdf8' }}>Bill</span></h1>
          </div>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #334155' }}>
                  <UserCircle size={20} color="var(--text-secondary)" />
               </div>
            </div>
          )}
        </header>

        <main style={{ flex: 1, padding: '40px' }} className="main-responsive">{children}</main>
      </div>

      <style>{`
        @media (min-width: 1025px) {
          .sidebar-responsive {
            transform: none !important;
            position: sticky !important;
          }
          .responsive-header {
            display: none !important;
          }
          .mobile-only {
            display: none !important;
          }
        }
        @media (max-width: 1024px) {
          .responsive-header {
            display: flex !important;
          }
          .main-responsive {
            padding: 24px !important;
          }
          .sidebar-responsive {
             width: 300px !important;
          }
        }
        @media (max-width: 640px) {
           .main-responsive {
             padding: 20px 16px !important;
           }
        }
      `}</style>
    </div>
  );
};
export default Layout;
export { playInternalChime };
