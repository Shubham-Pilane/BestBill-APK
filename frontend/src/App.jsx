import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import BillingHistory from './pages/BillingHistory';
import Profile from './pages/Profile';
import KitchenKOT from './pages/KitchenKOT';
import CreditManagement from './pages/CreditManagement';
import InventoryManagement from './pages/InventoryManagement';
import Layout from './components/Layout';
import './index.css';

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
            <Route path="/menu" element={
              <ProtectedRoute>
                <OwnerRoute>
                  <Layout>
                    <MenuManagement />
                  </Layout>
                </OwnerRoute>
              </ProtectedRoute>
            } />
            <Route path="/kitchen-kot" element={
              <ProtectedRoute>
                <OwnerRoute>
                  <Layout>
                    <KitchenKOT />
                  </Layout>
                </OwnerRoute>
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute>
                <OwnerRoute>
                  <Layout>
                    <BillingHistory />
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

          </Routes>
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#ffffff',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontWeight: 800,
                fontSize: '13px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff',
                },
              },
              error: {
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
  );
}

export default App;
