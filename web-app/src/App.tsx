import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Package, Users, LayoutDashboard, FileText, LogOut, Truck, DollarSign, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { db, type User, type Product } from './database/db';
import { seedDatabase } from './database/seed';
import { initSyncEngine } from './lib/sync';
import { supabase } from './lib/supabase';

// Views
import POSView from './views/POSView';
import InventoryView from './views/InventoryView';
import CustomersView from './views/CustomersView';
import SuppliersView from './views/SuppliersView';
import PurchasesView from './views/PurchasesView';
import DeliveriesView from './views/DeliveriesView';
import ReportsView from './views/ReportsView';
import LoginView from './views/LoginView';
import DriverView from './views/DriverView';
import ExpensesView from './views/ExpensesView';
import UsersView from './views/UsersView';
import SettingsView from './views/SettingsView';
import { Settings as SettingsIcon } from 'lucide-react';

// Mapa de tradução visual — os valores no banco permanecem em inglês
const ROLE_LABELS: Record<string, string> = {
  owner:    'Proprietário',
  admin:    'Administrador',
  cashier:  'Caixa / Balcão',
  driver:   'Entregador',
  employee: 'Funcionário',
};

const Layout = ({ children, user, onLogout, companyName }: { children: React.ReactNode, user: User, onLogout: () => void, companyName: string }) => {
  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const isDriver = user.role === 'driver';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Sidebar - Desktop Only */}
      {!isDriver && (
        <aside className="hide-on-print hide-on-mobile" style={{
          width: '260px',
          background: 'var(--surface-primary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0'
        }}>
          <div style={{ padding: '0 24px', marginBottom: '40px' }}>
            <h1 style={{ 
              color: 'var(--text-primary)', 
              fontSize: '22px', 
              fontWeight: '800', 
              letterSpacing: '-0.5px',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}>
              {companyName || 'Construx PDV'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '500' }}>
                Sistema Ativo
              </p>
            </div>
          </div>

          <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Operação</div>
            <NavItem to="/pos" icon={<LayoutDashboard size={18} />} label="Venda" />
            <NavItem to="/deliveries" icon={<Truck size={18} />} label="Entregas" />
            
            <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px' }}>Estoque</div>
            <NavItem to="/inventory" icon={<Package size={18} />} label="Catálogo / Estoque" />
            <NavItem to="/purchases" icon={<FileText size={18} />} label="Entrada de Notas" />
            {isAdmin && <NavItem to="/suppliers" icon={<Truck size={18} />} label="Fornecedores" />}
            
            <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px' }}>Administrativo</div>
            <NavItem to="/customers" icon={<Users size={18} />} label="Clientes / Fiado" />
            {isAdmin && <NavItem to="/expenses" icon={<DollarSign size={18} />} label="Contas a Pagar" />}
            {isAdmin && <NavItem to="/users" icon={<Users size={18} />} label="Usuários" />}
            {(isAdmin || user.role === 'cashier') && <NavItem to="/settings" icon={<SettingsIcon size={18} />} label="Configurações" />}
            <NavItem to="/reports" icon={<FileText size={18} />} label="Relatórios" />
          </nav>

          <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border-color)' }}>
             <QuickSearchTrigger />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', marginTop: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {user.name.substring(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ROLE_LABELS[user.role] ?? user.role}</p>
              </div>
              <button onClick={onLogout} title="Sair do Sistema" style={{ background: 'transparent', padding: '4px' }}>
                <LogOut size={18} color="var(--danger)" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="mobile-main-wrapper" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      {/* Bottom Navigation - Mobile Only (Hidden for Drivers) */}
      {!isDriver && (
        <nav className="show-on-mobile flex bottom-nav-glass hide-on-print" style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: '70px',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0 8px',
          zIndex: 50
        }}>
          <BottomNavItem to="/pos" icon={<LayoutDashboard size={22} />} label="Venda" />
          <BottomNavItem to="/deliveries" icon={<Truck size={22} />} label="Logística" />
          <BottomNavItem to="/inventory" icon={<Package size={22} />} label="Estoque" />
          <BottomNavItem to="/customers" icon={<Users size={22} />} label="Clientes" />
          <button onClick={onLogout} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', color: 'var(--danger)', padding: '6px' }}>
            <LogOut size={22} />
            <span style={{ fontSize: '9px', fontWeight: '500' }}>Sair</span>
          </button>
        </nav>
      )}

      {/* Logout button always available for driver on top if needed or part of view */}
      {isDriver && (
        <button 
          onClick={onLogout}
          className="fixed top-4 right-4 z-50 bg-white/10 backdrop-blur-md p-3 rounded-full border border-white/20 text-red-400"
        >
          <LogOut size={20} />
        </button>
      )}
    </div>
  );
};

