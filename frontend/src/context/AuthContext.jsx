import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { Network } from '@capacitor/network';

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
      const performNetworkSync = () => {
        import('../services/localLicenseService').then(ls => {
          ls.syncLicenseWithSupabase().then(res => {
            if (res.success && res.is_active === false) {
              window.location.reload(); // Instantly lock out if revoked
            } else if (res.success) {
              checkLicenseLocally(); // Refresh UI warnings/offline days if successful
            }
          });
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
        window.addEventListener('online', performNetworkSync);
      }
      
      // Trigger 2: Daily 11 PM Cron Job
      const scheduleNext11PM = () => {
        const now = new Date();
        const target = new Date();
        target.setHours(23, 0, 0, 0); // 11:00:00 PM
        
        if (now.getTime() >= target.getTime()) {
          // If it's already past 11 PM today, schedule for tomorrow
          target.setDate(target.getDate() + 1);
        }
        
        const msUntil11PM = target.getTime() - now.getTime();
        
        let timeoutId;
        
        const runCron = () => {
          console.log('[CRON] 11 PM Trigger. Running background sync.');
          performNetworkSync();
          timeoutId = scheduleNext11PM(); // Schedule next day
        };
        
        timeoutId = setTimeout(runCron, msUntil11PM);
        return timeoutId;
      };

      const cronTimeout = scheduleNext11PM();

      setLoading(false);
      
      return () => {
        if (networkListener) networkListener.remove();
        if (typeof window !== 'undefined' && (!window.Capacitor || !window.Capacitor.isNativePlatform())) {
          window.removeEventListener('online', performNetworkSync);
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
