import { X, AlertTriangle } from 'lucide-react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Delete Permanently', type = 'danger' }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(2, 6, 23, 0.9)',
      backdropFilter: 'blur(32px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5000,
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '32px',
        border: '1px solid var(--border-rgba-05)',
        padding: '40px',
        boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: type === 'danger' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(14, 165, 233, 0.1)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          border: type === 'danger' ? '1px solid rgba(244, 63, 94, 0.2)' : '1px solid rgba(14, 165, 233, 0.2)'
        }}>
           <AlertTriangle size={32} style={{ color: type === 'danger' ? '#f43f5e' : '#0ea5e9' }} />
        </div>

        <h3 style={{fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>{title}</h3>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 32px 0', lineHeight: '1.6' }}>{message}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
           <button
             onClick={onConfirm}
             style={{width: '100%',
               backgroundColor: type === 'danger' ? '#f43f5e' : '#0ea5e9',
               color: 'var(--text-primary)',
               border: 'none',
               padding: '16px',
               borderRadius: '16px',
               fontSize: '15px',
               fontWeight: 900,
               cursor: 'pointer',
               boxShadow: type === 'danger' ? '0 8px 16px rgba(244, 63, 94, 0.2)' : '0 8px 16px rgba(14, 165, 233, 0.2)',
               transition: 'all 0.2s'
             }}
             onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
             onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
           >
             {confirmText}
           </button>
           <button
             onClick={onCancel}
             style={{
               width: '100%',
               background: 'none',
               border: 'none',
               color: 'var(--text-muted)',
               padding: '12px',
               fontSize: '14px',
               fontWeight: 800,
               cursor: 'pointer',
               textDecoration: 'underline'
             }}
           >
             Dismiss Request
           </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
