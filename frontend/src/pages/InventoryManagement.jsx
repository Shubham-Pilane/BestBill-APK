import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  Boxes, 
  Package, 
  ListCollapse, 
  PlusCircle, 
  AlertCircle, 
  Search,
  Check, 
  X, 
  Trash2,
  Sliders,
  DollarSign,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  FileText
} from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

if (pdfFonts && pdfFonts.pdfMake) {
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
}

const InventoryManagement = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState('overview');
    
    // Core data states
    const [items, setItems] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search and Pagination States
    const [itemSearchQuery, setItemSearchQuery] = useState('');
    const [itemCurrentPage, setItemCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [menuSearchQuery, setMenuSearchQuery] = useState('');
    const [menuCurrentPage, setMenuCurrentPage] = useState(1);
    const menuItemsPerPage = 10;

    // Dashboard metrics
    const [metrics, setMetrics] = useState({
        totalItems: 0,
        lowStockItems: 0,
        inventoryValue: 0
    });

    // Modals
    const [showItemModal, setShowItemModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [showRecipeModal, setShowRecipeModal] = useState(false);

    // Add/Edit Item Form State
    const [editingItem, setEditingItem] = useState(null);
    const [itemName, setItemName] = useState('');
    const [itemUnit, setItemUnit] = useState('KG');
    const [itemStock, setItemStock] = useState('');
    const [itemMinStock, setItemMinStock] = useState('');
    const [itemRate, setItemRate] = useState('');

    // Adjust Stock Form State
    const [selectedAdjustItemId, setSelectedAdjustItemId] = useState('');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustRemarks, setAdjustRemarks] = useState('');
    const [showValuationModal, setShowValuationModal] = useState(false);

    // Recipe Form State
    const [selectedMenuItem, setSelectedMenuItem] = useState(null);
    const [recipeIngredients, setRecipeIngredients] = useState([]); // Array of { inventory_item_id, quantity_required, unit }

    // Init & Refresh
    const fetchData = async () => {
        try {
            setLoading(true);
            const [itemsRes, menuRes, recipesRes, metricsRes] = await Promise.all([
                api.get('/inventory/items'),
                api.get('/menu/items'),
                api.get('/inventory/recipes'),
                api.get('/inventory/dashboard')
            ]);
            setItems(itemsRes.data || []);
            setMenuItems(menuRes.data || []);
            setRecipes(recipesRes.data || []);
            setMetrics(metricsRes.data || { totalItems: 0, lowStockItems: 0, inventoryValue: 0 });
        } catch (err) {
            console.error('Failed to load inventory data:', err);
            toast.error('Could not fetch inventory records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- REPORTING & TRANSACTIONS STATE ---
    const [transactions, setTransactions] = useState([]);
    const [txLoading, setTxLoading] = useState(false);
    const [txDateFilter, setTxDateFilter] = useState('Today'); // 'Today', 'CurrentMonth', 'LastMonth', 'ThisYear', 'Custom'
    const [txCustomStart, setTxCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [txCustomEnd, setTxCustomEnd] = useState(new Date().toISOString().split('T')[0]);
    const [txTypeFilter, setTxTypeFilter] = useState('ALL'); // 'ALL', 'SALE', 'PURCHASE', 'ADJUSTMENT', 'WASTAGE'
    const [txItemFilter, setTxItemFilter] = useState('ALL'); // 'ALL' or specific itemId
    const [txCurrentPage, setTxCurrentPage] = useState(1);
    const txPerPage = 15;

    const getDateRange = (option, customStart, customEnd) => {
        const now = new Date();
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (option === 'Today') {
            const todayStr = formatDate(now);
            return { start: todayStr, end: todayStr };
        } else if (option === 'CurrentMonth') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return { start: formatDate(firstDay), end: formatDate(lastDay) };
        } else if (option === 'LastMonth') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start: formatDate(firstDay), end: formatDate(lastDay) };
        } else if (option === 'ThisYear') {
            const firstDay = new Date(now.getFullYear(), 0, 1);
            const lastDay = new Date(now.getFullYear(), 11, 31);
            return { start: formatDate(firstDay), end: formatDate(lastDay) };
        } else if (option === 'Custom') {
            return { start: customStart, end: customEnd };
        }
        return { start: '', end: '' };
    };

    const fetchTransactions = async () => {
        try {
            setTxLoading(true);
            const { start, end } = getDateRange(txDateFilter, txCustomStart, txCustomEnd);
            
            const params = {};
            if (start) params.startDate = start;
            if (end) params.endDate = end;
            if (txTypeFilter !== 'ALL') params.type = txTypeFilter;
            if (txItemFilter !== 'ALL') params.itemId = txItemFilter;

            const res = await api.get('/inventory/reports/transactions', { params });
            setTransactions(res.data || []);
            setTxCurrentPage(1);
        } catch (err) {
            console.error('Failed to load transaction reports:', err);
            toast.error('Could not fetch inventory transactions');
        } finally {
            setTxLoading(false);
        }
    };

    const exportPDF = () => {
        const { start, end } = getDateRange(txDateFilter, txCustomStart, txCustomEnd);
        let datePeriodText = '';
        if (txDateFilter === 'Today') {
            datePeriodText = `Date: ${new Date(start).toLocaleDateString()}`;
        } else if (txDateFilter === 'CurrentMonth') {
            datePeriodText = `Period: Current Month (${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()})`;
        } else if (txDateFilter === 'LastMonth') {
            datePeriodText = `Period: Last Month (${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()})`;
        } else if (txDateFilter === 'ThisYear') {
            datePeriodText = `Period: Year ${new Date(start).getFullYear()}`;
        } else {
            datePeriodText = `Period: ${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()}`;
        }

        const tableBody = [
            [
                { text: 'Date & Time', style: 'tableHeader' },
                { text: 'Ingredient', style: 'tableHeader' },
                { text: 'Type', style: 'tableHeader' },
                { text: 'Quantity Changed', style: 'tableHeader' },
                { text: 'Remarks / Reference', style: 'tableHeader' }
            ]
        ];

        transactions.forEach(tx => {
            const formattedDate = new Date(tx.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            const prefix = tx.quantity > 0 ? '+' : '';
            const qtyText = `${prefix}${tx.quantity} ${tx.unit}`;
            
            tableBody.push([
                formattedDate,
                tx.item_name,
                tx.type,
                qtyText,
                tx.remarks || '-'
            ]);
        });

        const docDefinition = {
            content: [
                { text: (user?.hotel_name || 'BESTBILL').toUpperCase(), style: 'header', alignment: 'center' },
                { text: user?.hotel_location || 'Address not available', alignment: 'center', margin: [0, 0, 0, 5] },
                { text: `Mobile: ${user?.hotel_phone || 'N/A'}`, alignment: 'center' },
                user?.fssai_number ? { text: `FSSAI: ${user.fssai_number}`, alignment: 'center' } : {},
                { text: 'Inventory Ledger & Transaction Report', style: 'subheader', alignment: 'center', margin: [0, 15, 0, 10] },
                { text: datePeriodText, alignment: 'center', margin: [0, 0, 0, 15], bold: true },
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto', '*'],
                        body: tableBody
                    },
                    layout: 'lightHorizontalLines'
                }
            ],
            styles: {
                header: { fontSize: 20, bold: true },
                subheader: { fontSize: 14, bold: true },
                tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#eeeeee' }
            },
            defaultStyle: { fontSize: 9 }
        };

        pdfMake.createPdf(docDefinition).download(`Inventory_Ledger_Report_${start}_to_${end}.pdf`);
    };

    useEffect(() => {
        if (tab === 'reports') {
            fetchTransactions();
        }
    }, [tab, txDateFilter, txCustomStart, txCustomEnd, txTypeFilter, txItemFilter]);

    const txSummary = useMemo(() => {
        let inflow = 0;
        let outflow = 0;
        transactions.forEach(tx => {
            const qty = parseFloat(tx.quantity);
            if (qty > 0) {
                inflow += qty;
            } else {
                outflow += Math.abs(qty);
            }
        });
        return {
            inflow,
            outflow,
            net: inflow - outflow
        };
    }, [transactions]);

    const txTotalPages = Math.ceil(transactions.length / txPerPage) || 1;
    const paginatedTxs = useMemo(() => {
        const startIndex = (txCurrentPage - 1) * txPerPage;
        return transactions.slice(startIndex, startIndex + txPerPage);
    }, [transactions, txCurrentPage]);

    // --- ITEM SAVE & DELETE ---
    const handleSaveItem = async (e) => {
        e.preventDefault();
        if (!itemName.trim()) return toast.error('Ingredient name is required');
        
        const payload = {
            name: itemName,
            unit: itemUnit,
            current_stock: parseFloat(itemStock) || 0,
            minimum_stock: parseFloat(itemMinStock) || 0,
            purchase_rate: parseFloat(itemRate) || 0
        };

        try {
            if (editingItem) {
                await api.put(`/inventory/items/${editingItem.id}`, payload);
                toast.success('Inventory item updated');
            } else {
                await api.post('/inventory/items', payload);
                toast.success('Raw ingredient added to catalog');
            }
            setShowItemModal(false);
            resetItemForm();
            fetchData();
        } catch (err) {
            toast.error('Failed to save item');
        }
    };

    const handleDeleteItem = async (id) => {
        if (!window.confirm('Are you sure you want to delete this ingredient? This will clear any associated recipes.')) return;
        try {
            await api.delete(`/inventory/items/${id}`);
            toast.success('Ingredient deleted');
            fetchData();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    const resetItemForm = () => {
        setEditingItem(null);
        setItemName('');
        setItemUnit('KG');
        setItemStock('');
        setItemMinStock('');
        setItemRate('');
    };

    const openEditItem = (item) => {
        setEditingItem(item);
        setItemName(item.name);
        setItemUnit(item.unit);
        setItemStock(String(item.current_stock));
        setItemMinStock(String(item.minimum_stock));
        setItemRate(String(item.purchase_rate));
        setShowItemModal(true);
    };

    // --- STOCK ADJUSTMENT ---
    const handleAdjustStock = async (e) => {
        e.preventDefault();
        if (!selectedAdjustItemId) return toast.error('Please select an ingredient');

        const selectedItem = items.find(i => String(i.id) === String(selectedAdjustItemId));
        if (!selectedItem) return toast.error('Selected ingredient not found');

        const addedQty = parseFloat(adjustQty) || 0;
        if (addedQty <= 0) return toast.error('Please enter a quantity greater than 0');

        // New total stock = current stock + added stock
        const newPhysicalStock = parseFloat(selectedItem.current_stock) + addedQty;

        try {
            await api.post('/inventory/adjustments', {
                inventory_item_id: Number(selectedAdjustItemId),
                physical_stock: newPhysicalStock,
                remarks: adjustRemarks || `Added ${addedQty} ${selectedItem.unit} to stock.`
            });
            toast.success('Stock added successfully');
            setShowAdjustModal(false);
            setAdjustQty('');
            setAdjustRemarks('');
            fetchData();
        } catch (err) {
            toast.error('Failed to add stock');
        }
    };

    const openAddStockModal = (item) => {
        setSelectedAdjustItemId(String(item.id));
        setAdjustQty('');
        setAdjustRemarks('');
        setShowAdjustModal(true);
    };

    // --- RECIPE MAPPING ---
    const openRecipeModal = async (menuItem) => {
        setSelectedMenuItem(menuItem);
        
        try {
            // Fetch existing recipe for this specific menu item
            const res = await api.get(`/inventory/recipes/product/${menuItem.id}`);
            if (res.data && res.data.items) {
                setRecipeIngredients(res.data.items.map(item => {
                    const matchedItem = items.find(i => i.id === item.inventory_item_id);
                    let displayQty = Number(item.quantity_required) || 0;
                    let displayUnit = matchedItem ? matchedItem.unit : 'KG';

                    if (matchedItem) {
                        const baseUnitLower = matchedItem.unit.toLowerCase();
                        if (baseUnitLower === 'kg' && displayQty < 1) {
                            displayQty = displayQty * 1000;
                            displayUnit = 'Gram';
                        } else if ((baseUnitLower === 'litre' || baseUnitLower === 'l' || baseUnitLower === 'litres') && displayQty < 1) {
                            displayQty = displayQty * 1000;
                            displayUnit = 'ML';
                        } else {
                            // Standardize case to match dropdown values
                            if (baseUnitLower === 'kg') displayUnit = 'KG';
                            else if (baseUnitLower === 'gram') displayUnit = 'Gram';
                            else if (baseUnitLower === 'litre' || baseUnitLower === 'l' || baseUnitLower === 'litres') displayUnit = 'Litre';
                            else if (baseUnitLower === 'ml') displayUnit = 'ML';
                        }
                    }

                    return {
                        inventory_item_id: String(item.inventory_item_id),
                        quantity_required: String(displayQty),
                        unit: displayUnit
                    };
                }));
            } else {
                setRecipeIngredients([]);
            }
            setShowRecipeModal(true);
        } catch (err) {
            toast.error('Failed to load recipe details');
        }
    };

    const addIngredientRow = () => {
        setRecipeIngredients([...recipeIngredients, { inventory_item_id: '', quantity_required: '0', unit: 'KG' }]);
    };

    const removeIngredientRow = (index) => {
        setRecipeIngredients(recipeIngredients.filter((_, idx) => idx !== index));
    };

    const updateIngredientRow = (index, field, value) => {
        setRecipeIngredients(recipeIngredients.map((row, idx) => {
            if (idx === index) {
                const updatedRow = { ...row, [field]: value };
                // If ingredient is changed, sync its default unit and standardize casing
                if (field === 'inventory_item_id') {
                    const selectedItem = items.find(item => String(item.id) === String(value));
                    if (selectedItem) {
                        const baseUnitLower = selectedItem.unit.toLowerCase();
                        if (baseUnitLower === 'kg') updatedRow.unit = 'KG';
                        else if (baseUnitLower === 'gram') updatedRow.unit = 'Gram';
                        else if (baseUnitLower === 'litre' || baseUnitLower === 'l' || baseUnitLower === 'litres') updatedRow.unit = 'Litre';
                        else if (baseUnitLower === 'ml') updatedRow.unit = 'ML';
                        else updatedRow.unit = selectedItem.unit;
                    }
                }
                return updatedRow;
            }
            return row;
        }));
    };

    // Helper to convert units to raw item display unit
    const convertToItemDisplayUnit = (qty, inputUnit, itemUnit) => {
        const q = parseFloat(qty) || 0;
        const iu = String(inputUnit).toLowerCase().trim();
        const iuBase = String(itemUnit).toLowerCase().trim();

        if (iuBase === 'kg') {
            if (iu === 'gram' || iu === 'g' || iu === 'gm' || iu === 'grams') return q / 1000;
            return q;
        }
        if (iuBase === 'gram' || iuBase === 'g' || iuBase === 'gm' || iuBase === 'grams') {
            if (iu === 'kg' || iu === 'kilogram' || iu === 'kilograms') return q * 1000;
            return q;
        }
        if (iuBase === 'litre' || iuBase === 'l' || iuBase === 'litres') {
            if (iu === 'ml' || iu === 'millilitre' || iu === 'millilitres') return q / 1000;
            return q;
        }
        if (iuBase === 'ml' || iuBase === 'millilitre' || iuBase === 'millilitres') {
            if (iu === 'litre' || iu === 'l' || iu === 'litres') return q * 1000;
            return q;
        }
        return q;
    };

    const handleSaveRecipe = async () => {
        if (recipeIngredients.some(row => !row.inventory_item_id)) {
            return toast.error('Please select ingredients for all mapped rows');
        }

        try {
            const mappedItems = recipeIngredients.map(row => {
                const selectedItem = items.find(item => String(item.id) === String(row.inventory_item_id));
                if (!selectedItem) {
                    throw new Error(`Ingredient for ID ${row.inventory_item_id} not found in catalog.`);
                }
                const convertedQty = convertToItemDisplayUnit(
                    row.quantity_required,
                    row.unit || selectedItem.unit,
                    selectedItem.unit
                );
                return {
                    inventory_item_id: Number(row.inventory_item_id),
                    quantity_required: convertedQty
                };
            });

            await api.post('/inventory/recipes', {
                product_id: selectedMenuItem.id,
                items: mappedItems
            });

            toast.success(`Recipe saved for ${selectedMenuItem.name}!`);
            setShowRecipeModal(false);
            setSelectedMenuItem(null);
            setRecipeIngredients([]);
            fetchData();
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to map recipe';
            toast.error(errorMsg);
        }
    };

    // --- FILTERED & PAGINATED LISTS ---
    const filteredItems = items.filter(item => 
        item.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
    );
    const itemsTotalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice((itemCurrentPage - 1) * itemsPerPage, itemCurrentPage * itemsPerPage);

    const filteredMenuItems = menuItems.filter(menuItem => 
        menuItem.name.toLowerCase().includes(menuSearchQuery.toLowerCase())
    );
    const menuTotalPages = Math.ceil(filteredMenuItems.length / menuItemsPerPage);
    const paginatedMenuItems = filteredMenuItems.slice((menuCurrentPage - 1) * menuItemsPerPage, menuCurrentPage * menuItemsPerPage);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1440px', color: 'var(--text-primary)' }}>
            
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                        width: '56px', 
                        height: '56px', 
                        backgroundColor: 'rgba(14, 165, 233, 0.1)', 
                        borderRadius: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '1px solid rgba(14, 165, 233, 0.2)'
                    }}>
                        <Boxes color="#0ea5e9" size={28} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h1 style={{ fontSize: '32px', fontWeight: 950, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                            Inventory Management
                        </h1>
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 700 }}>
                            Add raw materials, customize recipe mappings, and audit current physical stock.
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                        onClick={() => { resetItemForm(); setShowItemModal(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', border: 'none', backgroundColor: '#0ea5e9', color: 'white', fontWeight: 800, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)' }}
                    >
                        <PlusCircle size={18} /> Add Raw Ingredient
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '24px', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package color="#0ea5e9" size={24} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Total Ingredients</span>
                        <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>{metrics.totalItems}</span>
                    </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '24px', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle color="#ef4444" size={24} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Low Stock Items</span>
                        <span style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>{metrics.lowStockItems}</span>
                    </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '24px', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign color="#10b981" size={24} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Total Inventory Value</span>
                            <span style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                                ₹{(items.reduce((sum, item) => sum + ((parseFloat(item.current_stock) || 0) * (parseFloat(item.purchase_rate) || 0)), 0) || Number(metrics.inventoryValue || 0)).toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowValuationModal(true)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid #10b981',
                            backgroundColor: 'transparent',
                            color: '#10b981',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: '0.2s',
                            alignSelf: 'center'
                        }}
                        onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.1)'; }}
                        onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                        View Details
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--bg-border)', paddingBottom: '1px' }}>
                <button 
                    onClick={() => setTab('overview')} 
                    style={{
                        padding: '12px 24px', 
                        backgroundColor: 'transparent', 
                        border: 'none', 
                        borderBottom: tab === 'overview' ? '2px solid #0ea5e9' : '2px solid transparent',
                        color: tab === 'overview' ? '#0ea5e9' : 'var(--text-secondary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '15px'
                    }}
                >
                    Overview & Stock
                </button>
                <button 
                    onClick={() => setTab('recipes')} 
                    style={{
                        padding: '12px 24px', 
                        backgroundColor: 'transparent', 
                        border: 'none', 
                        borderBottom: tab === 'recipes' ? '2px solid #0ea5e9' : '2px solid transparent',
                        color: tab === 'recipes' ? '#0ea5e9' : 'var(--text-secondary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '15px'
                    }}
                >
                    Recipes & BOM Mappings
                </button>
                <button 
                    onClick={() => setTab('reports')} 
                    style={{
                        padding: '12px 24px', 
                        backgroundColor: 'transparent', 
                        border: 'none', 
                        borderBottom: tab === 'reports' ? '2px solid #0ea5e9' : '2px solid transparent',
                        color: tab === 'reports' ? '#0ea5e9' : 'var(--text-secondary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '15px'
                    }}
                >
                    Inventory Reports
                </button>
            </div>

            {/* Loading Indicator */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--bg-border)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--bg-border)', borderTopColor: '#0ea5e9', animation: 'spin 1s linear infinite' }}></div>
                    <p style={{ marginTop: '16px', fontWeight: 800, color: 'var(--text-muted)' }}>Retrieving records...</p>
                </div>
            ) : tab === 'overview' ? (
                
                /* TAB 1: OVERVIEW & STOCK */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Raw Ingredients Catalog</h3>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-muted)' }} size={16} />
                            <input 
                                placeholder="Search Raw Ingredient..."
                                value={itemSearchQuery}
                                onChange={(e) => { setItemSearchQuery(e.target.value); setItemCurrentPage(1); }}
                                style={{ width: '100%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '10px 16px 10px 44px', borderRadius: '8px', outline: 'none', fontWeight: 600, fontSize: '14px', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Ingredient Name</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Current Stock</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Min Safety Stock</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Est. Purchase Rate</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Status</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            No matching ingredients found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map(item => {
                                        const isLow = item.current_stock <= item.minimum_stock;
                                        return (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-rgba-05)', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-base)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td style={{ padding: '16px', fontWeight: 700 }}>{item.name}</td>
                                                <td style={{ padding: '16px', fontWeight: 800, color: isLow ? '#ef4444' : 'var(--text-primary)' }}>
                                                    {item.current_stock} {item.unit}
                                                </td>
                                                <td style={{ padding: '16px', fontWeight: 600 }}>{item.minimum_stock} {item.unit}</td>
                                                <td style={{ padding: '16px', fontWeight: 600 }}>₹{parseFloat(item.purchase_rate).toFixed(2)}</td>
                                                <td style={{ padding: '16px' }}>
                                                    <span style={{ 
                                                        padding: '4px 8px', 
                                                        borderRadius: '6px', 
                                                        fontSize: '11px', 
                                                        fontWeight: 900, 
                                                        textTransform: 'uppercase', 
                                                        backgroundColor: isLow ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                                                        color: isLow ? '#ef4444' : '#10b981' 
                                                    }}>
                                                        {isLow ? 'Low Stock' : 'Healthy'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button 
                                                            onClick={() => openEditItem(item)}
                                                            style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', cursor: 'pointer', fontWeight: 700 }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            onClick={() => openAddStockModal(item)}
                                                            style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', cursor: 'pointer', fontWeight: 700 }}
                                                        >
                                                            Add Stock
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {itemsTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button disabled={itemCurrentPage === 1} onClick={() => setItemCurrentPage(p => p - 1)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: itemCurrentPage === 1 ? 'default' : 'pointer', fontWeight: 800 }}>Prev</button>
                            <span style={{ padding: '8px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>{itemCurrentPage} / {itemsTotalPages}</span>
                            <button disabled={itemCurrentPage === itemsTotalPages} onClick={() => setItemCurrentPage(p => p + 1)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: itemCurrentPage === itemsTotalPages ? 'default' : 'pointer', fontWeight: 800 }}>Next</button>
                        </div>
                    )}
                </div>
            ) : tab === 'recipes' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Menu Recipes (BOM)</h3>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-muted)' }} size={16} />
                            <input 
                                placeholder="Search Menu Product..."
                                value={menuSearchQuery}
                                onChange={(e) => { setMenuSearchQuery(e.target.value); setMenuCurrentPage(1); }}
                                style={{ width: '100%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '10px 16px 10px 44px', borderRadius: '8px', outline: 'none', fontWeight: 600, fontSize: '14px', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Menu Product</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Base Selling Price</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Recipe Mapped Ingredients</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Status</th>
                                    <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedMenuItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            No matching menu products found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedMenuItems.map(menuItem => {
                                        const linkedRecipe = recipes.find(r => r.product_id === menuItem.id);
                                        
                                        return (
                                            <tr key={menuItem.id} style={{ borderBottom: '1px solid var(--border-rgba-05)', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-base)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td style={{ padding: '16px', fontWeight: 700 }}>{menuItem.name}</td>
                                                <td style={{ padding: '16px', fontWeight: 800, color: '#10b981' }}>₹{parseFloat(menuItem.price).toFixed(2)}</td>
                                                <td style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    {linkedRecipe ? (
                                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                            Recipe active ({linkedRecipe.ingredients?.length || 0} ingredients mapped)
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontStyle: 'italic', fontSize: '13px' }}>No ingredients linked</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px' }}>
                                                    <span style={{ 
                                                        padding: '4px 8px', 
                                                        borderRadius: '6px', 
                                                        fontSize: '11px', 
                                                        fontWeight: 900, 
                                                        textTransform: 'uppercase', 
                                                        backgroundColor: linkedRecipe ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                                                        color: linkedRecipe ? '#10b981' : '#f59e0b' 
                                                    }}>
                                                        {linkedRecipe ? 'Active BOM' : 'Needs Setup'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                                    <button 
                                                        onClick={() => openRecipeModal(menuItem)}
                                                        style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', backgroundColor: linkedRecipe ? 'var(--bg-border)' : '#0ea5e9', color: linkedRecipe ? 'var(--text-primary)' : 'white', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}
                                                    >
                                                        {linkedRecipe ? 'Edit Recipe / BOM' : 'Configure Recipe'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {menuTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button disabled={menuCurrentPage === 1} onClick={() => setMenuCurrentPage(p => p - 1)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: menuCurrentPage === 1 ? 'default' : 'pointer', fontWeight: 800 }}>Prev</button>
                            <span style={{ padding: '8px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>{menuCurrentPage} / {menuTotalPages}</span>
                            <button disabled={menuCurrentPage === menuTotalPages} onClick={() => setMenuCurrentPage(p => p + 1)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: menuCurrentPage === menuTotalPages ? 'default' : 'pointer', fontWeight: 800 }}>Next</button>
                        </div>
                    )}
                </div>
            ) : (
                
                /* TAB 3: STOCK LEDGER & REPORTS */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Filters & Control Panel */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--bg-border)' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Date Presets Selector */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time Period</label>
                                <select 
                                    value={txDateFilter} 
                                    onChange={e => setTxDateFilter(e.target.value)} 
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer', fontSize: '13px' }}
                                >
                                    <option value="Today">Today</option>
                                    <option value="CurrentMonth">Current Month</option>
                                    <option value="LastMonth">Last Month</option>
                                    <option value="ThisYear">This Year</option>
                                    <option value="Custom">Custom Range</option>
                                </select>
                            </div>

                            {/* Custom Dates (visible only if Custom selected) */}
                            {txDateFilter === 'Custom' && (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>From</label>
                                        <input 
                                            type="date" 
                                            value={txCustomStart} 
                                            onChange={e => setTxCustomStart(e.target.value)} 
                                            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer', fontSize: '13px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>To</label>
                                        <input 
                                            type="date" 
                                            value={txCustomEnd} 
                                            onChange={e => setTxCustomEnd(e.target.value)} 
                                            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer', fontSize: '13px' }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Raw Ingredient Selector */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ingredient</label>
                                <select 
                                    value={txItemFilter} 
                                    onChange={e => setTxItemFilter(e.target.value)} 
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer', fontSize: '13px', minWidth: '150px' }}
                                >
                                    <option value="ALL">All Ingredients</option>
                                    {items.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Transaction Type Selector */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</label>
                                <select 
                                    value={txTypeFilter} 
                                    onChange={e => setTxTypeFilter(e.target.value)} 
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer', fontSize: '13px' }}
                                >
                                    <option value="ALL">All Types</option>
                                    <option value="PURCHASE">Purchase (+)</option>
                                    <option value="SALE">Sale (-)</option>
                                    <option value="ADJUSTMENT">Adjustment (±)</option>
                                    <option value="WASTAGE">Wastage (-)</option>
                                </select>
                            </div>
                        </div>

                        <button 
                            onClick={exportPDF} 
                            disabled={transactions.length === 0}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '10px 20px', 
                                borderRadius: '10px', 
                                border: 'none', 
                                backgroundColor: transactions.length === 0 ? 'var(--bg-border)' : '#f43f5e', 
                                color: transactions.length === 0 ? 'var(--text-muted)' : 'white', 
                                fontWeight: 800, 
                                cursor: transactions.length === 0 ? 'default' : 'pointer',
                                transition: '0.2s',
                                fontSize: '13px'
                            }}
                        >
                            <Download size={16} /> Export PDF
                        </button>
                    </div>

                    {/* Summary Metrics Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ArrowUpRight color="#10b981" size={20} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Total Inflow</span>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                                    {txSummary.inflow.toFixed(2)} units
                                </span>
                            </div>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ArrowDownLeft color="#f43f5e" size={20} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Total Outflow</span>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#f43f5e', marginTop: '2px' }}>
                                    {txSummary.outflow.toFixed(2)} units
                                </span>
                            </div>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ArrowRightLeft color="#0ea5e9" size={20} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Net Stock Impact</span>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: txSummary.net >= 0 ? '#10b981' : '#f43f5e', marginTop: '2px' }}>
                                    {txSummary.net >= 0 ? '+' : ''}{txSummary.net.toFixed(2)} units
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div style={{ position: 'relative' }}>
                        {txLoading && (
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', backdropFilter: 'blur(2px)' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--bg-border)', borderTopColor: '#0ea5e9', animation: 'spin 1s linear infinite' }}></div>
                            </div>
                        )}

                        <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                        <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Date & Time</th>
                                        <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Ingredient Name</th>
                                        <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Type</th>
                                        <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Quantity</th>
                                        <th style={{ padding: '16px', borderBottom: '2px solid var(--bg-border)', color: 'var(--text-muted)', fontWeight: 800 }}>Reference / Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedTxs.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                No inventory transactions found for this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedTxs.map(tx => {
                                            const isPositive = parseFloat(tx.quantity) > 0;
                                            
                                            // Badge Styles
                                            let badgeBg = 'rgba(100, 116, 139, 0.1)';
                                            let badgeColor = 'var(--text-muted)';
                                            if (tx.type === 'SALE') {
                                                badgeBg = 'rgba(14, 165, 233, 0.1)';
                                                badgeColor = '#0ea5e9';
                                            } else if (tx.type === 'PURCHASE') {
                                                badgeBg = 'rgba(16, 185, 129, 0.1)';
                                                badgeColor = '#10b981';
                                            } else if (tx.type === 'WASTAGE') {
                                                badgeBg = 'rgba(244, 63, 94, 0.1)';
                                                badgeColor = '#f43f5e';
                                            } else if (tx.type === 'ADJUSTMENT') {
                                                badgeBg = 'rgba(245, 158, 11, 0.1)';
                                                badgeColor = '#f59e0b';
                                            }

                                            return (
                                                <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-rgba-05)', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-base)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                        {new Date(tx.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </td>
                                                    <td style={{ padding: '16px', fontWeight: 700 }}>{tx.item_name}</td>
                                                    <td style={{ padding: '16px' }}>
                                                        <span style={{ 
                                                            padding: '4px 8px', 
                                                            borderRadius: '6px', 
                                                            fontSize: '11px', 
                                                            fontWeight: 900, 
                                                            textTransform: 'uppercase', 
                                                            backgroundColor: badgeBg, 
                                                            color: badgeColor 
                                                        }}>
                                                            {tx.type}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px', fontWeight: 800, color: isPositive ? '#10b981' : '#f43f5e' }}>
                                                        {isPositive ? '+' : ''}{parseFloat(tx.quantity).toFixed(4)} {tx.unit}
                                                    </td>
                                                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
                                                        {tx.remarks || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Report Pagination */}
                    {txTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button disabled={txCurrentPage === 1} onClick={() => setTxCurrentPage(p => p - 1)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: txCurrentPage === 1 ? 'default' : 'pointer', fontWeight: 800 }}>Prev</button>
                            <span style={{ padding: '8px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>{txCurrentPage} / {txTotalPages}</span>
                            <button disabled={txCurrentPage === txTotalPages} onClick={() => setTxCurrentPage(p => p + 1)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: txCurrentPage === txTotalPages ? 'default' : 'pointer', fontWeight: 800 }}>Next</button>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 1: ADD / EDIT RAW MATERIAL */}
            {showItemModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)' }} onClick={() => setShowItemModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '36px', borderRadius: '32px', width: '90%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '24px', border: '1px solid var(--bg-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>
                                {editingItem ? 'Edit Raw Ingredient' : 'Add Raw Material'}
                            </h3>
                            <button onClick={() => setShowItemModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
                        </div>

                        <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ingredient Name</label>
                                <input 
                                    type="text" 
                                    value={itemName} 
                                    onChange={e => setItemName(e.target.value)} 
                                    placeholder="e.g. Rice, Chicken, Cooking Oil"
                                    required
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Measurement Unit</label>
                                    <select 
                                        value={itemUnit} 
                                        onChange={e => setItemUnit(e.target.value)} 
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                    >
                                        <option value="KG">Kilogram (KG)</option>
                                        <option value="Gram">Gram (g)</option>
                                        <option value="Litre">Litre (L)</option>
                                        <option value="ML">Millilitre (ML)</option>
                                        <option value="Piece">Piece (pc)</option>
                                        <option value="Packet">Packet (pkt)</option>
                                        <option value="Bottle">Bottle (btl)</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Initial Stock Level</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        value={itemStock} 
                                        onChange={e => setItemStock(e.target.value)} 
                                        disabled={!!editingItem} // stock adjustments should be logged separately
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Safety Alert Min</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        value={itemMinStock} 
                                        onChange={e => setItemMinStock(e.target.value)} 
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Purchase Rate (₹)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        value={itemRate} 
                                        onChange={e => setItemRate(e.target.value)} 
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setShowItemModal(false)}
                                    style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800 }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: '#0ea5e9', color: 'white', fontWeight: 800, boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)' }}
                                >
                                    Save Ingredient
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: ADD STOCK LEVEL */}
            {showAdjustModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)' }} onClick={() => setShowAdjustModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '36px', borderRadius: '32px', width: '90%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '24px', border: '1px solid var(--bg-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>Add Stock</h3>
                            <button onClick={() => setShowAdjustModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
                        </div>

                        {(() => {
                            const selectedItem = items.find(i => String(i.id) === String(selectedAdjustItemId));
                            return (
                                <form onSubmit={handleAdjustStock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ingredient Name</label>
                                        <div style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700 }}>
                                            {selectedItem ? `${selectedItem.name} (Current: ${selectedItem.current_stock} ${selectedItem.unit})` : 'N/A'}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quantity to Add</label>
                                        <input 
                                            type="number" 
                                            step="any"
                                            value={adjustQty} 
                                            onChange={e => setAdjustQty(e.target.value)} 
                                            placeholder={`Enter quantity in ${selectedItem?.unit || 'units'}`}
                                            required
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Notes / Remarks</label>
                                        <input 
                                            type="text" 
                                            value={adjustRemarks} 
                                            onChange={e => setAdjustRemarks(e.target.value)} 
                                            placeholder="e.g. Purchased extra, supplier delivery"
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowAdjustModal(false)}
                                            style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800 }}
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit"
                                            style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: '#0ea5e9', color: 'white', fontWeight: 800, boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)' }}
                                        >
                                            Add Stock
                                        </button>
                                    </div>
                                </form>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* MODAL 3: CONFIGURE RECIPE / BOM */}
            {showRecipeModal && selectedMenuItem && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)' }} onClick={() => setShowRecipeModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '36px', borderRadius: '32px', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', border: '1px solid var(--bg-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>Configure Recipe (BOM)</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, margin: '4px 0 0 0' }}>Define raw ingredients for product: <span style={{ color: '#0ea5e9' }}>{selectedMenuItem.name}</span></p>
                            </div>
                            <button onClick={() => setShowRecipeModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mapped Ingredients List</label>
                                <button 
                                    onClick={addIngredientRow}
                                    style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', cursor: 'pointer', fontWeight: 800, fontSize: '12px' }}
                                >
                                    + Add Ingredient Row
                                </button>
                            </div>

                            {recipeIngredients.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px', border: '2px dashed var(--bg-border)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                                    No ingredients added. Click "+ Add Ingredient Row" to build the bill of materials.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {recipeIngredients.map((row, index) => {
                                        const selectedItemObj = items.find(i => String(i.id) === String(row.inventory_item_id));
                                        
                                        return (
                                            <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                
                                                {/* Ingredient select */}
                                                <select 
                                                    value={row.inventory_item_id}
                                                    onChange={e => updateIngredientRow(index, 'inventory_item_id', e.target.value)}
                                                    style={{ flex: 2, padding: '12px', borderRadius: '12px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', outline: 'none' }}
                                                >
                                                    <option value="">Choose Raw Ingredient...</option>
                                                    {items.map(item => (
                                                        <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                                                    ))}
                                                </select>

                                                {/* Quantity required input with unit dropdown */}
                                                <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-base)', padding: '0 12px', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
                                                    <input 
                                                        type="number"
                                                        step="any"
                                                        value={row.quantity_required}
                                                        placeholder="Qty"
                                                        onChange={e => updateIngredientRow(index, 'quantity_required', e.target.value)}
                                                        style={{ width: '100%', padding: '12px 0', border: 'none', background: 'none', color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', outline: 'none' }}
                                                    />
                                                    {selectedItemObj && (
                                                        ['kg', 'gram', 'g', 'gm', 'grams'].includes(selectedItemObj.unit.toLowerCase()) ? (
                                                            <select
                                                                value={row.unit}
                                                                onChange={e => updateIngredientRow(index, 'unit', e.target.value)}
                                                                style={{ border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', padding: '4px 8px', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 800, fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                                                            >
                                                                <option value="KG">KG</option>
                                                                <option value="Gram">Gram</option>
                                                            </select>
                                                        ) : ['litre', 'l', 'ml', 'litres'].includes(selectedItemObj.unit.toLowerCase()) ? (
                                                            <select
                                                                value={row.unit}
                                                                onChange={e => updateIngredientRow(index, 'unit', e.target.value)}
                                                                style={{ border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', padding: '4px 8px', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 800, fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                                                            >
                                                                <option value="Litre">Litre</option>
                                                                <option value="ML">ML</option>
                                                            </select>
                                                        ) : (
                                                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>
                                                                {selectedItemObj.unit}
                                                            </span>
                                                        )
                                                    )}
                                                </div>

                                                {/* Delete row */}
                                                <button 
                                                    onClick={() => removeIngredientRow(index)}
                                                    style={{ padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button 
                                type="button" 
                                onClick={() => setShowRecipeModal(false)}
                                style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800 }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveRecipe}
                                style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: '#10b981', color: 'white', fontWeight: 800, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                            >
                                Save Recipe BOM
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: INVENTORY VALUATION BREAKDOWN */}
            {showValuationModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)' }} onClick={() => setShowValuationModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '36px', borderRadius: '32px', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--bg-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>Inventory Valuation Breakdown</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, margin: '4px 0 0 0' }}>Itemized list of current stock value</p>
                            </div>
                            <button onClick={() => setShowValuationModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, borderRadius: '16px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-base)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                                    <tr style={{ borderBottom: '2px solid var(--bg-border)' }}>
                                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 800 }}>Ingredient</th>
                                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 800, textAlign: 'right' }}>Current Stock</th>
                                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 800, textAlign: 'right' }}>Purchase Rate</th>
                                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 800, textAlign: 'right' }}>Total Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>No ingredients cataloged.</td>
                                        </tr>
                                    ) : (
                                        items.map(item => {
                                            const totalItemVal = (parseFloat(item.current_stock) || 0) * (parseFloat(item.purchase_rate) || 0);
                                            return (
                                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-rgba-05)' }}>
                                                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{item.name}</td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{item.current_stock} {item.unit}</td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>₹{parseFloat(item.purchase_rate).toFixed(2)}</td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: totalItemVal > 0 ? '#10b981' : 'var(--text-primary)' }}>₹{totalItemVal.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid var(--bg-border)', paddingTop: '16px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-muted)' }}>GRAND TOTAL</span>
                            <span style={{ fontSize: '20px', fontWeight: 950, color: '#10b981' }}>
                                ₹{(items.reduce((sum, item) => sum + ((parseFloat(item.current_stock) || 0) * (parseFloat(item.purchase_rate) || 0)), 0) || Number(metrics.inventoryValue || 0)).toFixed(2)}
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => setShowValuationModal(false)}
                                style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)', fontWeight: 800 }}
                            >
                                Close Breakdown
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Spinner keyframe styling */}
            <style>{`
                @keyframes spin { 
                    0% { transform: rotate(0deg); } 
                    100% { transform: rotate(360deg); } 
                }
            `}</style>
        </div>
    );
};

export default InventoryManagement;
