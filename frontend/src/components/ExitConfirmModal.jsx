import { LogOut } from 'lucide-react';

const ExitConfirmModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(2, 6, 23, 0.85)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '24px',
        border: '1px solid var(--bg-border)',
        padding: '28px 24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        textAlign: 'center',
        color: 'var(--text-primary)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
           <LogOut size={28} style={{ color: '#ef4444' }} />
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-0.02em' }}>
          Exit Application?
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600, margin: '0 0 24px 0', lineHeight: '1.5' }}>
          Are you sure you want to exit the application?
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-base)',
              color: 'var(--text-primary)',
              border: '1px solid var(--bg-border)',
              padding: '14px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              padding: '14px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitConfirmModal;
