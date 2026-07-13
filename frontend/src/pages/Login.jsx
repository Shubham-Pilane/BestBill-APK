import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { UtensilsCrossed, LogIn, Mail, Lock, UserPlus, Store, ChevronRight, AlertTriangle, Phone, AtSign, MapPin, Upload, Image as ImageIcon, Sun, Moon } from 'lucide-react';
import api from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [blockedInfo, setBlockedInfo] = useState(null);
  
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [isRegistrationAllowed, setIsRegistrationAllowed] = useState(true);
  
  const { login } = useAuth();
  const { theme, toggleTheme, setTheme, isLight } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const checkRegisterStatus = async () => {
      try {
        const res = await api.get('/auth/register-status');
        setIsRegistrationAllowed(res.data.isRegistrationAllowed);
      } catch (err) {
        console.error('Failed to fetch registration status', err);
      }
    };
    checkRegisterStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading(isForgotPassword ? 'Resetting password...' : isRegister ? 'Creating account...' : 'Signing in...');
    try {
      if (isForgotPassword) {
        if (newPassword !== confirmPassword) {
           toast.dismiss(loadingToast);
           return toast.error("Passwords do not match");
        }
        await api.post('/auth/forgot-password', { email, newPassword });
        toast.success('Password updated successfully!', { id: loadingToast });
        setIsForgotPassword(false);
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else if (isRegister) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('password', password);
        formData.append('hotelName', hotelName);
        formData.append('phone', phone);
        formData.append('address', address);
        await api.post('/auth/register', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Registration successful!', { id: loadingToast });
        setIsRegister(false);
      } else {
        await login(email, password);
        toast.success('Welcome back!', { id: loadingToast });
        navigate('/');
      }
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 403 && (data?.message === 'PLAN_EXPIRED' || data?.message === 'SERVICE_BLOCKED')) {
        toast.dismiss(loadingToast);
        setBlockedInfo({
          type: data.message,
          reason: data.reason,
          phone: data.contact_phone,
          email: data.contact_email
        });
      } else {
        toast.error(data?.message || 'Action failed', { id: loadingToast });
      }
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey) return toast.error('Please enter a license key');
    const loadingToast = toast.loading('Verifying license...');
    try {
      await api.post('/auth/activate-license', { licenseKey });
      toast.success('License activated successfully! Please login again.', { id: loadingToast });
      setBlockedInfo(null);
      setLicenseKey('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid license key', { id: loadingToast });
    }
  };

  // --- Blocked / Expired Full-Screen ---
  if (blockedInfo) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--bg-base)', zIndex: 9999, fontFamily: "'Inter', sans-serif"
      }}>
        {/* Theme Toggle Switcher */}
        <div style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--bg-border)',
          borderRadius: '12px',
          padding: '4px',
          gap: '4px',
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          width: '160px'
        }}>
          <button
            type="button"
            onClick={() => setTheme('light')}
            style={{
              flex: 1,
              padding: '6px 8px',
              backgroundColor: isLight ? 'var(--bg-card)' : 'transparent',
              color: isLight ? '#0ea5e9' : 'var(--text-muted)',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontSize: '11px',
              transition: 'all 0.2s',
              boxShadow: isLight ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Sun size={12} /> Light
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            style={{
              flex: 1,
              padding: '6px 8px',
              backgroundColor: !isLight ? 'var(--bg-card)' : 'transparent',
              color: !isLight ? '#38bdf8' : 'var(--text-muted)',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontSize: '11px',
              transition: 'all 0.2s',
              boxShadow: !isLight ? '0 2px 4px rgba(0,0,0,0.15)' : 'none'
            }}
          >
            <Moon size={12} /> Dark
          </button>
        </div>

        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '400px', height: '400px', backgroundColor: 'rgba(244, 63, 94, 0.1)', borderRadius: '50%', filter: 'blur(100px)' }}></div>
          <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '500px', height: '500px', backgroundColor: 'rgba(244, 63, 94, 0.08)', borderRadius: '50%', filter: 'blur(100px)' }}></div>
        </div>
        <div style={{ width: '100%', maxWidth: '480px', padding: '20px', zIndex: 10 }}>
          <div style={{
            backgroundColor: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
            borderRadius: '32px', border: '1px solid rgba(244, 63, 94, 0.3)',
            padding: '48px', boxShadow: '0 25px 50px -12px rgba(244, 63, 94, 0.15)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '80px', height: '80px', background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
              borderRadius: '24px', marginBottom: '20px',
              boxShadow: '0 10px 30px rgba(244, 63, 94, 0.4)'
            }}>
              <AlertTriangle style={{color: '#ffffff' }} size={40} />
            </div>

            <p style={{ color: isLight ? 'var(--text-primary)' : '#38bdf8', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
              Licensed to: Shubham Pilane
            </p>

            <h1 style={{color: 'var(--text-primary)', fontSize: '26px', fontWeight: 900, margin: '0 0 8px 0' }}>
              {blockedInfo.type === 'PLAN_EXPIRED' ? 'Plan Expired' : 'Service Suspended'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, lineHeight: '1.6', margin: '0 0 32px 0' }}>
              {blockedInfo.reason}
            </p>

            <div style={{
              backgroundColor: 'var(--bg-base)', borderRadius: '24px', padding: '28px',
              border: '1px solid var(--border-rgba-05)', textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: '20px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 950, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contact Customer Care</span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={20} style={{ color: '#0ea5e9' }} />
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Phone</span>
                  <a href={`tel:${blockedInfo.phone}`} style={{color: 'var(--text-primary)', fontWeight: 900, fontSize: '16px', textDecoration: 'none' }}>{blockedInfo.phone}</a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AtSign size={20} style={{ color: '#10b981' }} />
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Email</span>
                  <a href={`mailto:${blockedInfo.email}`} style={{color: 'var(--text-primary)', fontWeight: 900, fontSize: '14px', textDecoration: 'none' }}>{blockedInfo.email}</a>
                </div>
              </div>
            </div>

            {blockedInfo.type === 'PLAN_EXPIRED' && (
              <div style={{
                backgroundColor: 'var(--bg-base)', borderRadius: '24px', padding: '24px',
                border: '1px solid var(--border-rgba-05)', textAlign: 'left',
                marginTop: '16px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 950, color: isLight ? 'var(--text-primary)' : '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Have an Activation Key?</span>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <input
                    type="text"
                    placeholder="Enter Key"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    style={{flex: 1, backgroundColor: 'var(--border-rgba-05)', border: '1px solid var(--border-rgba-1)',
                      color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', outline: 'none',
                      fontSize: '14px', fontWeight: 700, letterSpacing: '2px'
                    }}
                  />
                  <button
                    onClick={handleActivateLicense}
                    style={{
                      backgroundColor: '#0ea5e9', color: 'white', border: 'none',
                      padding: '12px 20px', borderRadius: '12px', fontWeight: 800,
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    Activate
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setBlockedInfo(null)}
              style={{
                width: '100%', marginTop: '28px', padding: '16px', borderRadius: '16px',
                backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', border: 'none',
                fontWeight: 800, fontSize: '15px', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-base)',
      zIndex: 9999,
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Theme Toggle Switcher */}
      <div style={{
        position: 'absolute',
        top: '24px',
        right: '24px',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--bg-border)',
        borderRadius: '12px',
        padding: '4px',
        gap: '4px',
        zIndex: 10000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        width: '160px'
      }}>
        <button
          type="button"
          onClick={() => setTheme('light')}
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: isLight ? 'var(--bg-card)' : 'transparent',
            color: isLight ? '#0ea5e9' : 'var(--text-muted)',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '11px',
            transition: 'all 0.2s',
            boxShadow: isLight ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
          }}
        >
          <Sun size={12} /> Light
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: !isLight ? 'var(--bg-card)' : 'transparent',
            color: !isLight ? '#38bdf8' : 'var(--text-muted)',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '11px',
            transition: 'all 0.2s',
            boxShadow: !isLight ? '0 2px 4px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          <Moon size={12} /> Dark
        </button>
      </div>

      {/* Background Decor */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '400px', height: '400px', backgroundColor: 'rgba(14, 165, 233, 0.1)', borderRadius: '50%', filter: 'blur(100px)' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '500px', height: '500px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', filter: 'blur(100px)' }}></div>
      </div>

      <div style={{ 
        width: '100%', 
        maxWidth: '440px', 
        padding: '20px',
        zIndex: 10
      }}>
        <div style={{
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '32px',
          border: '1px solid var(--border-rgba-1)',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          maxHeight: '85vh',
          overflowY: 'auto'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              borderRadius: '24px',
              marginBottom: '20px',
              boxShadow: '0 10px 20px rgba(14, 165, 233, 0.3)'
            }}>
               <UtensilsCrossed style={{color: '#ffffff' }} size={36} />
            </div>
            <h1 style={{color: 'var(--text-primary)', fontSize: '32px', fontWeight: 900, letterSpacing: '-0.05em', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
              Best<span style={{ color: '#38bdf8' }}>Bill</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              {isForgotPassword ? 'Reset Password' : isRegister ? 'New Business Registration' : 'Hotel Owner Login'}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isForgotPassword ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Username (Email)</label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input type="email" style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }} placeholder="owner@hotel.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input type="password" style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }} placeholder="••••••••" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input type="password" style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }} placeholder="••••••••" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                </div>
              </>
            ) : isRegister ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Owner Name</label>
                  <div style={{ position: 'relative' }}>
                    <LogIn style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input
                      type="text"
                      style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }}
                      placeholder="e.g. John Doe"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Hotel Name</label>
                  <div style={{ position: 'relative' }}>
                    <Store style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input
                      type="text"
                      style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }}
                      placeholder="e.g. Grand Plaza"
                      required
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Mobile Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input
                      type="tel"
                      style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }}
                      placeholder="e.g. 9876543210"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Hotel Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input
                      type="text"
                      style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }}
                      placeholder="e.g. MG Road, Pune"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {!isForgotPassword && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input
                      type="email"
                      style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }}
                      placeholder="owner@hotel.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '4px' }}>
                     <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                     {!isRegister && (
                       <button type="button" onClick={() => setIsForgotPassword(true)} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: 0 }}>Forgot Password?</button>
                     )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', top: '18px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input
                      type="password"
                      style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '16px', outline: 'none', transition: 'border-color 0.2s', fontSize: '14px', fontWeight: 600 }}
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="login-btn"
              style={{
                width: '100%',
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                padding: '16px',
                borderRadius: '16px',
                fontSize: '18px',
                fontWeight: 900,
                cursor: 'pointer',
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              {isForgotPassword ? 'Change Password' : isRegister ? <><UserPlus size={22} /> Register</> : <><LogIn size={22} /> Login</>}
               <ChevronRight size={18} />
            </button>
          </form>

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-rgba-05)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700 }}>
              {isForgotPassword ? (
                <>
                  Remember your password?{' '}
                  <button onClick={() => setIsForgotPassword(false)} style={{ color: '#38bdf8', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800, textDecoration: 'underline', paddingLeft: '4px' }}>Back to login</button>
                </>
              ) : isRegister ? (
                <>
                  Already have an account?{' '}
                  <button onClick={() => setIsRegister(false)} style={{ color: '#38bdf8', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800, textDecoration: 'underline', paddingLeft: '4px' }}>Login now</button>
                </>
              ) : (
                <>
                  {isRegistrationAllowed ? (
                    <>
                      Don't have a hotel account?{' '}
                      <button onClick={() => setIsRegister(true)} style={{ color: '#38bdf8', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800, textDecoration: 'underline', paddingLeft: '4px' }}>Register here</button>
                    </>
                  ) : (
                    <span style={{ color: '#f43f5e', fontWeight: 800 }}>Free Trial Period Expired. Activation Required.</span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
