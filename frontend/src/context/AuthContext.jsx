import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      
      const checkLicenseLocally = () => {
        import('../services/localLicenseService').then(ls => {
          ls.getLicenseDetails().then(details => {
            if (!details.isValid && details.type === 'revoked') {
              window.location.reload();
            } else {
              const freshUser = {
                ...parsed,
                licenseWarning: details.warning,
                offlineDays: details.offlineDays
              };
              localStorage.setItem('user', JSON.stringify(freshUser));
              setUser(freshUser);
            }
          }).catch(() => {});
        }).catch(() => {});
      };

      // Perform a background network sync (NO UI IMPACT)
      // Strictly enforces MAX 1 Supabase request per calendar day
      const performNetworkSync = (force = false) => {
        const getTodayStr = () => {
          const d = new Date();
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const todayStr = getTodayStr();
        const lastPingDate = localStorage.getItem('LAST_SUPABASE_PING_DATE');

        if (!force && lastPingDate === todayStr) {
          console.log(`[SUPABASE SYNC] Already pinged Supabase today (${todayStr}). Skipping request.`);
          return;
        }

        import('../services/localLicenseService').then(ls => {
          ls.syncLicenseWithSupabase().then(res => {
            if (res.success) {
              localStorage.setItem('LAST_SUPABASE_PING_DATE', todayStr);
              if (res.is_active === false) {
                window.location.reload(); // Instantly lock out if revoked
              } else {
                checkLicenseLocally(); // Refresh UI warnings/offline days if successful
              }
            }
          }).catch(() => {});
        }).catch(() => {});
      };

      // Initial local check
      checkLicenseLocally();
      
      // Initial network sync if online
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
         Network.getStatus().then(status => {
           if (status.connected) performNetworkSync();
         });
      } else if (navigator.onLine) {
         performNetworkSync();
      }

      // Trigger 1: Listen for network reconnection
      let networkListener = null;
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
        Network.addListener('networkStatusChange', status => {
          if (status.connected) {
            console.log('[NETWORK] Connection restored. Triggering background sync.');
            performNetworkSync();
          }
        }).then(listener => {
          networkListener = listener;
        });
      } else {
        window.addEventListener('online', () => performNetworkSync());
      }

      // Trigger 2: Listen for App Resume from Background (Capacitor App state)
      let appStateListener = null;
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            console.log('[APP STATE] App resumed to foreground. Checking daily sync status.');
            performNetworkSync();
          }
        }).then(listener => {
          appStateListener = listener;
        });
      }
      
      // Trigger 3: Daily 11 PM Cron Job fallback
      const scheduleNext11PM = () => {
        const now = new Date();
        const target = new Date();
        target.setHours(23, 0, 0, 0); // 11:00:00 PM
        
        if (now.getTime() >= target.getTime()) {
          target.setDate(target.getDate() + 1);
        }
        
        const msUntil11PM = target.getTime() - now.getTime();
        
        let timeoutId;
        
        const runCron = () => {
          console.log('[CRON] 11 PM Trigger. Running background sync.');
          performNetworkSync();
          timeoutId = scheduleNext11PM();
        };
        
        timeoutId = setTimeout(runCron, msUntil11PM);
        return timeoutId;
      };

      const cronTimeout = scheduleNext11PM();

      setLoading(false);
      
      return () => {
        if (networkListener) networkListener.remove();
        if (appStateListener) appStateListener.remove();
        if (typeof window !== 'undefined' && (!window.Capacitor || !window.Capacitor.isNativePlatform())) {
          window.removeEventListener('online', () => performNetworkSync());
        }
        clearTimeout(cronTimeout);
      };
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (newData) => {
    const updated = { ...user, ...newData };
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
