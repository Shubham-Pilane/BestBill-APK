import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-hot-toast';
import { Plus, Utensils, Tag, IndianRupee, Layers, ListChecks, Trash2, Edit2, X, Save, Search, UploadCloud } from 'lucide-react';

const MenuManagement = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const fileInputRef = useRef(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');

  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemData, setEditItemData] = useState({});

  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category_id: '',
    description: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fetchData = async (page = 1, search = '') => {
    try {
      const [catRes, itemsRes] = await Promise.all([
        api.get('/menu/categories'),
        api.get(`/menu/items?page=${page}&limit=10&search=${encodeURIComponent(search)}`)
      ]);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setItems(itemsRes.data.items || []);
      setTotalPages(itemsRes.data.totalPages || 1);
      setCurrentPage(itemsRes.data.currentPage || 1);
    } catch (err) {
      console.error('Menu load error:', err);
      toast.error('Failed to load menu');
    }
  };

  useEffect(() => {
    fetchData(currentPage, searchTerm);
  }, [currentPage, searchTerm]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/);
      const importedItems = [];
      
      let startIdx = 0;
      if (lines.length > 0 && (lines[0].toLowerCase().includes('category') || lines[0].toLowerCase().includes('price') || lines[0].toLowerCase().includes('name'))) {
        startIdx = 1;
      }

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
        const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
        
        if (parts.length >= 3) {
          const category = parts[0];
          const name = parts[1];
          const price = parseFloat(parts[2]);
          if (category && name && !isNaN(price)) {
            importedItems.push({ category, name, price });
          }
        }
      }

      if (importedItems.length === 0) {
        toast.error('No valid menu items found in CSV file');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const loadingToast = toast.loading(`Importing ${importedItems.length} menu items...`);
      try {
        const res = await api.post('/menu/items/bulk', { items: importedItems });
        toast.success(res.data.message || `Successfully imported ${importedItems.length} items!`, { id: loadingToast });
        fetchData(1, '');
        setCurrentPage(1);
      } catch (err) {
        toast.error('Failed to import menu CSV', { id: loadingToast });
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const addCategory = async (e) => {
    e.preventDefault();
    try {
      await api.post('/menu/categories', { name: newCatName });
      setNewCatName('');
      fetchData(currentPage, searchTerm);
      toast.success('Category successfully added!');
    } catch (err) {
      toast.error('Could not add category');
    }
  };

  const deleteCategory = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Purge Group?',
      message: 'This will permanently delete this group and all its menu items. This action cannot be undone.',
      onConfirm: async () => {
        try {
          const res = await api.delete(`/menu/categories/${id}`);
          fetchData(currentPage, searchTerm);
          toast.success(res.data?.message || 'Group purged');
          setConfirmModal({ ...confirmModal, isOpen: false });
        } catch (err) {
          toast.error(err.response?.data?.message || 'Purge failed');
        }
      }
    });
  };

  const saveCategoryUpdate = async (id) => {
    try {
      await api.put(`/menu/categories/${id}`, { name: editCatName });
      setEditingCatId(null);
      fetchData(currentPage, searchTerm);
      toast.success('Category updated');
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.category_id) return toast.error('Please assign a category');
    try {
      await api.post('/menu/items', newItem);
      setNewItem({ name: '', price: '', category_id: '', description: '' });
      fetchData(1, '');
      setCurrentPage(1);
      setSearchTerm('');
      toast.success('Menu item successfully added!');
    } catch (err) {
      toast.error('Could not create item');
    }
  };

  const deleteItem = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Discard Dish?',
      message: 'Are you sure you want to remove this dish from your active menu?',
      onConfirm: async () => {
        try {
          const res = await api.delete(`/menu/items/${id}`);
          fetchData(currentPage, searchTerm);
          toast.success(res.data?.message || 'Dish removed');
          setConfirmModal({ ...confirmModal, isOpen: false });
        } catch (err) {
          toast.error(err.response?.data?.message || 'Removal failed');
        }
      }
    });
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditItemData(item);
  };

  const saveItemUpdate = async (id) => {
    try {
      await api.put(`/menu/items/${id}`, editItemData);
      setEditingItemId(null);
      fetchData(currentPage, searchTerm);
      toast.success('Item details updated');
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const deleteAllMenu = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Purge Entire Menu?',
      message: 'This will permanently delete ALL categories/groups and ALL menu items. Active tables will lose item references. This action is irreversible!',
      onConfirm: async () => {
        const loadingToast = toast.loading('Purging all menu categories and items...');
        try {
          await api.delete('/menu/purge-all');
          fetchData(1, '');
          setCurrentPage(1);
          setSearchTerm('');
          toast.success('All menu items and categories successfully deleted', { id: loadingToast });
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          toast.error(err.response?.data?.message || 'Purge failed', { id: loadingToast });
        }
      }
    });
  };

  // Smart paginator — shows: ‹ Prev  1  2  3  ...  n-1  n  Next ›
  const SmartPagination = ({ currentPage, totalPages, onPageChange, activeColor = '#6366f1' }) => {
    if (totalPages <= 1) return null;
    const getPages = () => {
      const pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
        return pages;
      }
      pages.push(1);
      if (currentPage > 4) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 3) pages.push('...');
      pages.push(totalPages);
      return pages;
    };
    const btnBase = { height: '40px', minWidth: '40px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '13px', transition: 'all 0.15s' };
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '24px', flexWrap: 'wrap' }}>
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{ ...btnBase, padding: '0 14px', backgroundColor: currentPage === 1 ? 'rgba(255,255,255,0.03)' : 'var(--bg-border)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: currentPage === 1 ? 'default' : 'pointer' }}
        >&#8249; Prev</button>
        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} style={{ color: 'var(--text-muted)', fontWeight: 800, padding: '0 4px' }}>...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{ ...btnBase, backgroundColor: currentPage === p ? activeColor : 'var(--bg-border)', color: currentPage === p ? 'white' : 'var(--text-secondary)', boxShadow: currentPage === p ? `0 4px 12px ${activeColor}55` : 'none' }}
            >{p}</button>
          )
        )}
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{ ...btnBase, padding: '0 14px', backgroundColor: currentPage === totalPages ? 'rgba(255,255,255,0.03)' : 'var(--bg-border)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: currentPage === totalPages ? 'default' : 'pointer' }}
        >Next &#8250;</button>
      </div>
    );
  };

  return (
    <div className="responsive-grid-12" style={{ width: '100%', maxWidth: '1400px' }}>
      
      {/* Category Management Column */}
      <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '32px', padding: '32px', border: '1px solid var(--border-rgba-05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
            <div style={{ width: '44px', height: '44px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Layers size={22} style={{ color: '#818cf8', margin: 'auto' }} />
            </div>
            <h2 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Groups</h2>
          </div>

          <form onSubmit={addCategory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>New Category Title</label>
              <div style={{ position: 'relative' }}>
                <Tag style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={16} />
                <input
                  type="text"
                  style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '12px 16px 12px 40px', borderRadius: '14px', outline: 'none', fontSize: '14px', fontWeight: 600 }}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" style={{width: '100%', backgroundColor: '#6366f1', color: 'var(--text-primary)', border: 'none', padding: '14px', borderRadius: '14px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Plus size={18} strokeWidth={3} /> Add
            </button>
          </form>

          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '10px', fontWeight: 950, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', borderBottom: '1px solid var(--bg-border)', paddingBottom: '8px' }}>Active Groups</h3>
            {(categories || []).map(cat => (
              <div key={cat.id} style={{padding: '14px 16px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: '14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingCatId === cat.id ? (
                  <input
                    autoFocus
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveCategoryUpdate(cat.id)}
                    style={{ background: 'none', border: 'none', outline: 'none', color: '#38bdf8', fontWeight: 900, textTransform: 'uppercase', width: '100%' }}
                  />
                ) : (
                  <span style={{ textTransform: 'uppercase' }}>{cat.name}</span>
                )}
                
                <div style={{ display: 'flex', gap: '8px' }}>
                   {editingCatId === cat.id ? (
                      <button onClick={() => saveCategoryUpdate(cat.id)} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}><Save size={16} /></button>
                   ) : (
                      <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={16} /></button>
                   )}
                   <button onClick={() => deleteCategory(cat.id)} style={{ color: '#f43f5e', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Item Management Column */}
      <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '32px', padding: '40px', border: '1px solid var(--border-rgba-05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '44px', height: '44px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Utensils size={22} style={{ color: '#10b981' }} />
              </div>
              <h2 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Add To Live Menu</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              <label style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', border: '1px solid rgba(14, 165, 233, 0.2)', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', width: '160px', justifyContent: 'center', margin: 0 }}>
                <UploadCloud size={18} /> Import CSV
                <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
              <button onClick={deleteAllMenu} type="button" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', width: '160px', justifyContent: 'center' }}>
                <Trash2 size={18} /> Delete All
              </button>
            </div>
          </div>

          <form onSubmit={addItem} style={{ gap: '24px' }} className="responsive-grid-12">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 6' }}>
              <label style={{ fontSize: '11px', fontWeight: 950, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dish Name</label>
              <input
                type="text"
                style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '14px 16px', borderRadius: '16px', outline: 'none', fontSize: '14px', fontWeight: 700 }}
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 6' }}>
              <label style={{ fontSize: '11px', fontWeight: 950, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price (₹)</label>
              <div style={{ position: 'relative' }}>
                <IndianRupee style={{ position: 'absolute', top: '15px', left: '16px', color: 'var(--text-muted)' }} size={16} />
                <input
                  type="number"
                  style={{ width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: '#10b981', padding: '14px 16px 14px 40px', borderRadius: '16px', outline: 'none', fontSize: '18px', fontWeight: 900 }}
                  value={newItem.price}
                  onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 6' }}>
              <label style={{ fontSize: '11px', fontWeight: 950, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</label>
              <select
                style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '14px 16px', borderRadius: '16px', outline: 'none', fontSize: '14px', fontWeight: 700 }}
                value={newItem.category_id}
                onChange={(e) => setNewItem({...newItem, category_id: e.target.value})}
              >
                <option value="">Choose Alignment</option>
                {(categories || []).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 6' }}>
              <label style={{ fontSize: '11px', fontWeight: 950, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</label>
              <input
                type="text"
                style={{ width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-secondary)', padding: '14px 16px', borderRadius: '16px', outline: 'none', fontSize: '14px' }}
                value={newItem.description}
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
              />
            </div>
            <button type="submit" style={{ gridColumn: 'span 12', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '18px', borderRadius: '20px', fontSize: '16px', fontWeight: 950, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Plus size={22} strokeWidth={4} /> Publish To Menu
            </button>
          </form>
        </div>

        {/* Master Menu View with Edit Capability */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <ListChecks size={20} style={{ color: 'var(--text-muted)' }} />
               <h3 style={{ fontSize: '14px', fontWeight: 950, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Current Menu Catalog</h3>
            </div>
            
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
               <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-muted)' }} size={16} />
               <input
                 type="text"
                 placeholder="Search dishes or groups..."
                 value={searchTerm}
                 onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                 style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '10px 16px 10px 42px', borderRadius: '12px', outline: 'none', fontSize: '13px', fontWeight: 700 }}
               />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(items || []).map(item => (
              <div key={item.id} style={{ 
                backgroundColor: 'var(--bg-card)', 
                border: editingItemId === item.id ? '2px solid #38bdf8' : '1px solid var(--border-rgba-05)', 
                borderRadius: '16px', 
                padding: '16px 24px', 
                display: 'flex', 
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'center', 
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                cursor: 'default'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, minWidth: '250px', flexWrap: 'wrap' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', minWidth: '120px' }}>
                      <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.1em', backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '6px', width: 'fit-content', marginBottom: '4px' }}>{item.category_name}</span>
                      {editingItemId === item.id ? (
                        <input value={editItemData.name} onChange={(e) => setEditItemData({...editItemData, name: e.target.value})} style={{background: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '8px', fontSize: '15px', fontWeight: 900, width: '200px' }} />
                      ) : (
                        <h4 style={{fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase' }}>{item.name}</h4>
                      )}
                   </div>
                   
                   <div style={{ flex: 1, padding: '0 24px' }}>
                      {editingItemId === item.id ? (
                        <textarea value={editItemData.description} onChange={(e) => setEditItemData({...editItemData, description: e.target.value})} style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '8px', fontSize: '12px', minHeight: '40px' }} />
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>{item.description || 'No description provided'}</p>
                      )}
                   </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                   <div style={{ textAlign: 'right', minWidth: '80px' }}>
                      {editingItemId === item.id ? (
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '8px', top: '6px', color: '#10b981', fontSize: '14px', fontWeight: 900 }}>₹</span>
                          <input type="number" value={editItemData.price} onChange={(e) => setEditItemData({...editItemData, price: e.target.value})} style={{ background: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: '#10b981', padding: '4px 8px 4px 20px', borderRadius: '8px', fontSize: '16px', fontWeight: 900, width: '90px' }} />
                        </div>
                      ) : (
                        <span style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>₹{item.price}</span>
                      )}
                   </div>

                   <div style={{ display: 'flex', gap: '10px', borderLeft: '1px solid var(--border-rgba-05)', paddingLeft: '24px' }}>
                      {editingItemId === item.id ? (
                        <>
                          <button onClick={() => setEditingItemId(null)} style={{ padding: '8px', color: 'var(--text-muted)', background: 'rgba(100, 116, 139, 0.1)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}><X size={18} /></button>
                          <button onClick={() => saveItemUpdate(item.id)} style={{ padding: '8px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}><Save size={18} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditItem(item)} style={{ padding: '8px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '10px' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(100, 116, 139, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Edit2 size={18} /></button>
                          <button onClick={() => deleteItem(item.id)} style={{ padding: '8px', color: '#f43f5e', background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '10px' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Trash2 size={18} /></button>
                        </>
                      )}
                   </div>
                 </div>
              </div>
            ))}
          </div>

          {/* Pagination Bar */}
          <SmartPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
};

export default MenuManagement;
