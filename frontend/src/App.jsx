import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import BillingHistory from './pages/BillingHistory';
import Profile from './pages/Profile';
import KitchenKOT from './pages/KitchenKOT';
import CreditManagement from './pages/CreditManagement';
import InventoryManagement from './pages/InventoryManagement';
import CancelOrders from './pages/CancelOrders';
import ExpenseManagement from './pages/ExpenseManagement';
import { startCloudSyncScheduler } from './services/cloudSyncService';
import Layout from './components/Layout';
import './index.css';

if (typeof window !== 'undefined') {
  startCloudSyncScheduler();
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#fff', backgroundColor: '#020617', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800 }}>BestBill Application</h2>
          <p style={{ color: '#94a3b8', margin: '10px 0 20px 0', fontSize: '14px' }}>{this.state.error?.toString() || 'Something went wrong.'}</p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ padding: '10px 20px', backgroundColor: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)' }}><div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--bg-border)', borderTopColor: '#0ea5e9', animation: 'spin 1s linear infinite' }}></div><style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const Home = () => {
  return <Dashboard />;
};

const OwnerRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'owner' || !user) return <Navigate to="/" />;
  return children;
};

const InventoryRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'owner' || !user?.inventoryEnabled) return <Navigate to="/" />;
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout>
                      <Home />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/kot" element={
                  <ProtectedRoute>
                    <Layout>
                      <KitchenKOT />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/kitchen-kot" element={
                  <ProtectedRoute>
                    <Layout>
                      <KitchenKOT />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/history" element={
                  <ProtectedRoute>
                    <Layout>
                      <BillingHistory />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/expenses" element={
                  <ProtectedRoute>
                    <Layout>
                      <ExpenseManagement />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/cancel-orders" element={
                  <ProtectedRoute>
                    <OwnerRoute>
                      <Layout>
                        <CancelOrders />
                      </Layout>
                    </OwnerRoute>
                  </ProtectedRoute>
                } />
                <Route path="/menu" element={
                  <ProtectedRoute>
                    <OwnerRoute>
                      <Layout>
                        <MenuManagement />
                      </Layout>
                    </OwnerRoute>
                  </ProtectedRoute>
                } />
                <Route path="/credit" element={
                  <ProtectedRoute>
                    <OwnerRoute>
                      <Layout>
                        <CreditManagement />
                      </Layout>
                    </OwnerRoute>
                  </ProtectedRoute>
                } />
                <Route path="/inventory" element={
                  <ProtectedRoute>
                    <InventoryRoute>
                      <Layout>
                        <InventoryManagement />
                      </Layout>
                    </InventoryRoute>
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Layout>
                      <Profile />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Toaster 
                position="top-right" 
                containerStyle={{ pointerEvents: 'none' }}
                toastOptions={{
                  duration: 1500,
                  style: {
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-rgba-05)',
                    fontWeight: 600,
                    fontSize: '14px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    backdropFilter: 'blur(8px)',
                    pointerEvents: 'none'
                  },
                  success: {
                    duration: 1500,
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#ffffff',
                    },
                  },
                  error: {
                    duration: 2000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#ffffff',
                    },
                  }
                }}
              />
            </Router>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