const QuickSearchTrigger = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.length > 1) {
      const currentUser = localStorage.getItem('currentUser') 
        ? JSON.parse(localStorage.getItem('currentUser')!) 
        : null;

      if (!currentUser) return;

      db.products
        .where('tenant_id').equals(currentUser.tenant_id)
        .filter(p => 
          p.name.toLowerCase().includes(query.toLowerCase()) || 
          p.barcode.toLowerCase().includes(query.toLowerCase())
        )
        .limit(5)
        .toArray()
        .then(setResults);
    } else {
      setResults([]);
    }
  }, [query]);

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}
    >
      <Search size={16} /> 
      <span>Consulta Rápida (F2)</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Search size={20} className="text-blue-400"/> Pesquisa Rápida</h2>
          <button onClick={() => {setIsOpen(false); setQuery('');}} className="text-gray-500 text-sm">Fechar (Esc)</button>
        </div>
        <input 
          autoFocus 
          placeholder="Nome do produto ou código de barras..." 
          className="input-glass w-full mb-6"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setIsOpen(false)}
        />
        <div className="space-y-4 max-h-[400px] overflow-auto pr-2">
          {results.map(p => (
            <div key={p.id} className="p-4 bg-white/5 rounded-2xl border border-white/10 flex justify-between items-center">
              <div>
                <h4 className="text-white font-medium">{p.name}</h4>
                <p className="text-xs text-gray-500">Un: {p.unit_type} | Código: {p.barcode}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-400">R$ {p.price_sell.toFixed(2)}</div>
                <div className={`text-xs font-medium ${p.stock_current > p.stock_min ? 'text-blue-400' : 'text-red-400'}`}>
                  Estoque: {p.stock_current}
                </div>
              </div>
            </div>
          ))}
          {query.length > 1 && results.length === 0 && <p className="text-center text-gray-500 py-4">Nenhum produto encontrado.</p>}
        </div>
      </div>
    </div>
  );
};

const BottomNavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    style={({ isActive }) => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      padding: '6px 8px',
      borderRadius: 'var(--radius-sm)',
      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
      background: 'transparent',
      textDecoration: 'none',
      transition: 'all 0.2s',
      fontWeight: isActive ? '700' : '500',
    })}
  >
    {icon}
    <span style={{ fontSize: '9px' }}>{label}</span>
  </NavLink>
);

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    style={({ isActive }) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      borderRadius: 'var(--radius-md)',
      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
      background: isActive ? 'var(--accent-glow)' : 'transparent',
      fontWeight: isActive ? '600' : '500',
      textDecoration: 'none',
      transition: 'all 0.2s'
    })}
  >
    {icon}
    {label}
  </NavLink>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(
    localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')!) : null
  );
  const [companyName, setCompanyName] = useState<string>(
    localStorage.getItem('companyName') || ''
  );

  useEffect(() => {
    seedDatabase().catch(console.error);

    // Inicia o motor de sincronização se houver usuário
    if (currentUser) {
      initSyncEngine();

      // Se o nome da empresa não está em cache, busca do Supabase
      if (!localStorage.getItem('companyName') && currentUser.tenant_id) {
        supabase
          .from('profiles')
          .select('tenants(name)')
          .eq('id', currentUser.id)
          .single()
          .then(({ data }) => {
            const name = (data as any)?.tenants?.name;
            if (name) {
              localStorage.setItem('companyName', name);
              setCompanyName(name);
            }
          });
      }
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCompanyName('');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('companyName');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    // Pega o nome da empresa que foi cacheado durante o login
    setCompanyName(localStorage.getItem('companyName') || '');
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={currentUser} onLogout={handleLogout} companyName={companyName}>
        <Routes>
          <Route path="/" element={
            currentUser.role === 'driver' ? <Navigate to="/driver" replace /> : <Navigate to="/pos" replace />
          } />
          
          {/* Driver specific */}
          <Route path="/driver" element={<DriverView />} />

          {/* Admin / Cashier */}
          <Route path="/pos" element={<POSView />} />
          <Route path="/inventory" element={<InventoryView />} />
          <Route path="/suppliers" element={<SuppliersView />} />
          <Route path="/purchases" element={<PurchasesView />} />
          <Route path="/deliveries" element={<DeliveriesView />} />
          <Route path="/customers" element={<CustomersView />} />
          <Route path="/reports" element={<ReportsView />} />
          
          {/* Admin Only */}
          <Route path="/expenses" element={<ExpensesView />} />
          <Route path="/users" element={<UsersView />} />
          <Route path="/settings" element={<SettingsView />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
