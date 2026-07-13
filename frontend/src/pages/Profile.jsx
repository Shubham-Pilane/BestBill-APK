import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { User, Mail, Lock, ShieldCheck, Save, Eye, EyeOff, LayoutPanelLeft, UserCircle, Wallet, Users, Trash2, UserPlus, Fingerprint, MapPin, Percent, Upload, Image as ImageIcon, Printer, ChevronDown, Globe, Download, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { BluetoothPrinterService, formatBill } from '../services/bluetoothPrinterService';
const Profile = () => {
    const { user, updateUser } = useAuth();
    const isAdmin = user?.role === 'admin';
    const isOwner = user?.role === 'owner';
    const themeColor = isAdmin ? '#10b981' : '#0ea5e9';
    const serverUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'https://bestbill-backend-174132084209.us-central1.run.app';

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        confirmPassword: ''
    });

    const [hotelData, setHotelData] = useState({
        name: user?.hotel_name || '',
        address: user?.hotel_address || '',
        upi_id: user?.upi_id || '',
        gst_percentage: user?.gst_percentage || 0,
        billing_method: user?.billing_method || 'qz',
        logo_url: '',
        fssai_number: '',
        email: '',
        phone: ''
    });

    const [staff, setStaff] = useState([]);
    const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '' });
    const [hiring, setHiring] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [printerConfig, setPrinterConfig] = useState({
        billing: { type: 'usb', printerName: 'billing-printer', ip: '', port: 9100, paperSize: '80mm', charLimit: 42 },
        kitchen: { type: 'usb', printerName: 'kitchen-printer', ip: '', port: 9100, paperSize: '80mm', charLimit: 42 }
    });
    const [installedPrinters, setInstalledPrinters] = useState([]);
    const [availableIps, setAvailableIps] = useState([]);
    const [selectedGuestIp, setSelectedGuestIp] = useState('');
    const [billingCustomActive, setBillingCustomActive] = useState(false);
    const [kitchenCustomActive, setKitchenCustomActive] = useState(false);
    const [lodgingEnabled, setLodgingEnabled] = useState(false);
    const [showLodgingModal, setShowLodgingModal] = useState(false);
    const [lodgingPassword, setLodgingPassword] = useState('');
    const [lodgingModalMode, setLodgingModalMode] = useState('enable');
    const [showPrinters, setShowPrinters] = useState(false);
    
    // Modules
    const [showModules, setShowModules] = useState(false);
    
    // KOT State
    const [kotEnabled, setKotEnabled] = useState(false);
    const [showKotModal, setShowKotModal] = useState(false);
    const [kotPassword, setKotPassword] = useState('');
    const [kotModalMode, setKotModalMode] = useState('enable');
    
    // WhatsApp Billing State
    const [whatsAppBillingEnabled, setWhatsAppBillingEnabled] = useState(false);
    const [showWhatsAppBillingModal, setShowWhatsAppBillingModal] = useState(false);
    const [whatsAppBillingPassword, setWhatsAppBillingPassword] = useState('');
    const [whatsAppBillingModalMode, setWhatsAppBillingModalMode] = useState('enable');

    // Inventory Management State
    const [inventoryEnabled, setInventoryEnabled] = useState(false);
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [inventoryPassword, setInventoryPassword] = useState('');
    const [inventoryModalMode, setInventoryModalMode] = useState('enable');

    // Token Counter State
    const [tokenCounterEnabled, setTokenCounterEnabled] = useState(false);
    const [showTokenCounterModal, setShowTokenCounterModal] = useState(false);
    const [tokenCounterPassword, setTokenCounterPassword] = useState('');
    const [tokenCounterModalMode, setTokenCounterModalMode] = useState('enable');

    // Simple KOT State
    const [simpleKotEnabled, setSimpleKotEnabled] = useState(false);
    const [showSimpleKotModal, setShowSimpleKotModal] = useState(false);
    const [simpleKotPassword, setSimpleKotPassword] = useState('');
    const [simpleKotModalMode, setSimpleKotModalMode] = useState('enable');

    const [showStaffSection, setShowStaffSection] = useState(false);
    const [showNetworkConfig, setShowNetworkConfig] = useState(false);
    const [showSecurityCore, setShowSecurityCore] = useState(false);
    const [showHotelProfile, setShowHotelProfile] = useState(false);

    useEffect(() => {
        if (isOwner) {
            fetchStaff();
            fetchHotelDetails();
            fetchPrinterConfig();
            fetchInstalledPrinters();
            fetchAvailableIps();
            fetchLodgingStatus();
            fetchKotStatus();
            fetchWhatsAppBillingStatus();
            fetchInventoryStatus();
            fetchTokenCounterStatus();
            fetchSimpleKotStatus();
        }
    }, [isOwner]);

    const fetchLodgingStatus = async () => {
        try {
            const res = await api.get('/hotel/lodging-status');
            setLodgingEnabled(res.data.lodgingEnabled);
            updateUser({ lodgingEnabled: res.data.lodgingEnabled });
        } catch (err) {
            console.error('Failed to fetch lodging status', err);
        }
    };

    const handleToggleLodging = (shouldEnable) => {
        if (shouldEnable) {
            setLodgingModalMode('enable');
            setLodgingPassword('');
            setShowLodgingModal(true);
        } else {
            setLodgingModalMode('disable');
            setLodgingPassword('');
            setShowLodgingModal(true);
        }
    };

    const handleLodgingModalSubmit = async () => {
        if (!lodgingPassword) {
            toast.error("Password cannot be blank");
            return;
        }
        if (lodgingModalMode === 'enable') {
            try {
                const res = await api.post('/hotel/toggle-lodging', { enabled: true, passcode: lodgingPassword });
                if (res.data.success) {
                    setLodgingEnabled(true);
                    updateUser({ lodgingEnabled: true });
                    toast.success("Premium Lodging module unlocked and activated!");
                    setShowLodgingModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect activation password");
            }
        } else {
            try {
                const res = await api.post('/hotel/toggle-lodging', { enabled: false, passcode: lodgingPassword });
                if (res.data.success) {
                    setLodgingEnabled(false);
                    updateUser({ lodgingEnabled: false });
                    toast.success("Lodging module deactivated successfully.");
                    setShowLodgingModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect deactivation password");
            }
        }
    };

    const fetchKotStatus = async () => {
        try {
            const res = await api.get('/hotel/kot-status');
            setKotEnabled(res.data.kotEnabled);
            updateUser({ kotEnabled: res.data.kotEnabled });
        } catch (err) {
            console.error('Failed to fetch KOT status', err);
        }
    };

    const handleToggleKot = (shouldEnable) => {
        if (shouldEnable) {
            setKotModalMode('enable');
            setKotPassword('');
            setShowKotModal(true);
        } else {
            setKotModalMode('disable');
            setKotPassword('');
            setShowKotModal(true);
        }
    };

    const handleKotModalSubmit = async () => {
        if (!kotPassword) {
            toast.error("Password cannot be blank");
            return;
        }
        if (kotModalMode === 'enable') {
            try {
                const res = await api.post('/hotel/toggle-kot', { enabled: true, passcode: kotPassword });
                if (res.data.success) {
                    setKotEnabled(true);
                    updateUser({ kotEnabled: true });
                    toast.success("KOT Module activated!");
                    setShowKotModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect activation password");
            }
        } else {
            try {
                const res = await api.post('/hotel/toggle-kot', { enabled: false, passcode: kotPassword });
                if (res.data.success) {
                    setKotEnabled(false);
                    updateUser({ kotEnabled: false });
                    toast.success("KOT module deactivated.");
                    setShowKotModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect deactivation password");
            }
        }
    };

    const fetchWhatsAppBillingStatus = async () => {
        try {
            const res = await api.get('/hotel/whatsapp-billing-status');
            setWhatsAppBillingEnabled(res.data.whatsAppBillingEnabled);
            updateUser({ whatsAppBillingEnabled: res.data.whatsAppBillingEnabled });
        } catch (err) {
            console.error('Failed to fetch WhatsApp billing status', err);
        }
    };

    const handleToggleWhatsAppBilling = (shouldEnable) => {
        if (shouldEnable) {
            setWhatsAppBillingModalMode('enable');
            setWhatsAppBillingPassword('');
            setShowWhatsAppBillingModal(true);
        } else {
            setWhatsAppBillingModalMode('disable');
            setWhatsAppBillingPassword('');
            setShowWhatsAppBillingModal(true);
        }
    };

    const handleWhatsAppBillingModalSubmit = async () => {
        if (!whatsAppBillingPassword) {
            toast.error("Password cannot be blank");
            return;
        }
        if (whatsAppBillingModalMode === 'enable') {
            try {
                const res = await api.post('/hotel/toggle-whatsapp-billing', { enabled: true, passcode: whatsAppBillingPassword });
                if (res.data.success) {
                    setWhatsAppBillingEnabled(true);
                    updateUser({ whatsAppBillingEnabled: true });
                    toast.success("WhatsApp Billing activated!");
                    setShowWhatsAppBillingModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect activation password");
            }
        } else {
            try {
                const res = await api.post('/hotel/toggle-whatsapp-billing', { enabled: false, passcode: whatsAppBillingPassword });
                if (res.data.success) {
                    setWhatsAppBillingEnabled(false);
                    updateUser({ whatsAppBillingEnabled: false });
                    toast.success("WhatsApp Billing deactivated.");
                    setShowWhatsAppBillingModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect deactivation password");
            }
        }
    };

    const fetchInventoryStatus = async () => {
        try {
            const res = await api.get('/hotel/inventory-status');
            setInventoryEnabled(res.data.inventoryEnabled);
            updateUser({ inventoryEnabled: res.data.inventoryEnabled });
        } catch (err) {
            console.error('Failed to fetch inventory status', err);
        }
    };

    const handleToggleInventory = (shouldEnable) => {
        if (shouldEnable) {
            setInventoryModalMode('enable');
            setInventoryPassword('');
            setShowInventoryModal(true);
        } else {
            setInventoryModalMode('disable');
            setInventoryPassword('');
            setShowInventoryModal(true);
        }
    };

    const handleInventoryModalSubmit = async () => {
        if (!inventoryPassword) {
            toast.error("Password cannot be blank");
            return;
        }
        if (inventoryModalMode === 'enable') {
            try {
                const res = await api.post('/hotel/toggle-inventory', { enabled: true, passcode: inventoryPassword });
                if (res.data.success) {
                    setInventoryEnabled(true);
                    updateUser({ inventoryEnabled: true });
                    toast.success("Inventory Management Module activated!");
                    setShowInventoryModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect activation password");
            }
        } else {
            try {
                const res = await api.post('/hotel/toggle-inventory', { enabled: false, passcode: inventoryPassword });
                if (res.data.success) {
                    setInventoryEnabled(false);
                    updateUser({ inventoryEnabled: false });
                    toast.success("Inventory Management Module deactivated.");
                    setShowInventoryModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect deactivation password");
            }
        }
    };

    const fetchTokenCounterStatus = async () => {
        try {
            const res = await api.get('/hotel/token-counter-status');
            setTokenCounterEnabled(res.data.tokenCounterEnabled);
            updateUser({ tokenCounterEnabled: res.data.tokenCounterEnabled });
        } catch (err) {
            console.error('Failed to fetch token counter status', err);
        }
    };

    const fetchSimpleKotStatus = async () => {
        try {
            const res = await api.get('/hotel/simple-kot-status');
            setSimpleKotEnabled(res.data.simpleKotEnabled);
            updateUser({ simpleKotEnabled: res.data.simpleKotEnabled });
        } catch (err) {
            console.error('Failed to fetch simple KOT status', err);
        }
    };

    const handleToggleTokenCounter = (shouldEnable) => {
        if (shouldEnable) {
            setTokenCounterModalMode('enable');
            setTokenCounterPassword('');
            setShowTokenCounterModal(true);
        } else {
            setTokenCounterModalMode('disable');
            setTokenCounterPassword('');
            setShowTokenCounterModal(true);
        }
    };

    const handleTokenCounterModalSubmit = async () => {
        if (!tokenCounterPassword) {
            toast.error("Password cannot be blank");
            return;
        }
        if (tokenCounterModalMode === 'enable') {
            try {
                const res = await api.post('/hotel/toggle-token-counter', { enabled: true, passcode: tokenCounterPassword });
                if (res.data.success) {
                    setTokenCounterEnabled(true);
                    updateUser({ tokenCounterEnabled: true });
                    toast.success("Token Counter module activated!");
                    setShowTokenCounterModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect activation password");
            }
        } else {
            try {
                const res = await api.post('/hotel/toggle-token-counter', { enabled: false, passcode: tokenCounterPassword });
                if (res.data.success) {
                    setTokenCounterEnabled(false);
                    updateUser({ tokenCounterEnabled: false });
                    toast.success("Token Counter module deactivated.");
                    setShowTokenCounterModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect deactivation password");
            }
        }
    };

    const handleToggleSimpleKot = (shouldEnable) => {
        if (shouldEnable) {
            setSimpleKotModalMode('enable');
            setSimpleKotPassword('');
            setShowSimpleKotModal(true);
        } else {
            setSimpleKotModalMode('disable');
            setSimpleKotPassword('');
            setShowSimpleKotModal(true);
        }
    };

    const handleSimpleKotModalSubmit = async () => {
        if (!simpleKotPassword) {
            toast.error("Password cannot be blank");
            return;
        }
        if (simpleKotModalMode === 'enable') {
            try {
                const res = await api.post('/hotel/toggle-simple-kot', { enabled: true, passcode: simpleKotPassword });
                if (res.data.success) {
                    setSimpleKotEnabled(true);
                    updateUser({ simpleKotEnabled: true });
                    toast.success("Simple KOT module activated!");
                    setShowSimpleKotModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect activation password");
            }
        } else {
            try {
                const res = await api.post('/hotel/toggle-simple-kot', { enabled: false, passcode: simpleKotPassword });
                if (res.data.success) {
                    setSimpleKotEnabled(false);
                    updateUser({ simpleKotEnabled: false });
                    toast.success("Simple KOT module deactivated.");
                    setShowSimpleKotModal(false);
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Incorrect deactivation password");
            }
        }
    };

    const fetchInstalledPrinters = async () => {
        try {
            const devices = await BluetoothPrinterService.listPairedDevices();
            setInstalledPrinters(devices || []);
        } catch (err) {
            console.error('Failed to fetch Bluetooth printers', err);
        }
    };

    const fetchAvailableIps = async () => {
        if (window.bestbillDesktop?.getLanIps) {
            try {
                const ips = await window.bestbillDesktop.getLanIps();
                setAvailableIps(ips || []);
            } catch (err) {
                console.error('Failed to fetch LAN IPs from desktop app', err);
            }
        } else {
            setAvailableIps(['127.0.0.1', '192.168.1.100']);
        }
    };

    const fetchPrinterConfig = async () => {
        try {
            const res = await api.get('/hotel/printers-config');
            if (res.data && res.data.printers) {
                setPrinterConfig({
                    billing: { type: 'bluetooth', printerName: res.data.printers?.billing?.deviceName || '', ip: '', port: 9100, paperSize: res.data.printers?.billing?.paperSize || '80mm', charLimit: 42 },
                    kitchen: { type: 'usb', printerName: 'kitchen-printer', ip: '', port: 9100, paperSize: '80mm', charLimit: 42 }
                });
                setSelectedGuestIp(res.data.guestIp || '');
            }
        } catch (err) {
            console.error('Failed to load configs', err);
        }
    };

    const handlePrinterConfigSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hotel/printers-config', {
                printers: {
                    billing: {
                        deviceName: printerConfig.billing.printerName,
                        paperSize: printerConfig.billing.paperSize
                    }
                }
            });
            toast.success('Printer configuration saved!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update configurations');
        }
    };

    const handleTestPrint = async () => {
        try {
            const testPayload = {
                type: 'FINAL_BILL',
                billId: 9999,
                table: 'Test Table 1',
                subtotal: 100.00,
                gst: 5.00,
                finalAmount: 105.00,
                discountPercentage: 0,
                items: [
                    { name: 'Test Food Item', price: 100.00, qty: 1 }
                ],
                hotelName: hotelData.name || 'Test Hotel',
                hotelPhone: hotelData.phone || '9999999999',
                hotelLocation: hotelData.address || 'Test Location',
                upiId: hotelData.upi_id || '',
                isPaid: false,
                gst_percentage: hotelData.gst_percentage || 5
            };

            const size = printerConfig.billing.paperSize || '80mm';
            const bytes = formatBill(testPayload, size);
            
            const tId = toast.loading('Sending test print to Bluetooth printer...');
            const success = await BluetoothPrinterService.printData(bytes);
            if (success) {
                toast.success('Test print successful!', { id: tId });
            } else {
                toast.error('Test print failed. Please check Bluetooth connection.', { id: tId });
            }
        } catch (err) {
            toast.error('Test print error: ' + err.message);
        }
    };

    const fetchHotelDetails = async () => {
        try {
            const res = await api.get('/hotel');
            const data = res.data;
            setHotelData(prev => ({
                ...prev,
                name: data.name || '',
                address: data.location || '',
                upi_id: data.upi_id || '',
                gst_percentage: data.gst_percentage || 0,
                billing_method: data.billing_method || 'qz',
                logo_url: data.logo_url || '',
                fssai_number: data.fssai_number || '',
                email: data.email || '',
                phone: data.phone || ''
            }));
        } catch (err) {
            console.error('Failed to load hotel details', err);
        }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/hotel/waiters');
            setStaff(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleHiring = async (e) => {
        e.preventDefault();
        setHiring(true);
        const t = toast.loading('Onboarding staff member...');
        try {
            await api.post('/hotel/waiters', staffForm);
            toast.success(`${staffForm.name} added to waitstaff!`, { id: t });
            setStaffForm({ name: '', email: '', password: '' });
            fetchStaff();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Hiring failed', { id: t });
        } finally {
            setHiring(false);
        }
    };

    const removeStaff = async (id) => {
        try {
            await api.delete(`/hotel/waiters/${id}`);
            toast.success('Staff access revoked');
            fetchStaff();
        } catch (err) {
            toast.error('Removal failed');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password && formData.password !== formData.confirmPassword) {
            return toast.error('Passcodes do not match!');
        }
        setLoading(true);
        const t = toast.loading('Syncing security updates...');
        try {
            const updatePayload = { name: formData.name, email: formData.email };
            if (formData.password) updatePayload.password = formData.password;
            const res = await api.put('/profile', updatePayload);
            updateUser(res.data.user);
            toast.success('Personal credentials updated!', { id: t });
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        } catch (err) {
            toast.error('Failed to update credentials', { id: t });
        } finally {
            setLoading(false);
        }
    };

    const handleHotelSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const t = toast.loading('Persisting hotel configuration...');
        try {
            const res = await api.put('/hotel', hotelData);
            updateUser({ 
                ...user, 
                hotel_name: res.data.name, 
                hotel_address: res.data.address,
                upi_id: res.data.upi_id, 
                gst_percentage: res.data.gst_percentage,
                printer_size: res.data.printer_size,
                billing_method: res.data.billing_method
            });
            toast.success('Hotel configuration persisted!', { id: t });
        } catch (err) {
            console.error(err);
            toast.error('Failed to update hotel settings. Check all fields.', { id: t });
        } finally {
            setLoading(false);
        }
    };

    return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '100px', overflow: 'hidden' }}>
            
            {/* Security Core Card */}
            <div style={{ width: '100%' }}>
                <div 
                    onClick={() => setShowSecurityCore(!showSecurityCore)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showSecurityCore ? '12px' : '0', cursor: 'pointer', backgroundColor: 'var(--bg-card)', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--border-rgba-05)', transition: 'all 0.2s' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <UserCircle size={22} style={{ color: themeColor }} />
                        <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Security Core</h2>
                    </div>
                    <ChevronDown 
                        size={20} 
                        style={{ 
                            color: 'var(--text-muted)', 
                            transform: showSecurityCore ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                        }} 
                    />
                </div>
                {showSecurityCore && (
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-rgba-05)' }}>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>IDENTITY NAME</label>
                              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500 }} />
                           </div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>EMAIL PROTOCOL</label>
                              <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500 }} />
                           </div>
                           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                               <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="New Passcode" style={{padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500 }} />
                               <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} placeholder="Confirm" style={{padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500 }} />
                           </div>
                           <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: themeColor, color: 'white', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', boxShadow: `0 10px 20px ${themeColor}20`, width: 'fit-content' }}>
                               <Save size={18} />
                               Update Credentials
                           </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Hotel Profile Card */}
            {isOwner && (
                <div style={{ width: '100%' }}>
                    <div 
                        onClick={() => setShowHotelProfile(!showHotelProfile)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showHotelProfile ? '12px' : '0', cursor: 'pointer', backgroundColor: 'var(--bg-card)', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--border-rgba-05)', transition: 'all 0.2s' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <LayoutPanelLeft size={22} style={{ color: '#0ea5e9' }} />
                            <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Hotel Profile</h2>
                        </div>
                        <ChevronDown 
                            size={20} 
                            style={{ 
                                color: 'var(--text-muted)', 
                                transform: showHotelProfile ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.3s ease'
                            }} 
                        />
                    </div>
                    {showHotelProfile && (
                        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-rgba-05)' }}>
                            <form onSubmit={handleHotelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>HOTEL LEGAL NAME</label>
                                        <input value={hotelData.name} onChange={e => setHotelData({...hotelData, name: e.target.value})} style={{padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500 }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>GST %</label>
                                        <input type="number" value={hotelData.gst_percentage} onChange={e => setHotelData({...hotelData, gst_percentage: e.target.value})} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: '#10b981', fontWeight: 600 }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>PHYSICAL ADDRESS</label>
                                        <input 
                                            value={hotelData.address} 
                                            onChange={e => setHotelData({ ...hotelData, address: e.target.value })} 
                                            style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500, outline: 'none' }} 
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>MOBILE NUMBER</label>
                                            <input 
                                                value={hotelData.phone} 
                                                onChange={e => setHotelData({ ...hotelData, phone: e.target.value })} 
                                                style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500, outline: 'none' }} 
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>HOTEL EMAIL</label>
                                            <input 
                                                value={hotelData.email} 
                                                onChange={e => setHotelData({ ...hotelData, email: e.target.value })} 
                                                style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500, outline: 'none' }} 
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>UPI ID (MERCHANT)</label>
                                            <input 
                                                value={hotelData.upi_id} 
                                                onChange={e => setHotelData({ ...hotelData, upi_id: e.target.value })} 
                                                style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500, outline: 'none' }} 
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>FSSAI NUMBER</label>
                                            <input 
                                                value={hotelData.fssai_number} 
                                                onChange={e => setHotelData({ ...hotelData, fssai_number: e.target.value })} 
                                                style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500, outline: 'none' }} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#0ea5e9', color: 'white', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', width: 'fit-content', marginTop: '8px' }}>
                                    <Save size={18} />
                                    Save Profile Settings
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}

            {/* Physical Offline Printers Management */}
            {isOwner && (
                <div style={{ width: '100%' }}>
                    <div 
                        onClick={() => setShowPrinters(!showPrinters)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPrinters ? '12px' : '0', cursor: 'pointer', backgroundColor: 'var(--bg-card)', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--border-rgba-05)', transition: 'all 0.2s' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Printer size={22} style={{ color: '#10b981' }} />
                            <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Offline Physical Printers</h2>
                        </div>
                        <ChevronDown 
                            size={20} 
                            style={{ 
                                color: 'var(--text-muted)', 
                                transform: showPrinters ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.3s ease'
                            }} 
                        />
                    </div>
                    {showPrinters && (
                        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-rgba-05)' }}>
                            <form onSubmit={handlePrinterConfigSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)' }}>
                                    <h3 style={{fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                                        Bluetooth Billing Printer
                                    </h3>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>SELECT PAIRED BLUETOOTH PRINTER</label>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <select 
                                                value={printerConfig.billing.printerName} 
                                                onChange={e => setPrinterConfig({
                                                    ...printerConfig,
                                                    billing: { ...printerConfig.billing, printerName: e.target.value }
                                                })}
                                                style={{width: '100%', padding: '10px 14px', paddingRight: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 600, appearance: 'none', outline: 'none' }}
                                            >
                                                <option value="">-- Select Paired Printer --</option>
                                                {installedPrinters.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={18} style={{ position: 'absolute', right: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>PAPER ROLL SIZE</label>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <select 
                                                value={printerConfig.billing.paperSize || '80mm'} 
                                                onChange={e => setPrinterConfig({
                                                    ...printerConfig,
                                                    billing: { ...printerConfig.billing, paperSize: e.target.value }
                                                })}
                                                style={{width: '100%', padding: '10px 14px', paddingRight: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 600, appearance: 'none', outline: 'none' }}
                                            >
                                                <option value="80mm">Standard Receipt (80mm)</option>
                                                <option value="58mm">Compact Receipt (58mm)</option>
                                            </select>
                                            <ChevronDown size={18} style={{ position: 'absolute', right: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                        <button 
                                            type="button"
                                            onClick={handleTestPrint}
                                            style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', border: '1px solid rgba(14, 165, 233, 0.2)', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            🖨️ Send Test Print Receipt
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={fetchInstalledPrinters}
                                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            🔄 Refresh Paired List
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}>
                                    <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', width: 'fit-content' }}>
                                        <Save size={18} />
                                        Save Printer Settings
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}
            {/* Staff Section */}
            {isOwner && kotEnabled && (
                <div style={{ width: '100%' }}>
                    <div 
                        onClick={() => setShowStaffSection(!showStaffSection)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showStaffSection ? '12px' : '0', cursor: 'pointer', backgroundColor: 'var(--bg-card)', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--border-rgba-05)', transition: 'all 0.2s' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Users size={22} style={{ color: '#f59e0b' }} />
                            <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Add New Staff</h2>
                        </div>
                        <ChevronDown 
                            size={20} 
                            style={{ 
                                color: 'var(--text-muted)', 
                                transform: showStaffSection ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.3s ease'
                            }} 
                        />
                    </div>
                    
                    {showStaffSection && (
                        <div className="responsive-grid-12" style={{ gap: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-rgba-05)' }}>
                            <div style={{ gridColumn: 'span 5', backgroundColor: 'var(--bg-base)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-rgba-05)' }}>
                                <h3 style={{fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Hire New Staff</h3>
                                <form onSubmit={handleHiring} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <input required placeholder="Staff Name" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} style={{padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }} />
                                    <input required type="email" placeholder="Login Email" value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} style={{padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }} />
                                    <input required type="password" placeholder="Initial Passcode" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} style={{padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }} />
                                    <button type="submit" disabled={hiring} style={{ backgroundColor: '#f59e0b', color: 'white', padding: '12px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', border: 'none' }}>Onboard Staff</button>
                                </form>
                            </div>
                            <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {staff.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-base)', borderRadius: '12px', border: '2px dashed var(--bg-border)' }}>No active waitstaff protocol</div>
                                ) : (
                                    staff.map(s => (
                                        <div key={s.id} style={{ padding: '12px 16px', backgroundColor: 'var(--bg-base)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div>
                                                <div style={{color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>{s.name}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{s.email}</div>
                                            </div>
                                            <button onClick={() => removeStaff(s.id)} style={{ color: '#f43f5e', padding: '12px', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={24} /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* System Add-ons Section */}
            {isOwner && (
                <div style={{ width: '100%' }}>
                    <div 
                        onClick={() => setShowModules(!showModules)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showModules ? '12px' : '0', cursor: 'pointer', backgroundColor: 'var(--bg-card)', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--border-rgba-05)', transition: 'all 0.2s' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={22} style={{ color: '#f43f5e' }} />
                            <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>System Modules & Licensing</h2>
                        </div>
                        <ChevronDown 
                            size={20} 
                            style={{ 
                                color: 'var(--text-muted)', 
                                transform: showModules ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.3s ease'
                            }} 
                        />
                    </div>
                    {showModules && (
                        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-rgba-05)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* WhatsApp Billing Module */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '650px' }}>
                                    <h3 style={{fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>WhatsApp Billing</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: '1.6', marginTop: '4px' }}>
                                        Enable customer mobile entry and direct bill sharing via WhatsApp.
                                        This module requires a passcode to unlock.
                                    </p>
                                </div>
                                
                                {/* Toggle / Radio Control */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                                        <input 
                                            type="radio" 
                                            name="whatsAppBillingModule"
                                            checked={!whatsAppBillingEnabled} 
                                            onChange={() => handleToggleWhatsAppBilling(false)}
                                            style={{ accentColor: '#f43f5e', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        Disabled
                                    </label>
                                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                                        <input 
                                            type="radio" 
                                            name="whatsAppBillingModule"
                                            checked={whatsAppBillingEnabled} 
                                            onChange={() => handleToggleWhatsAppBilling(true)}
                                            style={{ accentColor: '#10b981', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        Enabled
                                    </label>
                                </div>
                            </div>

                            {/* Token Counter Module */}
                            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-rgba-05)' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '650px' }}>
                                    <h3 style={{fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Token Counter</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: '1.6', marginTop: '4px' }}>
                                        Enable token counters on the dashboard. Receipts printed from token counters will only print items list and grand totals.
                                        This module requires a passcode to unlock.
                                    </p>
                                </div>
                                
                                {/* Toggle / Radio Control */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                                        <input 
                                            type="radio" 
                                            name="tokenCounterModule"
                                            checked={!tokenCounterEnabled} 
                                            onChange={() => handleToggleTokenCounter(false)}
                                            style={{ accentColor: '#f43f5e', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        Disabled
                                    </label>
                                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                                        <input 
                                            type="radio" 
                                            name="tokenCounterModule"
                                            checked={tokenCounterEnabled} 
                                            onChange={() => handleToggleTokenCounter(true)}
                                            style={{ accentColor: '#10b981', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        Enabled
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
            </div>
        )}

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
                 <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>BestBill Identity Protection — Secure Role-Based Access Control Active</p>
            </div>

            {/* Lodging Activation Modal */}
            {showLodgingModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowLodgingModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '36px', border: '1px solid var(--bg-border)', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={28} style={{ color: lodgingModalMode === 'enable' ? '#10b981' : '#f43f5e' }} />
                            <h3 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                                {lodgingModalMode === 'enable' ? 'Activate Lodging Module' : 'Deactivate Lodging Module'}
                            </h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, margin: 0, lineHeight: '1.6' }}>
                            {lodgingModalMode === 'enable'
                                ? 'Enter the Premium Activation License Password to unlock Lodging & Room Management.'
                                : 'Are you sure you want to deactivate Lodging & Room Management? Please enter the license password to confirm deactivation. Rooms and guest portals will be hidden.'
                            }
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900 }}>
                                {lodgingModalMode === 'enable' ? 'ACTIVATION PASSWORD' : 'DEACTIVATION PASSWORD'}
                            </label>
                            <input
                                type="password"
                                value={lodgingPassword}
                                onChange={e => setLodgingPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLodgingModalSubmit()}
                                placeholder={lodgingModalMode === 'enable' ? "Enter activation password" : "Enter deactivation password"}
                                autoFocus
                                style={{padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '15px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                onClick={() => setShowLodgingModal(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            >Cancel</button>
                            <button
                                onClick={handleLodgingModalSubmit}
                                style={{flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: lodgingModalMode === 'enable' ? '#10b981' : '#f43f5e', color: 'var(--text-primary)', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: lodgingModalMode === 'enable' ? '0 8px 20px rgba(16,185,129,0.3)' : '0 8px 20px rgba(244,63,94,0.3)' }}
                            >{lodgingModalMode === 'enable' ? 'Unlock & Activate' : 'Confirm Deactivate'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* KOT Activation Modal */}
            {showKotModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowKotModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '36px', border: '1px solid var(--bg-border)', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={28} style={{ color: kotModalMode === 'enable' ? '#10b981' : '#f43f5e' }} />
                            <h3 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                                {kotModalMode === 'enable' ? 'Activate KOT Module' : 'Deactivate KOT Module'}
                            </h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, margin: 0, lineHeight: '1.6' }}>
                            {kotModalMode === 'enable'
                                ? 'Enter the Premium Activation License Password to unlock Kitchen Order Tickets and Waitstaff routing.'
                                : 'Are you sure you want to deactivate the KOT Module? Please enter the license password to confirm deactivation. Kitchen printing and waitstaff functions will be disabled.'
                            }
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900 }}>
                                {kotModalMode === 'enable' ? 'ACTIVATION PASSWORD' : 'DEACTIVATION PASSWORD'}
                            </label>
                            <input
                                type="password"
                                value={kotPassword}
                                onChange={e => setKotPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleKotModalSubmit()}
                                placeholder={kotModalMode === 'enable' ? "Enter activation password" : "Enter deactivation password"}
                                autoFocus
                                style={{padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '15px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                onClick={() => setShowKotModal(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            >Cancel</button>
                            <button
                                onClick={handleKotModalSubmit}
                                style={{flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: kotModalMode === 'enable' ? '#10b981' : '#f43f5e', color: 'var(--text-primary)', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: kotModalMode === 'enable' ? '0 8px 20px rgba(16,185,129,0.3)' : '0 8px 20px rgba(244,63,94,0.3)' }}
                            >{kotModalMode === 'enable' ? 'Unlock & Activate' : 'Confirm Deactivate'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* WhatsApp Billing Activation Modal */}
            {showWhatsAppBillingModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowWhatsAppBillingModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '36px', border: '1px solid var(--bg-border)', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={28} style={{ color: whatsAppBillingModalMode === 'enable' ? '#10b981' : '#f43f5e' }} />
                            <h3 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                                {whatsAppBillingModalMode === 'enable' ? 'Activate WhatsApp Billing' : 'Deactivate WhatsApp Billing'}
                            </h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, margin: 0, lineHeight: '1.6' }}>
                            {whatsAppBillingModalMode === 'enable'
                                ? 'Enter the license passcode to unlock and enable WhatsApp Billing.'
                                : 'Are you sure you want to deactivate WhatsApp Billing? Please enter the passcode to confirm deactivation.'
                            }
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900 }}>
                                {whatsAppBillingModalMode === 'enable' ? 'ACTIVATION PASSWORD' : 'DEACTIVATION PASSWORD'}
                            </label>
                            <input
                                type="password"
                                value={whatsAppBillingPassword}
                                onChange={e => setWhatsAppBillingPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleWhatsAppBillingModalSubmit()}
                                placeholder={whatsAppBillingModalMode === 'enable' ? "Enter passcode" : "Enter passcode"}
                                autoFocus
                                style={{padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '15px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                onClick={() => setShowWhatsAppBillingModal(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            >Cancel</button>
                            <button
                                onClick={handleWhatsAppBillingModalSubmit}
                                style={{flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: whatsAppBillingModalMode === 'enable' ? '#10b981' : '#f43f5e', color: 'var(--text-primary)', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: whatsAppBillingModalMode === 'enable' ? '0 8px 20px rgba(16,185,129,0.3)' : '0 8px 20px rgba(244,63,94,0.3)' }}
                            >{whatsAppBillingModalMode === 'enable' ? 'Unlock & Activate' : 'Confirm Deactivate'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inventory Activation Modal */}
            {showInventoryModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowInventoryModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '36px', border: '1px solid var(--bg-border)', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={28} style={{ color: inventoryModalMode === 'enable' ? '#10b981' : '#f43f5e' }} />
                            <h3 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                                {inventoryModalMode === 'enable' ? 'Activate Inventory Module' : 'Deactivate Inventory Module'}
                            </h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, margin: 0, lineHeight: '1.6' }}>
                            {inventoryModalMode === 'enable'
                                ? 'Enter the license passcode to unlock and enable Inventory Management.'
                                : 'Are you sure you want to deactivate Inventory Management? Please enter the passcode to confirm deactivation.'
                            }
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900 }}>
                                {inventoryModalMode === 'enable' ? 'ACTIVATION PASSWORD' : 'DEACTIVATION PASSWORD'}
                            </label>
                            <input
                                type="password"
                                value={inventoryPassword}
                                onChange={e => setInventoryPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleInventoryModalSubmit()}
                                placeholder={inventoryModalMode === 'enable' ? "Enter passcode" : "Enter passcode"}
                                autoFocus
                                style={{padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '15px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                onClick={() => setShowInventoryModal(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            >Cancel</button>
                            <button
                                onClick={handleInventoryModalSubmit}
                                style={{flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: inventoryModalMode === 'enable' ? '#10b981' : '#f43f5e', color: 'var(--text-primary)', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: inventoryModalMode === 'enable' ? '0 8px 20px rgba(16,185,129,0.3)' : '0 8px 20px rgba(244,63,94,0.3)' }}
                            >{inventoryModalMode === 'enable' ? 'Unlock & Activate' : 'Confirm Deactivate'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Token Counter Activation Modal */}
            {showTokenCounterModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowTokenCounterModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '36px', border: '1px solid var(--bg-border)', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={28} style={{ color: tokenCounterModalMode === 'enable' ? '#10b981' : '#f43f5e' }} />
                            <h3 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                                {tokenCounterModalMode === 'enable' ? 'Activate Token Counter Module' : 'Deactivate Token Counter Module'}
                            </h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, margin: 0, lineHeight: '1.6' }}>
                            {tokenCounterModalMode === 'enable'
                                ? 'Enter the license passcode to unlock and enable Token Counter.'
                                : 'Are you sure you want to deactivate Token Counter? Please enter the passcode to confirm deactivation.'
                            }
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900 }}>
                                {tokenCounterModalMode === 'enable' ? 'ACTIVATION PASSWORD' : 'DEACTIVATION PASSWORD'}
                            </label>
                            <input
                                type="password"
                                value={tokenCounterPassword}
                                onChange={e => setTokenCounterPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleTokenCounterModalSubmit()}
                                placeholder={tokenCounterModalMode === 'enable' ? "Enter passcode" : "Enter passcode"}
                                autoFocus
                                style={{padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '15px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                onClick={() => setShowTokenCounterModal(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            >Cancel</button>
                            <button
                                onClick={handleTokenCounterModalSubmit}
                                style={{flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: tokenCounterModalMode === 'enable' ? '#10b981' : '#f43f5e', color: 'var(--text-primary)', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: tokenCounterModalMode === 'enable' ? '0 8px 20px rgba(16,185,129,0.3)' : '0 8px 20px rgba(244,63,94,0.3)' }}
                            >{tokenCounterModalMode === 'enable' ? 'Unlock & Activate' : 'Confirm Deactivate'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Simple KOT Activation Modal */}
            {showSimpleKotModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowSimpleKotModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '36px', border: '1px solid var(--bg-border)', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={28} style={{ color: simpleKotModalMode === 'enable' ? '#10b981' : '#f43f5e' }} />
                            <h3 style={{fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                                {simpleKotModalMode === 'enable' ? 'Activate Simple KOT Module' : 'Deactivate Simple KOT Module'}
                            </h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, margin: 0, lineHeight: '1.6' }}>
                            {simpleKotModalMode === 'enable'
                                ? 'Enter the license passcode to unlock and enable Simple KOT (Send to Kitchen).'
                                : 'Are you sure you want to deactivate Simple KOT? Please enter the passcode to confirm deactivation.'
                            }
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900 }}>
                                {simpleKotModalMode === 'enable' ? 'ACTIVATION PASSWORD' : 'DEACTIVATION PASSWORD'}
                            </label>
                            <input
                                type="password"
                                value={simpleKotPassword}
                                onChange={e => setSimpleKotPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSimpleKotModalSubmit()}
                                placeholder="Enter passcode"
                                autoFocus
                                style={{padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '15px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                onClick={() => setShowSimpleKotModal(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            >Cancel</button>
                            <button
                                onClick={handleSimpleKotModalSubmit}
                                style={{flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: simpleKotModalMode === 'enable' ? '#10b981' : '#f43f5e', color: 'var(--text-primary)', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: simpleKotModalMode === 'enable' ? '0 8px 20px rgba(16,185,129,0.3)' : '0 8px 20px rgba(244,63,94,0.3)' }}
                            >{simpleKotModalMode === 'enable' ? 'Unlock & Activate' : 'Confirm Deactivate'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
