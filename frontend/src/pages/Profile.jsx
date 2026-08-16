import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { User, Mail, Lock, ShieldCheck, Save, Eye, EyeOff, LayoutPanelLeft, UserCircle, Wallet, Users, Trash2, UserPlus, Fingerprint, MapPin, Percent, Upload, Image as ImageIcon, Printer, ChevronDown, Globe, Download, QrCode, Key, RotateCw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { BluetoothPrinterService, formatBill } from '../services/bluetoothPrinterService';
import * as licenseService from '../services/localLicenseService';
import { getLocalIpAddress } from '../services/socketService';
import ConfirmModal from '../components/ConfirmModal';

const Profile = () => {
    const { user, updateUser } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const [showLanguageSettings, setShowLanguageSettings] = useState(true);
    const isAdmin = user?.role === 'admin';
    const isOwner = user?.role === 'owner';
    const themeColor = isAdmin ? '#10b981' : '#0ea5e9';
    const serverUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'https://bestbill-backend-174132084209.us-central1.run.app';

    const [localServerIp, setLocalServerIp] = useState('127.0.0.1');

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
        logo_url: user?.logo_url || localStorage.getItem('cfg_hotel_logo_url') || '',
        fssai_number: '',
        email: '',
        phone: ''
    });

    const [logoPrintingEnabled, setLogoPrintingEnabled] = useState(
        localStorage.getItem('cfg_logo_printing_enabled') === 'true'
    );
    const [logoUrl, setLogoUrl] = useState(
        user?.logo_url || localStorage.getItem('cfg_hotel_logo_url') || ''
    );
    const [logoSize, setLogoSize] = useState(
        localStorage.getItem('cfg_logo_size') || '300'
    );

    const handleToggleLogoPrinting = (enabled) => {
        setLogoPrintingEnabled(enabled);
        localStorage.setItem('cfg_logo_printing_enabled', String(enabled));
        toast.success(enabled ? 'Logo Printing Enabled on Bill' : 'Logo Printing Disabled');
    };

    const handleLogoSizeChange = (size) => {
        setLogoSize(size);
        localStorage.setItem('cfg_logo_size', size);
        toast.success(`Logo size set to ${size === '180' ? 'Small (180px)' : 'Large (300px)'}`);
    };

    const handleLogoFileUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            return toast.error('File size must be under 3MB');
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 200;
                const aspect = img.height / img.width;
                const width = Math.min(maxWidth, img.width);
                const height = Math.round(width * aspect);

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/png');
                setLogoUrl(compressedDataUrl);
                localStorage.setItem('cfg_hotel_logo_url', compressedDataUrl);
                setHotelData(prev => ({ ...prev, logo_url: compressedDataUrl }));
                toast.success('Hotel Logo Uploaded & Saved!');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const [staff, setStaff] = useState([]);
    const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '' });
    const [hiring, setHiring] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [printerConfig, setPrinterConfig] = useState({
        billing: { type: 'bluetooth', printerName: '', ip: '', port: 9100, paperSize: '58mm', charLimit: 32 },
        kot: { type: 'bluetooth', printerName: '', ip: '', port: 9100, paperSize: '58mm', charLimit: 32 }
    });
    const [installedPrinters, setInstalledPrinters] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualMacInput, setManualMacInput] = useState('');
    const [manualKotMacInput, setManualKotMacInput] = useState('');
    const [availableIps, setAvailableIps] = useState([]);
    const [selectedGuestIp, setSelectedGuestIp] = useState('');
    const [billingCustomActive, setBillingCustomActive] = useState(false);
    const [kitchenCustomActive, setKitchenCustomActive] = useState(false);
    const [showPrinters, setShowPrinters] = useState(false);

    // Cloud Sync State
    const [cloudSyncEnabled, setCloudSyncEnabled] = useState(localStorage.getItem('cfg_cloud_sync_enabled') === 'true');
    const [cloudSyncEmail, setCloudSyncEmail] = useState(localStorage.getItem('cfg_cloud_sync_email') || '');
    const [cloudSyncPassword, setCloudSyncPassword] = useState(localStorage.getItem('cfg_cloud_sync_password') || '');
    const [cloudSyncHotelCode, setCloudSyncHotelCode] = useState(localStorage.getItem('cfg_cloud_sync_hotel_code') || 'HOTEL_001');
    const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('cfg_last_cloud_sync_time') || '');
    const [isManualSyncing, setIsManualSyncing] = useState(false);
    
    // Bluetooth Printer Connection Status States
    const [billingConnected, setBillingConnected] = useState(false);
    const [kotConnected, setKotConnected] = useState(false);

    // Modules
    const [showModules, setShowModules] = useState(false);

    // License & Plan Update State
    const [licenseDetails, setLicenseDetails] = useState(null);
    const [showLicensePasscodeModal, setShowLicensePasscodeModal] = useState(false);
    const [licensePasscode, setLicensePasscode] = useState('');
    const [showLicenseKeyModal, setShowLicenseKeyModal] = useState(false);
    const [newLicenseKey, setNewLicenseKey] = useState('');
    
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

    // Cloud Sync Setup Modal State
    const [showCloudSyncPassModal, setShowCloudSyncPassModal] = useState(false);
    const [cloudSyncModulePassword, setCloudSyncModulePassword] = useState('');
    const [showCloudSyncSetupModal, setShowCloudSyncSetupModal] = useState(false);

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

    // Cancel Orders State
    const [cancelOrdersEnabled, setCancelOrdersEnabled] = useState(false);

    // Waiter Mobile Access State
    const [waiterModuleEnabled, setWaiterModuleEnabled] = useState(false);

    useEffect(() => {
        fetchLicenseDetails();
        getLocalIpAddress().then(ip => setLocalServerIp(ip)).catch(() => {});
        if (isOwner) {
            fetchStaff();
            fetchHotelDetails();
            fetchPrinterConfig();
            fetchInstalledPrinters();
            fetchAvailableIps();
            fetchKotStatus();
            fetchWhatsAppBillingStatus();
            fetchInventoryStatus();
            fetchTokenCounterStatus();
            fetchSimpleKotStatus();
            fetchWaiterModuleStatus();
            fetchCancelOrdersStatus();
        }
    }, [isOwner]);

    const fetchCancelOrdersStatus = async () => {
        try {
            const res = await api.get('/hotel/cancel-orders-status');
            const isEnabled = !!res.data.cancelOrdersEnabled;
            setCancelOrdersEnabled(isEnabled);
            updateUser({ cancelOrdersEnabled: isEnabled });
        } catch (err) {
            console.error('Failed to fetch cancel orders status', err);
        }
    };

    const handleToggleCancelOrders = async (shouldEnable) => {
        try {
            const res = await api.post('/hotel/toggle-cancel-orders', { enabled: shouldEnable });
            if (res.data.success) {
                setCancelOrdersEnabled(shouldEnable);
                updateUser({ cancelOrdersEnabled: shouldEnable });
                toast.success(`Cancel Order Management ${shouldEnable ? 'activated' : 'deactivated'}!`);
            }
        } catch (err) {
            toast.error('Failed to toggle Cancel Order Management');
        }
    };

    const fetchWaiterModuleStatus = async () => {
        try {
            const res = await api.get('/hotel/waiter-module-status');
            const isEnabled = !!res.data.waiterModuleEnabled || !!res.data.enabled;
            setWaiterModuleEnabled(isEnabled);
            updateUser({ waiterModuleEnabled: isEnabled });
        } catch (err) {
            console.error('Failed to fetch waiter module status', err);
        }
    };

    const handleToggleWaiterModule = async (shouldEnable) => {
        try {
            const res = await api.post('/hotel/toggle-waiter-module', { enabled: shouldEnable });
            if (res.data.success) {
                setWaiterModuleEnabled(shouldEnable);
                updateUser({ waiterModuleEnabled: shouldEnable });
                if (shouldEnable) {
                    import('../services/socketService').then(ss => ss.initSocket(user?.hotel_id));
                    toast.success('Waiter Mobile Access Module Activated!');
                } else {
                    import('../services/socketService').then(ss => ss.stopSocket());
                    toast.success('Waiter Mobile Access Module Deactivated.');
                }
            }
        } catch (err) {
            toast.error('Failed to toggle Waiter Mobile Access Module');
        }
    };

    const fetchLicenseDetails = async () => {
        try {
            const details = await licenseService.getLicenseDetails();
            setLicenseDetails(details);
        } catch (err) {
            console.error("Failed to fetch license details", err);
        }
    };

    const handleStartLicenseUpdate = () => {
        setLicensePasscode('');
        setShowLicensePasscodeModal(true);
    };

    const handleVerifyLicensePasscode = () => {
        if (licensePasscode === '981267') {
            setShowLicensePasscodeModal(false);
            setLicensePasscode('');
            setNewLicenseKey('');
            setShowLicenseKeyModal(true);
            toast.success("Passcode verified! You can now update your License Key.");
        } else {
            toast.error("Incorrect passcode. Access denied.");
        }
    };

    const handleActivateNewLicenseKey = async () => {
        if (!newLicenseKey.trim()) {
            toast.error("Please enter a license key.");
            return;
        }
        const keyToUse = newLicenseKey.trim();
        const success = await licenseService.setLicenseKey(keyToUse);
        if (success) {
            toast.success("License key updated successfully! Your subscription plan has been upgraded.");
            setShowLicenseKeyModal(false);
            setNewLicenseKey('');
            await fetchLicenseDetails();
            window.dispatchEvent(new Event('storage'));
        } else {
            toast.error("Invalid license key. Please check key for current month/year.");
        }
    };


    const handleToggleKot = async (shouldEnable) => {
        try {
            const res = await api.post('/hotel/toggle-kot', { enabled: shouldEnable });
            if (res.data.success) {
                setKotEnabled(shouldEnable);
                updateUser({ kotEnabled: shouldEnable });
                toast.success(shouldEnable ? "KOT Module activated!" : "KOT Module deactivated.");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to toggle KOT Module");
        }
    };

    const fetchKotStatus = async () => {
        try {
            const res = await api.get('/hotel/kot-status');
            const isEnabled = res.data.kotEnabled !== undefined ? res.data.kotEnabled : !!res.data.enabled;
            setKotEnabled(isEnabled);
            updateUser({ kotEnabled: isEnabled });
        } catch (err) {
            console.error('Failed to fetch KOT status', err);
        }
    };

    const fetchWhatsAppBillingStatus = async () => {
        try {
            const res = await api.get('/hotel/whatsapp-billing-status');
            const isEnabled = res.data.whatsAppBillingEnabled !== undefined ? res.data.whatsAppBillingEnabled : !!res.data.enabled;
            setWhatsAppBillingEnabled(isEnabled);
            updateUser({ whatsAppBillingEnabled: isEnabled });
        } catch (err) {
            console.error('Failed to fetch WhatsApp billing status', err);
        }
    };

    const handleToggleWhatsAppBilling = async (shouldEnable) => {
        try {
            const res = await api.post('/hotel/toggle-whatsapp-billing', { enabled: shouldEnable });
            if (res.data.success) {
                setWhatsAppBillingEnabled(shouldEnable);
                updateUser({ whatsAppBillingEnabled: shouldEnable });
                toast.success(shouldEnable ? "WhatsApp Billing activated!" : "WhatsApp Billing deactivated.");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to toggle WhatsApp Billing");
        }
    };

    const fetchInventoryStatus = async () => {
        try {
            const res = await api.get('/hotel/inventory-status');
            const isEnabled = res.data.inventoryEnabled !== undefined ? res.data.inventoryEnabled : !!res.data.enabled;
            setInventoryEnabled(isEnabled);
            updateUser({ inventoryEnabled: isEnabled });
        } catch (err) {
            console.error('Failed to fetch inventory status', err);
        }
    };

    const handleToggleInventory = async (shouldEnable) => {
        try {
            const res = await api.post('/hotel/toggle-inventory', { enabled: shouldEnable });
            if (res.data.success) {
                setInventoryEnabled(shouldEnable);
                updateUser({ inventoryEnabled: shouldEnable });
                toast.success(shouldEnable ? "Inventory Management Module activated!" : "Inventory Management Module deactivated.");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to toggle Inventory Module");
        }
    };

    const fetchTokenCounterStatus = async () => {
        try {
            const res = await api.get('/hotel/token-counter-status');
            const isEnabled = res.data.tokenCounterEnabled !== undefined ? res.data.tokenCounterEnabled : !!res.data.enabled;
            setTokenCounterEnabled(isEnabled);
            updateUser({ tokenCounterEnabled: isEnabled });
        } catch (err) {
            console.error('Failed to fetch token counter status', err);
        }
    };

    const fetchSimpleKotStatus = async () => {
        try {
            const res = await api.get('/hotel/simple-kot-status');
            const isEnabled = res.data.simpleKotEnabled !== undefined ? res.data.simpleKotEnabled : !!res.data.enabled;
            setSimpleKotEnabled(isEnabled);
            updateUser({ simpleKotEnabled: isEnabled });
        } catch (err) {
            console.error('Failed to fetch simple KOT status', err);
        }
    };

    const handleToggleTokenCounter = async (shouldEnable) => {
        try {
            const res = await api.post('/hotel/toggle-token-counter', { enabled: shouldEnable });
            if (res.data.success) {
                setTokenCounterEnabled(shouldEnable);
                updateUser({ tokenCounterEnabled: shouldEnable });
                toast.success(shouldEnable ? "Token Counter module activated!" : "Token Counter module deactivated.");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to toggle Token Counter Module");
        }
    };

    const handleToggleSimpleKot = async (shouldEnable) => {
        try {
            const res = await api.post('/hotel/toggle-simple-kot', { enabled: shouldEnable });
            if (res.data.success) {
                setSimpleKotEnabled(shouldEnable);
                updateUser({ simpleKotEnabled: shouldEnable });
                toast.success(shouldEnable ? "Simple KOT module activated!" : "Simple KOT module deactivated.");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to toggle Simple KOT Module");
        }
    };

    const fetchInstalledPrinters = async () => {
        try {
            const devices = await BluetoothPrinterService.listPairedDevices();
            setInstalledPrinters(devices || []);
            if (!devices || devices.length === 0) {
                toast.info('No paired Bluetooth printers found. Ensure Bluetooth is ON in Android Settings.');
            }
        } catch (err) {
            console.error('Failed to fetch Bluetooth printers', err);
        }
    };

    const scanUnpairedPrinters = async () => {
        setIsScanning(true);
        const tId = toast.loading('Scanning for available Bluetooth printers...');
        try {
            const discovered = await BluetoothPrinterService.discoverUnpairedDevices();
            setIsScanning(false);
            if (discovered && discovered.length > 0) {
                toast.success(`Discovered ${discovered.length} device(s)`, { id: tId });
                setInstalledPrinters(prev => {
                    const combined = [...prev];
                    discovered.forEach(d => {
                        if (!combined.some(existing => existing.id === d.id)) {
                            combined.push(d);
                        }
                    });
                    return combined;
                });
            } else {
                toast.error('No Bluetooth devices discovered. Make sure printer is powered on and in range.', { id: tId });
            }
        } catch (err) {
            setIsScanning(false);
            toast.error('Discovery scan error: ' + err.message, { id: tId });
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
            if (!localStorage.getItem('cfg_printer_size_migrated_v3')) {
                localStorage.setItem('cfg_printer_size', '58mm');
                localStorage.setItem('cfg_printer_size_migrated_v3', 'true');
            }
            const billingDev = localStorage.getItem('cfg_bluetooth_mac') || '';
            const billingSize = localStorage.getItem('cfg_printer_size') || '58mm';
            const kotDev = localStorage.getItem('cfg_bluetooth_mac_kot') || '';
            const kotSize = localStorage.getItem('cfg_printer_size_kot') || billingSize;

            setPrinterConfig({
                billing: { type: 'bluetooth', printerName: billingDev, ip: '', port: 9100, paperSize: billingSize, charLimit: 32 },
                kot: { type: 'bluetooth', printerName: kotDev, ip: '', port: 9100, paperSize: kotSize, charLimit: 32 }
            });
            checkPrinterStatuses(billingDev, kotDev);
        } catch (err) {
            console.error('Failed to load configs', err);
        }
    };

    const checkPrinterStatuses = async (bMacInput, kMacInput) => {
        const bMac = bMacInput !== undefined ? bMacInput : printerConfig.billing.printerName;
        const kMac = kMacInput !== undefined ? kMacInput : (printerConfig.kot.printerName || bMac);

        if (bMac) {
            const isBConnected = await BluetoothPrinterService.checkPrinterConnection(bMac);
            setBillingConnected(isBConnected);
        } else {
            setBillingConnected(false);
        }

        if (kMac) {
            const isKConnected = await BluetoothPrinterService.checkPrinterConnection(kMac);
            setKotConnected(isKConnected);
        } else {
            setKotConnected(false);
        }
    };

    useEffect(() => {
        if (showPrinters) {
            checkPrinterStatuses();
        }
    }, [showPrinters, printerConfig.billing.printerName, printerConfig.kot.printerName]);

    const handlePrinterConfigSubmit = async (e) => {
        e.preventDefault();
        try {
            const selectedBillingMac = manualMacInput.trim() || printerConfig.billing.printerName;
            if (!selectedBillingMac) {
                toast.error('Please select or enter a valid Billing Bluetooth printer device / MAC address');
                return;
            }
            const billingSize = printerConfig.billing.paperSize || '58mm';
            const selectedKotMac = manualKotMacInput.trim() || printerConfig.kot.printerName;
            const kotSize = printerConfig.kot.paperSize || billingSize;

            localStorage.setItem('cfg_bluetooth_mac', selectedBillingMac);
            localStorage.setItem('cfg_printer_size', billingSize);

            if (selectedKotMac) {
                localStorage.setItem('cfg_bluetooth_mac_kot', selectedKotMac);
            } else {
                localStorage.removeItem('cfg_bluetooth_mac_kot');
            }
            localStorage.setItem('cfg_printer_size_kot', kotSize);

            await api.post('/hotel/printers-config', {
                printers: {
                    billing: { deviceName: selectedBillingMac, paperSize: billingSize },
                    kot: { deviceName: selectedKotMac || selectedBillingMac, paperSize: kotSize }
                }
            });
            toast.success('Printer configuration saved successfully!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update printer configurations');
        }
    };

    const handleTestPrintBilling = async () => {
        try {
            const sampleItems = [
                { name: 'Butter Chicken', price: 280.00, qty: 1 },
                { name: 'Butter Naan', price: 40.00, qty: 3 },
                { name: 'Paneer Tikka', price: 220.00, qty: 1 },
                { name: 'Cold Coffee', price: 70.00, qty: 2 }
            ];
            const subtotal = sampleItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
            const gstPct = hotelData.gst_percentage !== undefined ? Number(hotelData.gst_percentage) : 5;
            const gst = (subtotal * gstPct) / 100;
            const finalAmount = subtotal + gst;

            const testPayload = {
                type: 'FINAL_BILL',
                billId: 9999,
                table: 'Table 1 (Billing Test)',
                subtotal, gst, finalAmount,
                discountPercentage: 0,
                items: sampleItems,
                hotelName: hotelData.name || 'Sample Hotel',
                hotelPhone: hotelData.phone || '9999999999',
                hotelLocation: hotelData.address || 'Sample Location',
                upiId: hotelData.upi_id || '',
                isPaid: false,
                gst_percentage: gstPct
            };

            const size = printerConfig.billing.paperSize || '58mm';
            const bytes = await formatBill(testPayload, size);
            
            const tId = toast.loading('Sending test receipt to Billing Printer...');
            const targetMac = BluetoothPrinterService.getSelectedPrinter('billing');
            const success = await BluetoothPrinterService.printData(bytes, targetMac);
            if (success) {
                toast.success('Billing Printer Test Print Successful!', { id: tId });
            } else {
                toast.error('Billing Printer Test Print failed.', { id: tId });
            }
        } catch (err) {
            toast.error('Test print error: ' + err.message);
        }
    };

    const handleTestPrintKot = async () => {
        try {
            const sampleItems = [
                { name: 'Paneer Butter Masala', qty: 2 },
                { name: 'Garlic Roti', qty: 4 }
            ];

            const testPayload = {
                type: 'KOT',
                orderNumber: 'KOT-999',
                table: 'Table 1 (KOT Test)',
                items: sampleItems,
                waiter: user?.name || 'Staff'
            };

            const { formatKOT } = await import('../services/bluetoothPrinterService');
            const size = printerConfig.kot.paperSize || printerConfig.billing.paperSize || '58mm';
            const bytes = await formatKOT(testPayload, size);

            const tId = toast.loading('Sending test ticket to KOT Printer...');
            const targetMac = BluetoothPrinterService.getSelectedPrinter('kot');
            const success = await BluetoothPrinterService.printData(bytes, targetMac);
            if (success) {
                toast.success('KOT Printer Test Print Successful!', { id: tId });
            } else {
                toast.error('KOT Printer Test Print failed.', { id: tId });
            }
        } catch (err) {
            toast.error('KOT test print error: ' + err.message);
        }
    };

    const fetchHotelDetails = async () => {
        try {
            const res = await api.get('/hotel');
            const data = res.data || {};
            const realHotelName = data.name || user?.hotel_name || '';
            setHotelData(prev => ({
                ...prev,
                name: realHotelName,
                address: data.location || prev.address || '',
                upi_id: data.upi_id || prev.upi_id || '',
                gst_percentage: data.gst_percentage !== undefined ? data.gst_percentage : prev.gst_percentage,
                billing_method: data.billing_method || prev.billing_method || 'qz',
                logo_url: data.logo_url || prev.logo_url || '',
                fssai_number: data.fssai_number || prev.fssai_number || '',
                email: data.email || prev.email || '',
                phone: data.phone || prev.phone || ''
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
                hotel_name: hotelData.name, 
                hotel_phone: hotelData.phone,
                hotel_location: hotelData.address,
                upi_id: hotelData.upi_id, 
                gst_percentage: hotelData.gst_percentage,
                printer_size: hotelData.printer_size || user?.printer_size,
                billing_method: hotelData.billing_method || user?.billing_method
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
            
            {/* Language Settings Card */}
            <div style={{ width: '100%' }}>
                <div 
                    onClick={() => setShowLanguageSettings(!showLanguageSettings)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showLanguageSettings ? '12px' : '0', cursor: 'pointer', backgroundColor: 'var(--bg-card)', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--border-rgba-05)', transition: 'all 0.2s' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Globe size={22} style={{ color: '#8b5cf6' }} />
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            {t('profile_language_settings', 'Language Settings')}
                        </h2>
                    </div>
                    <ChevronDown 
                        size={20} 
                        style={{ 
                            color: 'var(--text-muted)', 
                            transform: showLanguageSettings ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                        }} 
                    />
                </div>
                {showLanguageSettings && (
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-rgba-05)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                {t('profile_select_language', 'Select Language')}
                            </label>
                            <select 
                                value={language} 
                                onChange={(e) => {
                                    setLanguage(e.target.value);
                                    toast.success(e.target.value === 'mr' ? 'अ‍ॅपची भाषा मराठी सेट केली आहे!' : 'Application language set to English!');
                                }}
                                style={{
                                    width: '100%',
                                    maxWidth: '400px',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    backgroundColor: 'var(--bg-base)',
                                    border: '1px solid var(--bg-border)',
                                    color: 'var(--text-primary)',
                                    fontWeight: 600,
                                    fontSize: '15px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="en">English (English)</option>
                                <option value="mr">Marathi (मराठी)</option>
                            </select>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                                {language === 'mr' ? 'भाषा बदलल्याने संपूर्ण अ‍ॅपची भाषा मराठी होईल.' : 'Selecting a language updates the user interface text across the entire application.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Core Card */}
            <div style={{ width: '100%' }}>
                <div 
                    onClick={() => setShowSecurityCore(!showSecurityCore)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showSecurityCore ? '12px' : '0', cursor: 'pointer', backgroundColor: 'var(--bg-card)', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--border-rgba-05)', transition: 'all 0.2s' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <UserCircle size={22} style={{ color: themeColor }} />
                        <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('profile_security_core', 'Security Core')}</h2>
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
                            <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('profile_hotel_profile', 'Hotel Profile')}</h2>
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
                                                type="tel"
                                                maxLength={10}
                                                value={hotelData.phone} 
                                                onChange={e => setHotelData({ ...hotelData, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} 
                                                placeholder="10-digit Mobile Number"
                                                style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500, outline: 'none' }} 
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>HOTEL EMAIL</label>
                                            <input 
                                                type="email"
                                                value={hotelData.email} 
                                                onChange={e => setHotelData({ ...hotelData, email: e.target.value.trim() })} 
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
                                                type="text"
                                                maxLength={14}
                                                value={hotelData.fssai_number} 
                                                onChange={e => setHotelData({ ...hotelData, fssai_number: e.target.value.replace(/[^0-9]/g, '').slice(0, 14) })} 
                                                style={{width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 500, outline: 'none' }} 
                                            />
                                         </div>
                                     </div>

                                    {/* Enable Logo Printing on Bill Card */}
                                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <ImageIcon size={18} style={{ color: '#10b981' }} />
                                                    Enable Hotel Logo Printing on Bill
                                                </h4>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                                                    Print your restaurant logo centered at the top of thermal printed bills.
                                                </p>
                                            </div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
                                                    <input 
                                                        type="radio" 
                                                        name="logoPrintingToggle"
                                                        checked={!logoPrintingEnabled} 
                                                        onChange={() => handleToggleLogoPrinting(false)}
                                                        style={{ accentColor: '#f43f5e', width: '16px', height: '16px', cursor: 'pointer' }}
                                                    />
                                                    Disabled
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
                                                    <input 
                                                        type="radio" 
                                                        name="logoPrintingToggle"
                                                        checked={logoPrintingEnabled} 
                                                        onChange={() => handleToggleLogoPrinting(true)}
                                                        style={{ accentColor: '#10b981', width: '16px', height: '16px', cursor: 'pointer' }}
                                                    />
                                                    Enabled
                                                </label>
                                            </div>
                                        </div>

                                        {logoPrintingEnabled && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px', borderTop: '1px solid var(--bg-border)' }}>
                                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {logoUrl ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: '#ffffff', padding: '10px', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
                                                            <img src={logoUrl} alt="Hotel Logo" style={{ maxHeight: '60px', maxWidth: '120px', objectFit: 'contain' }} />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => { setLogoUrl(''); localStorage.removeItem('cfg_hotel_logo_url'); toast.success('Logo removed'); }}
                                                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                                            >
                                                                Remove Logo
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No logo uploaded yet.</div>
                                                    )}

                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                                                        <Upload size={16} />
                                                        {logoUrl ? 'Change Logo Image' : 'Upload Hotel Logo'}
                                                        <input type="file" accept="image/*" onChange={handleLogoFileUpload} style={{ display: 'none' }} />
                                                    </label>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--bg-border)', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Printed Logo Size:</span>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                                                        <input 
                                                            type="radio" 
                                                            name="logoSizeRadio" 
                                                            value="180" 
                                                            checked={logoSize === '180'} 
                                                            onChange={() => handleLogoSizeChange('180')} 
                                                            style={{ accentColor: '#0ea5e9', width: '16px', height: '16px', cursor: 'pointer' }}
                                                        />
                                                        Small – 180px Width
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                                                        <input 
                                                            type="radio" 
                                                            name="logoSizeRadio" 
                                                            value="300" 
                                                            checked={logoSize === '300'} 
                                                            onChange={() => handleLogoSizeChange('300')} 
                                                            style={{ accentColor: '#0ea5e9', width: '16px', height: '16px', cursor: 'pointer' }}
                                                        />
                                                        Large – 300px Width (Default)
                                                    </label>
                                                </div>
                                            </div>
                                        )}
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
                            <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('profile_printers', 'Bluetooth Thermal Printers')}</h2>
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
                                    
                                    {/* Discovery Action Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                        <div>
                                            <h3 style={{fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                                                Find & Pair Bluetooth Printers
                                            </h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '2px 0 0' }}>
                                                Connect 1 printer for both Billing & KOT, or assign a separate printer for KOT.
                                            </p>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            <button 
                                                type="button"
                                                onClick={scanUnpairedPrinters}
                                                disabled={isScanning}
                                                style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                {isScanning ? '🔍 Searching Printers...' : '📡 Find Bluetooth Printer'}
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={fetchInstalledPrinters}
                                                style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                            >
                                                🔄 Refresh Device List
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--bg-border)' }}></div>

                                    {/* Billing Printer Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0ea5e9', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                1. Billing Printer Setup
                                            </h4>
                                            
                                            {/* Billing Printer Connection Indicator */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '8px', backgroundColor: printerConfig.billing.printerName ? (billingConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)') : 'rgba(148, 163, 184, 0.15)', border: `1px solid ${printerConfig.billing.printerName ? (billingConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)') : 'var(--bg-border)'}` }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: printerConfig.billing.printerName ? (billingConnected ? '#10b981' : '#ef4444') : '#94a3b8', display: 'inline-block', boxShadow: printerConfig.billing.printerName && billingConnected ? '0 0 8px #10b981' : 'none' }}></span>
                                                <span style={{ fontSize: '11px', fontWeight: 800, color: printerConfig.billing.printerName ? (billingConnected ? '#10b981' : '#f87171') : 'var(--text-muted)' }}>
                                                    {printerConfig.billing.printerName ? (billingConnected ? '🟢 Paired & Ready' : '🔴 Disconnected') : '⚪ No Device Selected'}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 }}>SELECT BILLING PRINTER</label>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <select 
                                                        value={printerConfig.billing.printerName} 
                                                        onChange={e => setPrinterConfig({
                                                            ...printerConfig,
                                                            billing: { ...printerConfig.billing, printerName: e.target.value }
                                                        })}
                                                        style={{width: '100%', padding: '10px 14px', paddingRight: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 600, appearance: 'none', outline: 'none' }}
                                                    >
                                                        <option value="">-- Select Billing Printer --</option>
                                                        {printerConfig.billing.printerName && !installedPrinters.some(p => p.id === printerConfig.billing.printerName) && (
                                                            <option value={printerConfig.billing.printerName}>{printerConfig.billing.printerName} (Saved Device)</option>
                                                        )}
                                                        {installedPrinters.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name || 'Thermal Printer'} ({p.id})</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={18} style={{ position: 'absolute', right: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 }}>BILLING RECEIPT ROLL SIZE</label>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <select 
                                                        value={printerConfig.billing.paperSize || '58mm'} 
                                                        onChange={e => setPrinterConfig({
                                                            ...printerConfig,
                                                            billing: { ...printerConfig.billing, paperSize: e.target.value }
                                                        })}
                                                        style={{width: '100%', padding: '10px 14px', paddingRight: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 600, appearance: 'none', outline: 'none' }}
                                                    >
                                                        <option value="58mm">Compact Receipt (58mm / 2 inch)</option>
                                                        <option value="80mm">Standard Receipt (80mm / 3 inch)</option>
                                                    </select>
                                                    <ChevronDown size={18} style={{ position: 'absolute', right: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--bg-border)' }}></div>

                                    {/* KOT Printer Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#f59e0b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                2. KOT Printer Setup
                                            </h4>
                                            
                                            {/* KOT Printer Connection Indicator */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '8px', backgroundColor: (printerConfig.kot.printerName || printerConfig.billing.printerName) ? ((kotConnected || billingConnected) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)') : 'rgba(148, 163, 184, 0.15)', border: `1px solid ${(printerConfig.kot.printerName || printerConfig.billing.printerName) ? ((kotConnected || billingConnected) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)') : 'var(--bg-border)'}` }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: (printerConfig.kot.printerName || printerConfig.billing.printerName) ? ((kotConnected || billingConnected) ? '#10b981' : '#ef4444') : '#94a3b8', display: 'inline-block', boxShadow: (printerConfig.kot.printerName || printerConfig.billing.printerName) && (kotConnected || billingConnected) ? '0 0 8px #10b981' : 'none' }}></span>
                                                <span style={{ fontSize: '11px', fontWeight: 800, color: (printerConfig.kot.printerName || printerConfig.billing.printerName) ? ((kotConnected || billingConnected) ? '#10b981' : '#f87171') : 'var(--text-muted)' }}>
                                                    {(printerConfig.kot.printerName || printerConfig.billing.printerName) ? ((kotConnected || billingConnected) ? '🟢 Paired & Ready' : '🔴 Disconnected') : '⚪ No Device Selected'}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 }}>SELECT KOT PRINTER</label>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <select 
                                                        value={printerConfig.kot.printerName} 
                                                        onChange={e => setPrinterConfig({
                                                            ...printerConfig,
                                                            kot: { ...printerConfig.kot, printerName: e.target.value }
                                                        })}
                                                        style={{width: '100%', padding: '10px 14px', paddingRight: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 600, appearance: 'none', outline: 'none' }}
                                                    >
                                                        <option value="">Same as Billing Printer (Default)</option>
                                                        {printerConfig.kot.printerName && !installedPrinters.some(p => p.id === printerConfig.kot.printerName) && (
                                                            <option value={printerConfig.kot.printerName}>{printerConfig.kot.printerName} (Saved Device)</option>
                                                        )}
                                                        {installedPrinters.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name || 'Thermal Printer'} ({p.id})</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={18} style={{ position: 'absolute', right: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 }}>KOT TICKET ROLL SIZE</label>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <select 
                                                        value={printerConfig.kot.paperSize || printerConfig.billing.paperSize || '58mm'} 
                                                        onChange={e => setPrinterConfig({
                                                            ...printerConfig,
                                                            kot: { ...printerConfig.kot, paperSize: e.target.value }
                                                        })}
                                                        style={{width: '100%', padding: '10px 14px', paddingRight: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 600, appearance: 'none', outline: 'none' }}
                                                    >
                                                        <option value="58mm">Compact Ticket (58mm / 2 inch)</option>
                                                        <option value="80mm">Standard Ticket (80mm / 3 inch)</option>
                                                    </select>
                                                    <ChevronDown size={18} style={{ position: 'absolute', right: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Test Print Actions */}
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                                        <button 
                                            type="button"
                                            onClick={handleTestPrintBilling}
                                            style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '10px 16px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            🖨️ Test Print Billing Receipt
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={handleTestPrintKot}
                                            style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px 16px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            👨‍🍳 Test Print KOT Ticket
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}>
                                    <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', border: 'none', width: 'fit-content' }}>
                                        <Save size={18} />
                                        Save Printer Settings
                                    </button>
                                </div>
                            </form>
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
                            <h2 style={{fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('profile_licensing', 'System Modules & Licensing')}</h2>
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
                            {/* Active Subscription License & Plan Card */}
                            <div style={{ backgroundColor: 'var(--bg-base)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(14, 165, 233, 0.3)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: 'rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                                            <Key size={22} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <h3 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Active Subscription License</h3>
                                                <span style={{ 
                                                    padding: '4px 12px', 
                                                    borderRadius: '20px', 
                                                    fontSize: '11px', 
                                                    fontWeight: 900, 
                                                    backgroundColor: licenseDetails?.type === 'permanent' ? 'rgba(16, 185, 129, 0.2)' : licenseDetails?.type === 'yearly' ? 'rgba(14, 165, 233, 0.2)' : licenseDetails?.type === 'monthly' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                    color: licenseDetails?.type === 'permanent' ? '#10b981' : licenseDetails?.type === 'yearly' ? '#0ea5e9' : licenseDetails?.type === 'monthly' ? '#f59e0b' : '#f87171',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.03em'
                                                }}>
                                                    {licenseDetails?.type === 'trial' ? 'Free Trial (30 Days)' : 
                                                     licenseDetails?.type === 'monthly' ? 'Monthly Subscription' : 
                                                     licenseDetails?.type === 'yearly' ? 'Yearly Subscription' : 
                                                     licenseDetails?.type === 'permanent' ? 'Lifetime Access' : 'Active Plan'}
                                                </span>
                                            </div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0', fontWeight: 500 }}>
                                                {licenseDetails?.type === 'permanent' 
                                                    ? 'Unlimited Lifetime Access — Permanent license active.'
                                                    : `Status: Active (${licenseDetails?.daysRemaining || 0} Days Remaining). Expiry: ${licenseDetails?.expiresAt ? new Date(licenseDetails.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}`}
                                            </p>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleStartLicenseUpdate}
                                        style={{ 
                                            padding: '10px 20px', 
                                            borderRadius: '12px', 
                                            backgroundColor: '#0ea5e9', 
                                            color: '#ffffff', 
                                            border: 'none', 
                                            fontWeight: 900, 
                                            fontSize: '13px', 
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.3)',
                                            transition: 'transform 0.15s ease'
                                        }}
                                    >
                                        <Key size={16} /> Update / Renew License Key
                                    </button>
                                </div>
                            </div>
                            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-rgba-05)' }}></div>

                            {/* Cloud Sync & Online Backup Module */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '20px', borderRadius: '16px', border: '1px solid var(--bg-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '650px' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Globe size={18} style={{ color: '#0ea5e9' }} />
                                            Online Cloud Sync & Analytics
                                        </h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                                            Automatically sync sales analytics, cash collections, and item reports to your Supabase cloud server.
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-card)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                                            <input 
                                                type="radio" 
                                                name="cloudSyncToggle"
                                                checked={!cloudSyncEnabled} 
                                                onChange={() => {
                                                    setCloudSyncEnabled(false);
                                                    localStorage.setItem('cfg_cloud_sync_enabled', 'false');
                                                    toast.success('Cloud Sync Disabled');
                                                }}
                                                style={{ accentColor: '#f43f5e', width: '16px', height: '16px', cursor: 'pointer' }}
                                            />
                                            Disabled
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                                            <input 
                                                type="radio" 
                                                name="cloudSyncToggle"
                                                checked={cloudSyncEnabled} 
                                                onChange={() => {
                                                    if (!cloudSyncEnabled) {
                                                        setShowCloudSyncPassModal(true);
                                                        setCloudSyncModulePassword('');
                                                    }
                                                }}
                                                style={{ accentColor: '#10b981', width: '16px', height: '16px', cursor: 'pointer' }}
                                            />
                                            Enabled
                                        </label>
                                    </div>
                                </div>

                                {cloudSyncEnabled && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '12px', borderTop: '1px solid var(--bg-border)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>OWNER ACCOUNT EMAIL</label>
                                                <input 
                                                    type="email" 
                                                    placeholder="owner@hotel.com"
                                                    value={cloudSyncEmail}
                                                    onChange={e => {
                                                        setCloudSyncEmail(e.target.value);
                                                        localStorage.setItem('cfg_cloud_sync_email', e.target.value.trim());
                                                    }}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>OWNER PASSWORD</label>
                                                <input 
                                                    type="password" 
                                                    placeholder="••••••••"
                                                    value={cloudSyncPassword}
                                                    onChange={e => {
                                                        setCloudSyncPassword(e.target.value);
                                                        localStorage.setItem('cfg_cloud_sync_password', e.target.value.trim());
                                                    }}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                                                />
                                            </div>

                                            <div style={{ display: 'none' }}>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>HOTEL IDENTIFIER CODE</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. HOTEL_001"
                                                    value={cloudSyncHotelCode}
                                                    onChange={e => {
                                                        setCloudSyncHotelCode(e.target.value);
                                                        localStorage.setItem('cfg_cloud_sync_hotel_code', e.target.value.trim());
                                                    }}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--bg-border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {lastSyncTime ? `Last Synced: ${new Date(lastSyncTime).toLocaleString()}` : 'Not synced yet.'}
                                            </div>

                                            <button 
                                                type="button"
                                                disabled={isManualSyncing}
                                                onClick={async () => {
                                                    setIsManualSyncing(true);
                                                    const t = toast.loading('Initiating Supabase Cloud Sync...');
                                                    try {
                                                        const { performCloudSync } = await import('../services/cloudSyncService');
                                                        const res = await performCloudSync();
                                                        if (res.success) {
                                                            setLastSyncTime(res.timestamp);
                                                            toast.success('Analytics successfully synced to Cloud!', { id: t });
                                                        } else {
                                                            toast.error(res.reason || res.error || 'Sync failed', { id: t });
                                                        }
                                                    } catch (err) {
                                                        toast.error('Sync error: ' + err.message, { id: t });
                                                    } finally {
                                                        setIsManualSyncing(false);
                                                    }
                                                }}
                                                style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0ea5e9', color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: isManualSyncing ? 0.6 : 1 }}
                                            >
                                                <RotateCw size={14} /> {isManualSyncing ? 'Syncing...' : 'Sync Now'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Simple KOT Module */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '650px' }}>
                                    <h3 style={{fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Simple KOT</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: '1.6', marginTop: '4px' }}>
                                        Enable kitchen order tickets and live kitchen display routing.
                                        This module requires a passcode to unlock.
                                    </p>
                                </div>
                                
                                {/* Toggle / Radio Control */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                                        <input 
                                            type="radio" 
                                            name="simpleKotModule"
                                            checked={!simpleKotEnabled} 
                                            onChange={() => handleToggleSimpleKot(false)}
                                            style={{ accentColor: '#f43f5e', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        Disabled
                                    </label>
                                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                                        <input 
                                            type="radio" 
                                            name="simpleKotModule"
                                            checked={simpleKotEnabled} 
                                            onChange={() => handleToggleSimpleKot(true)}
                                            style={{ accentColor: '#10b981', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        Enabled
                                    </label>
                                </div>
                            </div>

                            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-rgba-05)' }}></div>
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

                            {/* Cancel Order Management Module */}
                            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-rgba-05)' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '650px' }}>
                                    <h3 style={{fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Cancel Order Management</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: '1.6', marginTop: '4px' }}>
                                        Enable tracking, auditing, and printing slips for cancelled table orders and unbilled kitchen tickets.
                                    </p>
                                </div>
                                
                                {/* Toggle / Radio Control */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-base)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                                        <input 
                                            type="radio" 
                                            name="cancelOrdersModule"
                                            checked={!cancelOrdersEnabled} 
                                            onChange={() => handleToggleCancelOrders(false)}
                                            style={{ accentColor: '#f43f5e', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        Disabled
                                    </label>
                                    <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
                                        <input 
                                            type="radio" 
                                            name="cancelOrdersModule"
                                            checked={cancelOrdersEnabled} 
                                            onChange={() => handleToggleCancelOrders(true)}
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

            {/* License Passcode Modal */}
            {showLicensePasscodeModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowLicensePasscodeModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '32px', border: '1px solid var(--bg-border)', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Lock size={26} style={{ color: '#0ea5e9' }} />
                            <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Security Passcode Required</h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                            Enter the system security passcode to unlock license key modification and plan upgrade.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900 }}>SECURITY PASSCODE</label>
                            <input
                                type="password"
                                value={licensePasscode}
                                onChange={e => setLicensePasscode(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleVerifyLicensePasscode()}
                                placeholder="Enter passcode"
                                autoFocus
                                style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: '16px', letterSpacing: '0.1em' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                            <button onClick={() => setShowLicensePasscodeModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                            <button onClick={handleVerifyLicensePasscode} style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: '#0ea5e9', color: '#ffffff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)' }}>Verify Passcode</button>
                        </div>
                    </div>
                </div>
            )}

            {/* License Key Update Modal */}
            {showLicenseKeyModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowLicenseKeyModal(false)}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '32px', border: '1px solid var(--bg-border)', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Key size={26} style={{ color: '#10b981' }} />
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Update / Renew License Key</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '2px 0 0 0', fontWeight: 500 }}>Upgrade your subscription from Free Trial to Monthly, Yearly, or Lifetime.</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900 }}>ENTER LICENSE KEY</label>
                            <input
                                type="text"
                                value={newLicenseKey}
                                onChange={e => setNewLicenseKey(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleActivateNewLicenseKey()}
                                placeholder="Paste or type new license key"
                                autoFocus
                                style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: '#10b981', fontWeight: 900, outline: 'none', fontSize: '16px', letterSpacing: '0.05em' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button onClick={() => setShowLicenseKeyModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                            <button onClick={handleActivateNewLicenseKey} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#10b981', color: '#ffffff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}>Activate Plan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cloud Sync Password Verify Modal */}
            {showCloudSyncPassModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(32px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '24px' }}>
                    <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--bg-card)', borderRadius: '32px', border: '1px solid var(--bg-border)', padding: '40px 32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(14, 165, 233, 0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                           <Key size={32} color="#0ea5e9" />
                        </div>
                        <h3 style={{fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Admin Authentication</h3>
                        <p style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 24px 0' }}>Enter your admin PIN to setup Cloud Sync:</p>
                        
                        <input
                            type="password"
                            placeholder="PIN"
                            value={cloudSyncModulePassword}
                            onChange={e => setCloudSyncModulePassword(e.target.value)}
                            onKeyDown={e => {
                                if(e.key === 'Enter') {
                                    if (cloudSyncModulePassword === '462187') {
                                        setShowCloudSyncPassModal(false);
                                        setShowCloudSyncSetupModal(true);
                                        setCloudSyncModulePassword('');
                                    } else {
                                        toast.error('Incorrect PIN');
                                    }
                                }
                            }}
                            style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '18px', outline: 'none', textAlign: 'center', letterSpacing: '8px', marginBottom: '24px', fontWeight: 900 }}
                            autoFocus
                        />
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => { setShowCloudSyncPassModal(false); setCloudSyncModulePassword(''); }} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '15px' }}>Cancel</button>
                            <button onClick={() => {
                                if (cloudSyncModulePassword === '462187') {
                                    setShowCloudSyncPassModal(false);
                                    setShowCloudSyncSetupModal(true);
                                    setCloudSyncModulePassword('');
                                } else {
                                    toast.error('Incorrect PIN');
                                }
                            }} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#0ea5e9', color: '#ffffff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '15px', boxShadow: '0 8px 16px rgba(14, 165, 233, 0.2)' }}>Verify</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cloud Sync Owner Setup Modal */}
            {showCloudSyncSetupModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(32px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '24px' }}>
                    <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--bg-card)', borderRadius: '32px', border: '1px solid var(--bg-border)', padding: '40px 32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                           <Globe size={32} color="#10b981" />
                        </div>
                        <h3 style={{fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Cloud Sync Setup</h3>
                        <p style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 24px 0' }}>Enter Owner Credentials to enable sync:</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                            <input
                                type="email"
                                placeholder="Owner Email"
                                value={cloudSyncEmail}
                                onChange={e => setCloudSyncEmail(e.target.value)}
                                style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none' }}
                            />
                            <input
                                type="password"
                                placeholder="Owner Password"
                                value={cloudSyncPassword}
                                onChange={e => setCloudSyncPassword(e.target.value)}
                                style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid var(--bg-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none' }}
                            />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setShowCloudSyncSetupModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '15px' }}>Cancel</button>
                            <button onClick={() => {
                                if (!cloudSyncEmail || !cloudSyncPassword) {
                                    return toast.error('Please enter Owner Email and Password');
                                }
                                localStorage.setItem('cfg_cloud_sync_email', cloudSyncEmail.trim());
                                localStorage.setItem('cfg_cloud_sync_password', cloudSyncPassword.trim());
                                localStorage.setItem('cfg_cloud_sync_enabled', 'true');
                                setCloudSyncEnabled(true);
                                setShowCloudSyncSetupModal(false);
                                toast.success('Online Cloud Sync Enabled');
                            }} style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#10b981', color: '#ffffff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: '15px', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)' }}>Enable Sync</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
