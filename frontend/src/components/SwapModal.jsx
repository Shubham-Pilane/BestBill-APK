import { X } from 'lucide-react';

const SwapModal = ({ isOpen, onClose, tables, onSwap, currentTable }) => {
   if (!isOpen) return null;
   
   const availableTables = (tables || []).filter(t => {
      const name = String(t.table_number || '').toLowerCase();
      return !t.active_order_id && t.id !== currentTable?.id && !name.includes('parcel') && !name.includes('token');
   });
   const grouped = availableTables.reduce((acc, t) => {
      const f = t.floor || 'Floor 1';
      if (!acc[f]) acc[f] = [];
      acc[f].push(t);
      return acc;
   }, {});

   return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(16px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
         <div style={{ width: '100%', maxWidth: '600px', backgroundColor: 'var(--bg-card)', borderRadius: '32px', padding: '40px', border: '1px solid var(--border-rgba-05)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
               <h3 style={{fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Select Migration Destination</h3>
               <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
               {Object.keys(grouped).sort().map(floor => (
                  <div key={floor}>
                     <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '16px', textTransform: 'uppercase' }}>{floor}</div>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '12px' }}>
                        {grouped[floor].map(t => (
                           <button 
                              key={t.id} 
                              onClick={() => onSwap(t.id)}
                              style={{padding: '16px', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', borderRadius: '16px', color: 'var(--text-primary)', fontWeight: 900, fontSize: '18px', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = '#0ea5e9'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bg-border)'}
                           >
                              {t.table_number}
                           </button>
                        ))}
                     </div>
                  </div>
               ))}
               {availableTables.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No available migration buffers found.</div>}
            </div>
         </div>
      </div>
   );
};

export default SwapModal;
