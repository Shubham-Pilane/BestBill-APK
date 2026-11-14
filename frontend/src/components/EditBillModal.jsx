import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { X, Plus, Minus, Trash2, Printer, Save, Search, Receipt, Edit2, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const safeDate = (dateString) => {
  if (!dateString) return new Date();
  const safeStr = typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString;
  return new Date(safeStr);
};

const EditBillModal = ({ bill, onClose, onBillUpdated }) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);
  const [mobileTab, setMobileTab] = useState('items'); // 'items' | 'menu'

  const [categories, setCategories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMenu, setLoadingMenu] = useState(true);

  const [editItems, setEditItems] = useState(() =>
    (bill?.items || []).map((item, idx) => ({
      _uid: item.id ? `oi-${item.id}` : `init-${idx}-${Date.now()}`,
      menu_item_id: item.menu_item_id || null,
      name: item.name || 'Other',
      marathi_name: item.marathi_name || '',
      price: item.price !== undefined && item.price !== null ? Number(item.price) : 0,
      quantity: item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 1,
      is_manual: Boolean(item.is_manual || !item.menu_item_id)
    }))
  );
  const [discount, setDiscount] = useState(
    bill?.discount_percentage !== undefined && bill?.discount_percentage !== null
      ? String(bill.discount_percentage)
      : '0'
  );
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  const isMarathi = language === 'mr' || user?.app_language === 'mr';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const [catRes, itemsRes] = await Promise.all([
          api.get('/menu/categories'),
          api.get('/menu/items')
        ]);
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        setAllItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
      } catch (err) {
        console.error('Failed to load menu for Edit Bill:', err);
        toast.error('Failed to load menu items');
      } finally {
        setLoadingMenu(false);
      }
    };
    fetchMenu();
  }, []);

  useEffect(() => {
    if (!bill) return;
    setEditItems(
      (bill.items || []).map((item, idx) => ({
        _uid: item.id ? `oi-${item.id}` : `init-${idx}-${Date.now()}`,
        menu_item_id: item.menu_item_id || null,
        name: item.name || 'Other',
        marathi_name: item.marathi_name || '',
        price: item.price !== undefined && item.price !== null ? Number(item.price) : 0,
        quantity: item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 1,
        is_manual: Boolean(item.is_manual || !item.menu_item_id)
      }))
    );
    setDiscount(
      bill.discount_percentage !== undefined && bill.discount_percentage !== null
        ? String(bill.discount_percentage)
        : '0'
    );
  }, [bill?.id]);

  // Filter & paginate menu items
  const { pagedItems, totalPages, suggestions } = useMemo(() => {
    let filtered = [...allItems].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(i => String(i.category_id) === String(selectedCategory));
    }

    if (searchQuery.trim().length > 0) {
      const rawLower = searchQuery.toLowerCase();
      const compactQuery = rawLower.replace(/\s/g, '');
      filtered = filtered.filter(i => {
        const name = (i.name || '').toLowerCase();
        const marathiName = (i.marathi_name || '').toLowerCase();
        const categoryName = (i.category_name || '').toLowerCase();
        if (name.includes(rawLower) || marathiName.includes(rawLower) || categoryName.includes(rawLower)) {
          return true;
        }
        const matchesSubseq = (str) => {
          let idx = 0;
          for (const ch of str) {
            if (ch === compactQuery[idx]) idx++;
            if (idx === compactQuery.length) return true;
          }
          return false;
        };
        return matchesSubseq(name) || matchesSubseq(marathiName) || matchesSubseq(categoryName);
      });
    }

    const pages = Math.ceil(filtered.length / 10) || 1;
    const safePage = Math.min(currentPage, pages);
    const startIdx = (safePage - 1) * 10;
    return {
      pagedItems: filtered.slice(startIdx, startIdx + 10),
      totalPages: pages,
      suggestions: searchQuery.trim().length > 0 ? filtered : []
    };
  }, [allItems, selectedCategory, searchQuery, currentPage]);

  // Totals recalculation
  const totals = useMemo(() => {
    const subtotal = Number(
      editItems
        .reduce((sum, item) => {
          const price = Math.max(0, parseFloat(item.price) || 0);
          const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
          return sum + price * qty;
        }, 0)
        .toFixed(2)
    );
    const gstRate = bill?.effective_gst_percentage !== undefined
      ? Number(bill.effective_gst_percentage)
      : Number(bill?.gst_percentage || user?.gst_percentage || 0);
    const gstAmount = Number((subtotal * (gstRate / 100)).toFixed(2));

    const cgstRate = bill?.effective_cgst_percentage !== undefined
      ? Number(bill.effective_cgst_percentage)
      : Number(bill?.cgst_percentage || user?.cgst_percentage || 0);
    const cgstAmount = Number((subtotal * (cgstRate / 100)).toFixed(2));

    const sgstRate = bill?.effective_sgst_percentage !== undefined
      ? Number(bill.effective_sgst_percentage)
      : Number(bill?.sgst_percentage || user?.sgst_percentage || 0);
    const sgstAmount = Number((subtotal * (sgstRate / 100)).toFixed(2));

    const preDiscount = subtotal + gstAmount + cgstAmount + sgstAmount;
    const discountPct = Math.max(0, Math.min(100, parseFloat(discount) || 0));
    const discountAmount = Number((preDiscount * (discountPct / 100)).toFixed(2));
    const unroundedTotal = Math.max(0, Number((preDiscount - discountAmount).toFixed(2)));
    const grandTotal = Math.ceil(unroundedTotal);
    let roundOff = Number((grandTotal - unroundedTotal).toFixed(2));
    if (roundOff < 0.001 || roundOff >= 1) {
      roundOff = 0;
    }

    return {
      subtotal,
      gstRate,
      gstAmount,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      discountPct,
      discountAmount,
      roundOff,
      grandTotal
    };
  }, [editItems, discount, bill, user?.gst_percentage, user?.cgst_percentage, user?.sgst_percentage]);

  const getDisplayName = (item) => {
    if (isMarathi) {
      return item.marathi_name || allItems.find(a => a.id === item.menu_item_id || a.name === item.name)?.marathi_name || item.name;
    }
    return item.name;
  };

  const addMenuItemToBill = (menuItem) => {
    setEditItems(prev => {
      const existingIdx = prev.findIndex(i => !i.is_manual && Number(i.menu_item_id) === Number(menuItem.id));
      if (existingIdx !== -1) {
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: (parseInt(item.quantity, 10) || 0) + 1 } : item
        );
      }
      return [
        ...prev,
        {
          _uid: `menu-${menuItem.id}-${Date.now()}`,
          menu_item_id: menuItem.id,
          name: menuItem.name,
          marathi_name: menuItem.marathi_name || '',
          price: Number(menuItem.price || 0),
          quantity: 1,
          is_manual: false
        }
      ];
    });
    toast.success(`+ ${isMarathi && menuItem.marathi_name ? menuItem.marathi_name : menuItem.name}`, {
      id: `edit-add-${menuItem.id}`
    });
  };

  const addManualItemToBill = () => {
    setEditItems(prev => [
      ...prev,
      {
        _uid: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menu_item_id: null,
        name: 'Other',
        marathi_name: '',
        price: 0,
        quantity: 1,
        is_manual: true
      }
    ]);
    if (isMobile) setMobileTab('items');
  };

  const updateItemQuantity = (uid, delta) => {
    setEditItems(prev => {
      const target = prev.find(i => i._uid === uid);
      if (!target) return prev;
      const nextQty = (parseInt(target.quantity, 10) || 0) + delta;
      if (nextQty < 1) {
        return prev.filter(i => i._uid !== uid);
      }
      return prev.map(i => (i._uid === uid ? { ...i, quantity: nextQty } : i));
    });
  };

  const handleQtyInputChange = (uid, rawVal) => {
    if (rawVal === '') {
      setEditItems(prev => prev.map(i => (i._uid === uid ? { ...i, quantity: '' } : i)));
      return;
    }
    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setEditItems(prev => prev.map(i => (i._uid === uid ? { ...i, quantity: parsed } : i)));
    }
  };

  const handleQtyInputBlur = (uid) => {
    setEditItems(prev =>
      prev.map(i => {
        if (i._uid !== uid) return i;
        const parsed = parseInt(i.quantity, 10);
        return { ...i, quantity: !parsed || parsed < 1 ? 1 : parsed };
      })
    );
  };

  const handlePriceInputChange = (uid, rawVal) => {
    if (rawVal === '') {
      setEditItems(prev => prev.map(i => (i._uid === uid ? { ...i, price: '' } : i)));
      return;
    }
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed >= 0) {
      setEditItems(prev => prev.map(i => (i._uid === uid ? { ...i, price: rawVal } : i)));
    }
  };

  const handlePriceInputBlur = (uid) => {
    setEditItems(prev =>
      prev.map(i => {
        if (i._uid !== uid) return i;
        const parsed = parseFloat(i.price);
        return { ...i, price: isNaN(parsed) || parsed < 0 ? 0 : parsed };
      })
    );
  };

  const handleNameInputChange = (uid, newName) => {
    setEditItems(prev => prev.map(i => (i._uid === uid ? { ...i, name: newName } : i)));
  };

  const removeItemFromBill = (uid) => {
    setEditItems(prev => prev.filter(i => i._uid !== uid));
  };

  const buildPayload = () => {
    const cleanItems = editItems
      .map(item => ({
        menu_item_id: item.is_manual ? null : item.menu_item_id,
        name: String(item.name || 'Other').trim() || 'Other',
        price: Math.max(0, parseFloat(item.price) || 0),
        quantity: parseInt(item.quantity, 10) || 0,
        is_manual: Boolean(item.is_manual)
      }))
      .filter(item => item.quantity > 0);

    if (cleanItems.length === 0) {
      toast.error(t('bill_must_have_item', 'Bill must contain at least one item'));
      return null;
    }

    return {
      items: cleanItems,
      discount_percentage: totals.discountPct
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      const res = await api.put(`/bills/${bill.id}`, payload);
      if (onBillUpdated) onBillUpdated(res.data);
      toast.success(t('bill_updated_success', 'Bill updated successfully!'));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update bill');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPrint = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setPrinting(true);
    try {
      const res = await api.put(`/bills/${bill.id}`, payload);
      if (onBillUpdated) onBillUpdated(res.data);

      try {
        await api.post(`/bills/${bill.id}/print`);
        toast.success(t('bill_updated_and_printed', 'Updated bill saved & sent to printer!'));
      } catch (printErr) {
        toast.error(printErr.response?.data?.message || 'Bill saved, but failed to trigger print');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update bill');
    } finally {
      setPrinting(false);
    }
  };

  const totalItemCount = editItems.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(10px)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : '20px'
      }}
    >
      <div
        style={{
          width: isMobile ? '100vw' : '100%',
          ...(isMobile ? {} : { maxWidth: '1280px' }),
          height: isMobile ? '100dvh' : '90vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: isMobile ? 0 : '32px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          border: isMobile ? 'none' : '1px solid var(--bg-border)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: isMobile ? 'max(12px, env(safe-area-inset-top, 12px)) 14px 12px' : '18px 28px',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                minWidth: isMobile ? '42px' : '52px',
                height: isMobile ? '42px' : '52px',
                padding: '0 10px',
                borderRadius: '14px',
                backgroundColor: '#0ea5e9',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 950,
                fontSize: isMobile ? '14px' : '18px',
                flexShrink: 0
              }}
            >
              #{bill.id}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: isMobile ? '16px' : '22px',
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                <span>{t('edit_bill', 'Edit Bill')} #{bill.id}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 800,
                    backgroundColor: bill.is_paid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                    color: bill.is_paid ? '#10b981' : '#f43f5e'
                  }}
                >
                  {bill.is_paid ? t('paid', 'PAID') : t('pending', 'UNPAID')}
                </span>
              </h2>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {bill.table_number} • {safeDate(bill.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-border)',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile Tab Bar */}
        {isMobile && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-base)',
              borderBottom: '1px solid var(--bg-border)',
              flexShrink: 0
            }}
          >
            <button
              onClick={() => setMobileTab('items')}
              style={{
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                fontWeight: 900,
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: mobileTab === 'items' ? '#0ea5e9' : 'var(--bg-card)',
                color: mobileTab === 'items' ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              {t('bill_items', 'Bill Items')} ({editItems.length})
            </button>
            <button
              onClick={() => setMobileTab('menu')}
              style={{
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                fontWeight: 900,
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: mobileTab === 'menu' ? '#0ea5e9' : 'var(--bg-card)',
                color: mobileTab === 'menu' ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              + {t('add_items', 'Add Items')}
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Left Panel: Menu Browser */}
          {(!isMobile || mobileTab === 'menu') && (
            <div
              style={{
                flex: 1,
                borderRight: isMobile ? 'none' : '1px solid var(--bg-border)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minWidth: 0,
                backgroundColor: 'var(--bg-base)'
              }}
            >
              {/* Search & Categories */}
              <div
                style={{
                  padding: isMobile ? '12px 14px' : '16px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: 'var(--bg-card)',
                  borderBottom: '1px solid var(--bg-border)'
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                      size={16}
                      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      placeholder={t('search_menu', 'Search Menu...')}
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{
                        width: '100%',
                        padding: '11px 38px 11px 40px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-base)',
                        border: '1px solid var(--bg-border)',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        outline: 'none',
                        fontSize: '14px'
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 0
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}

                    {/* Suggestions Dropdown */}
                    {suggestions.length > 0 && (
                      <div
                        className="search-suggestions-scrollbar"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: '14px',
                          marginTop: '6px',
                          boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
                          zIndex: 100,
                          border: '1px solid var(--bg-border)',
                          overflowY: 'auto',
                          maxHeight: '250px'
                        }}
                      >
                        {suggestions.map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              addMenuItemToBill(s);
                              setSearchQuery('');
                            }}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--bg-border)',
                              color: 'var(--text-primary)',
                              fontWeight: 800,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Plus size={14} color="#0ea5e9" />
                              <span>{isMarathi && s.marathi_name ? s.marathi_name : s.name}</span>
                            </div>
                            <span style={{ color: '#10b981' }}>₹{s.price}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isMobile && (
                    <button
                      onClick={addManualItemToBill}
                      style={{
                        padding: '11px 12px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        color: '#10b981',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Plus size={14} /> Manual
                    </button>
                  )}
                </div>

                {/* Categories */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '12px',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      backgroundColor: selectedCategory === 'all' ? '#0ea5e9' : 'var(--bg-border)',
                      color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-primary)'
                    }}
                  >
                    {t('all_items', 'ALL ITEMS')}
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setCurrentPage(1);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '12px',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '11px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        backgroundColor: String(selectedCategory) === String(cat.id) ? '#0ea5e9' : 'var(--bg-border)',
                        color: String(selectedCategory) === String(cat.id) ? '#ffffff' : 'var(--text-primary)'
                      }}
                    >
                      {isMarathi && cat.marathi_name ? cat.marathi_name : String(cat.name || '').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Items List */}
              <div
                style={{
                  flex: 1,
                  padding: isMobile ? '12px 14px 84px' : '20px 28px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {loadingMenu ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Loading menu...
                  </div>
                ) : pagedItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {t('no_items', 'No items found')}
                  </div>
                ) : (
                  pagedItems.map(item => {
                    const existingInBill = editItems.find(i => !i.is_manual && Number(i.menu_item_id) === Number(item.id));
                    const inBillQty = existingInBill ? parseInt(existingInBill.quantity, 10) || 0 : 0;

                    return (
                      <div
                        key={item.id}
                        onClick={() => addMenuItemToBill(item)}
                        style={{
                          backgroundColor: inBillQty > 0 ? 'rgba(14, 165, 233, 0.08)' : 'var(--bg-card)',
                          border: inBillQty > 0 ? '1px solid #0ea5e9' : '1px solid var(--bg-border)',
                          padding: isMobile ? '12px 14px' : '14px 20px',
                          borderRadius: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: isMobile ? '14px' : '15px',
                                fontWeight: 900,
                                color: 'var(--text-primary)',
                                textTransform: 'uppercase'
                              }}
                            >
                              {isMarathi && item.marathi_name ? item.marathi_name : item.name}
                            </span>
                            {item.category_name && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--text-muted)',
                                  fontWeight: 800,
                                  backgroundColor: 'rgba(100, 116, 139, 0.12)',
                                  padding: '2px 8px',
                                  borderRadius: '6px'
                                }}
                              >
                                {(isMarathi && item.marathi_category ? item.marathi_category : item.category_name).toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <span style={{ color: '#10b981', fontSize: '16px', fontWeight: 900 }}>₹{item.price}</span>
                          {inBillQty > 0 ? (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                backgroundColor: '#0ea5e9',
                                borderRadius: '10px',
                                padding: '4px 8px'
                              }}
                            >
                              <button
                                onClick={() => updateItemQuantity(existingInBill._uid, -1)}
                                style={{ border: 'none', background: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', padding: '2px' }}
                              >
                                <Minus size={14} />
                              </button>
                              <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '13px', minWidth: '16px', textAlign: 'center' }}>
                                {inBillQty}
                              </span>
                              <button
                                onClick={() => addMenuItemToBill(item)}
                                style={{ border: 'none', background: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', padding: '2px' }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <div
                              style={{
                                padding: '6px 12px',
                                borderRadius: '10px',
                                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                                border: '1px solid #0ea5e9',
                                color: '#0ea5e9',
                                fontWeight: 900,
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Plus size={14} /> {t('add_btn', 'ADD')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--bg-border)',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                        fontSize: '12px',
                        opacity: currentPage === 1 ? 0.4 : 1,
                        cursor: currentPage === 1 ? 'default' : 'pointer'
                      }}
                    >
                      {t('prev', 'Prev')}
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--bg-border)',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                        fontSize: '12px',
                        opacity: currentPage === totalPages ? 0.4 : 1,
                        cursor: currentPage === totalPages ? 'default' : 'pointer'
                      }}
                    >
                      {t('next', 'Next')}
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Floating Bar to Jump Back to Bill Items */}
              {isMobile && (
                <div
                  onClick={() => setMobileTab('items')}
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: '14px',
                    right: '14px',
                    backgroundColor: '#0ea5e9',
                    color: '#ffffff',
                    borderRadius: '16px',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 30px rgba(14, 165, 233, 0.45)',
                    cursor: 'pointer',
                    zIndex: 30
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, opacity: 0.85, textTransform: 'uppercase' }}>
                      {totalItemCount} {t('items_added', 'Items')}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 950 }}>₹{totals.grandTotal.toFixed(2)}</div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '8px 14px', borderRadius: '10px', fontWeight: 900, fontSize: '12px' }}>
                    {t('view_bill_items', 'View Bill & Print')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Panel: Editable Bill Items & Totals */}
          {(!isMobile || mobileTab === 'items') && (
            <div
              style={{
                width: isMobile ? '100%' : '450px',
                backgroundColor: 'var(--bg-base)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0
              }}
            >
              {/* Cart Header */}
              <div
                style={{
                  padding: isMobile ? '10px 14px' : '14px 18px',
                  borderBottom: '1px solid var(--bg-border)',
                  backgroundColor: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} color="#0ea5e9" />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {t('bill_items', 'Bill Items')} ({editItems.length})
                  </h3>
                </div>
                <button
                  onClick={addManualItemToBill}
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10b981',
                    color: '#10b981',
                    padding: '6px 10px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <PlusCircle size={14} /> {t('add_manual_item', 'Add Manual Item')}
                </button>
              </div>

              {/* Editable Items List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  minHeight: 0
                }}
              >
                {editItems.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px 16px',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      fontWeight: 700,
                      border: '1px dashed var(--bg-border)',
                      borderRadius: '14px'
                    }}
                  >
                    {isMobile
                      ? 'No items in bill. Tap "+ Add Items" tab above to add items.'
                      : 'No items in bill. Select items from the menu on the left or click "Add Manual Item".'}
                  </div>
                ) : (
                  editItems.map(item => {
                    const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 0);
                    return (
                      <div
                        key={item._uid}
                        style={{
                          padding: '12px',
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: '14px',
                          border: '1px solid var(--bg-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        {/* Top row: Item Name + Remove Button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          {item.is_manual ? (
                            <input
                              type="text"
                              value={item.name}
                              onChange={e => handleNameInputChange(item._uid, e.target.value)}
                              placeholder="Item name"
                              style={{
                                flex: 1,
                                backgroundColor: 'var(--bg-base)',
                                border: '1px solid #0ea5e9',
                                color: 'var(--text-primary)',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                fontSize: '13px',
                                fontWeight: 800,
                                outline: 'none'
                              }}
                            />
                          ) : (
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  color: 'var(--text-primary)',
                                  fontWeight: 800,
                                  fontSize: '14px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {getDisplayName(item)}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => removeItemFromBill(item._uid)}
                            title={t('remove_item', 'Remove item')}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: 'rgba(244, 63, 94, 0.12)',
                              color: '#f43f5e',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Bottom row: Editable Price + Quantity Stepper + Line Total */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          {/* Price Input */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.price}
                              onChange={e => handlePriceInputChange(item._uid, e.target.value)}
                              onBlur={() => handlePriceInputBlur(item._uid)}
                              title="Edit item unit price"
                              style={{
                                width: isMobile ? '82px' : '74px',
                                padding: '5px 8px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-base)',
                                border: '1px solid var(--bg-border)',
                                color: '#10b981',
                                fontWeight: 900,
                                fontSize: '13px',
                                outline: 'none'
                              }}
                            />
                            <Edit2 size={11} color="var(--text-muted)" />
                          </div>

                          {/* Quantity Controls */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'var(--bg-base)',
                              border: '1px solid var(--bg-border)',
                              borderRadius: '10px',
                              padding: '3px'
                            }}
                          >
                            <button
                              onClick={() => updateItemQuantity(item._uid, -1)}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: 'var(--bg-border)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Minus size={13} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleQtyInputChange(item._uid, e.target.value)}
                              onBlur={() => handleQtyInputBlur(item._uid)}
                              style={{
                                width: isMobile ? '46px' : '38px',
                                textAlign: 'center',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                fontWeight: 900,
                                fontSize: '13px',
                                outline: 'none'
                              }}
                            />
                            <button
                              onClick={() => updateItemQuantity(item._uid, 1)}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#0ea5e9',
                                color: '#ffffff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          {/* Line Total */}
                          <div style={{ fontWeight: 900, fontSize: '14px', color: 'var(--text-primary)', minWidth: '66px', textAlign: 'right' }}>
                            ₹{lineTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Totals & Actions Footer */}
              <div
                style={{
                  padding: isMobile ? '12px 14px max(14px, env(safe-area-inset-bottom, 14px))' : '16px 20px',
                  backgroundColor: 'var(--bg-card)',
                  borderTop: '1px solid var(--bg-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                  <span>{t('subtotal', 'Subtotal')}</span>
                  <span style={{ color: 'var(--text-primary)' }}>₹{totals.subtotal.toFixed(2)}</span>
                </div>

                {totals.gstRate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    <span>
                      {t('gst', 'GST')} ({totals.gstRate}%)
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>₹{totals.gstAmount.toFixed(2)}</span>
                  </div>
                )}

                {totals.cgstRate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    <span>
                      {t('cgst', 'CGST')} ({totals.cgstRate}%)
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>₹{totals.cgstAmount.toFixed(2)}</span>
                  </div>
                )}

                {totals.sgstRate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    <span>
                      {t('sgst', 'SGST')} ({totals.sgstRate}%)
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>₹{totals.sgstAmount.toFixed(2)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                  <span>{t('loyalty_discount', 'Discount (%)')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {totals.discountAmount > 0 && (
                      <span style={{ color: '#f59e0b', fontWeight: 800 }}>-₹{totals.discountAmount.toFixed(2)}</span>
                    )}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discount}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === '') setDiscount('');
                        else setDiscount(String(Math.max(0, Math.min(100, Number(v) || 0))));
                      }}
                      style={{
                        width: '64px',
                        padding: '4px 6px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-base)',
                        border: '1px solid var(--bg-border)',
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {totals.roundOff > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    <span>{t('round_off', 'Round Off')}</span>
                    <span style={{ color: '#10b981', fontWeight: 900 }}>+₹{totals.roundOff.toFixed(2)}</span>
                  </div>
                )}

                <div style={{ height: '1px', backgroundColor: 'var(--bg-border)', margin: '2px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)' }}>{t('grand_total', 'Grand Total')}</span>
                  <span style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 1000, color: '#10b981' }}>₹{totals.grandTotal.toFixed(2)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                  <button
                    disabled={saving || printing || editItems.length === 0}
                    onClick={handleSave}
                    style={{
                      padding: '13px 10px',
                      borderRadius: '12px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: saving || printing ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      opacity: editItems.length === 0 ? 0.45 : 1
                    }}
                  >
                    <Save size={16} />
                    {saving ? t('saving', 'Saving...') : t('save_changes', 'Save Changes')}
                  </button>

                  <button
                    disabled={saving || printing || editItems.length === 0}
                    onClick={handleSaveAndPrint}
                    style={{
                      padding: '13px 10px',
                      borderRadius: '12px',
                      backgroundColor: '#0ea5e9',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: saving || printing ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      opacity: editItems.length === 0 ? 0.45 : 1
                    }}
                  >
                    <Printer size={16} />
                    {printing ? 'Printing...' : t('print', 'Print')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditBillModal;

