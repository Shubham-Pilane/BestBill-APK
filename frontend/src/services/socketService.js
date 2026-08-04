import { registerPlugin } from '@capacitor/core';

const LocalWebServer = registerPlugin('LocalWebServer');

const listeners = new Set();
let eventSource = null;

export const isWaiterModuleEnabled = () => {
  if (typeof window === 'undefined') return false;
  const isCapacitorNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!isCapacitorNative && window.location.protocol.startsWith('http')) {
    return true;
  }
  return localStorage.getItem('cfg_waiter_module') === 'true';
};

export const initSocket = (hotelId) => {
  if (!isWaiterModuleEnabled()) {
    console.log('[SOCKET SERVICE] Waiter Mobile Access module is disabled. WebSocket/SSE execution bypassed.');
    return;
  }

  // If host APK app running on native device, start embedded HTTP server
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      LocalWebServer.startServer().catch(err => console.warn('[LOCAL WEB SERVER START ERR]', err));
    } catch (e) {
      console.warn('[LOCAL WEB SERVER START EXCEPTION]', e);
    }
  }

  // If running in browser (e.g., Waiter phone connected via Wi-Fi), connect to SSE endpoint
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && (!window.Capacitor || !window.Capacitor.isNativePlatform())) {
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
      return;
    }

    try {
      const sseUrl = `${window.location.protocol}//${window.location.host}/api/events`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data || '{}');
          listeners.forEach(cb => cb('update', parsed));
        } catch (err) {
          listeners.forEach(cb => cb('update', {}));
        }
      };

      eventSource.addEventListener('table-update', (e) => {
        let parsed = {};
        try { parsed = JSON.parse(e?.data || '{}'); } catch (err) {}
        listeners.forEach(cb => cb('table-update', parsed));
      });

      eventSource.addEventListener('order-update', (e) => {
        let parsed = {};
        try { parsed = JSON.parse(e?.data || '{}'); } catch (err) {}
        listeners.forEach(cb => cb('order-update', parsed));
      });

      eventSource.onerror = () => {
        // Auto-reconnect managed by browser EventSource standard
      };
    } catch (e) {
      console.warn('[SOCKET SERVICE] SSE connection warning:', e);
    }
  }
};

export const stopSocket = () => {
  if (eventSource) {
    try { eventSource.close(); } catch (e) {}
    eventSource = null;
  }
  listeners.clear();

  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      LocalWebServer.stopServer().catch(err => console.warn('[LOCAL WEB SERVER STOP ERR]', err));
    } catch (e) {}
  }
};

export const notifyUpdate = (eventName = 'table-update', data = {}) => {
  if (!isWaiterModuleEnabled()) return;

  // Broadcast locally to in-memory listeners
  listeners.forEach(cb => cb(eventName, data));

  // If host APK app running on native device, broadcast to all connected waiter mobile browsers
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      LocalWebServer.broadcastEvent({
        event: eventName,
        data: JSON.stringify(data)
      }).catch(err => console.warn('[SOCKET BROADCAST ERR]', err));
    } catch (e) {
      console.warn('[SOCKET BROADCAST EXCEPTION]', e);
    }
  }
};

export const onUpdate = (callback) => {
  if (!isWaiterModuleEnabled()) return () => {};
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const getLocalIpAddress = async () => {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      const res = await LocalWebServer.getLocalIpAddress();
      return res.ip || '127.0.0.1';
    } catch (e) {
      console.warn('[GET LOCAL IP ERR]', e);
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.hostname || '127.0.0.1';
  }
  return '127.0.0.1';
};
