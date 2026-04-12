import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type User } from '../database/db';
import { 
  UserPlus, 
  Shield, 
  Trash2, 
  Users, 
  X, 
  User as UserIcon, 
  Lock, 
  AlertTriangle,
  Search,
  ShieldCheck,
  Truck,
  UserCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  cashier: 'Caixa / Balcão',
  driver: 'Entregador',
  employee: 'Funcionário'
};

const ROLE_COLORS: Record<string, string> = {
  owner: '#a855f7',
  admin: '#8b5cf6',
  cashier: '#10b981',
  driver: '#3b82f6',
  employee: '#6b7280'
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  owner: ShieldCheck,
  admin: Shield,
  cashier: UserCheck,
  driver: Truck,
  employee: UserIcon
};

const UsersView: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const tenantId = currentUser?.tenant_id;

  const users = useLiveQuery(async () => {
    if (!tenantId) return [];
    const list = await db.users.where('tenant_id').equals(tenantId).toArray();
    if (!searchTerm) return list;
    return list.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tenantId, searchTerm]) || [];

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'cashier' as User['role']
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.password || !tenantId) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-employee', {
        body: {
          username: formData.username,
          password: formData.password,
          fullName: formData.name,
          role: formData.role
        }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      await db.users.add({
        id: data.userId,
        tenant_id: tenantId,
        synced: true,
        name: formData.name,
        username: formData.username,
        passwordHash: btoa(formData.password), // Base64 encoding for local search, not for security
        role: formData.role
      });

      setFormData({ name: '', username: '', password: '', role: 'cashier' });
      setShowModal(false);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário.');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (user: User) => {
    await db.users.delete(user.id);
    setUserToDelete(null);
  };

  return (
    <div className="responsive-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', gap: '32px' }}>

      {/* Header */}
      <header className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>Equipe & Acessos</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Gerencie quem tem acesso ao sistema da sua empresa.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', maxWidth: 'fit-content' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-secondary)' }} size={18} />
            <input 
              className="input-glass" 
              placeholder="Buscar..." 
              style={{ paddingLeft: '48px', width: '100%' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="responsive-tools">
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', justifyContent: 'center' }} onClick={() => setShowModal(true)}>
              <UserPlus size={20} /> Novo Usuário
            </button>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
        {['owner', 'admin', 'cashier', 'driver'].map(role => {
          const count = users.filter(u => u.role === role).length;
          const RoleIcon = ROLE_ICONS[role] || UserIcon;
          return (
            <div key={role} className="glass-panel" style={{ padding: '24px', borderLeft: `4px solid ${ROLE_COLORS[role]}`, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p style={{ color: 'var(--text-primary)', opacity: 0.7, fontSize: '13px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' }}>
                  {ROLE_LABELS[role]}
                </p>
                <RoleIcon size={18} color={ROLE_COLORS[role]} />
              </div>
              <p style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: '#FFFFFF', textShadow: `0 0 20px ${ROLE_COLORS[role]}40` }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="glass-panel" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>USUÁRIO</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>NOME DE LOGIN</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>NÍVEL DE ACESSO</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                        background: `${ROLE_COLORS[user.role]}15`,
                        border: `1px solid ${ROLE_COLORS[user.role]}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '800', fontSize: '16px', color: ROLE_COLORS[user.role]
                      }}>
                        {user.name.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{user.name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Cadastrado em {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '14px', 
                      color: 'var(--primary)', 
                      background: 'var(--surface-light)',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      @{user.username}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                      background: `${ROLE_COLORS[user.role]}15`,
                      color: ROLE_COLORS[user.role],
                      border: `1px solid ${ROLE_COLORS[user.role]}30`
                    }}>
                      <Shield size={13} />
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    {user.role !== 'owner' && (
                      <button
                        onClick={() => setUserToDelete(user)}
                        className="btn-icon-hover"
                        style={{ color: 'var(--danger)', padding: '10px', cursor: 'pointer', borderRadius: '50%', background: 'transparent' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    {user.role === 'owner' && <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600' }}>SISTEMA</span>}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '80px 48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.1, display: 'block' }} />
                    <p style={{ margin: 0 }}>Nenhum colega de equipe encontrado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-panel responsive-modal" style={{ width: '460px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Novo Acesso de Equipe</h3>
              <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'var(--surface-light)', borderRadius: '50%', padding: '6px' }}>
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px', color: 'var(--danger)', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Nome do Funcionário</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                  <input required className="input-glass" style={{ paddingLeft: '48px' }} placeholder="Ex: Roberto Almeida" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Usuário de Login</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', top: '13px', left: '16px', color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>@</span>
                    <input required className="input-glass" style={{ paddingLeft: '36px' }} placeholder="roberto.pdv" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value.replace(/\s/g, '').toLowerCase() })} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Senha Provisória</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={18} />
                    <input required type="password" className="input-glass" style={{ paddingLeft: '48px' }} placeholder="Min. 6 caracteres" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Cargo / Nível de Acesso</label>
                <select className="input-glass" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as User['role'] })}>
                  <option value="cashier" style={{ color: 'white' }}>Caixa / Vendedor de Balcão</option>
                  <option value="driver" style={{ color: 'white' }}>Entregador / Motorista (App Delivery)</option>
                  <option value="admin" style={{ color: 'white' }}>Administrador Geral (Gerência)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1, padding: '16px' }}>
                  {loading ? 'Sincronizando...' : 'Gerar Novo Acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '400px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle color="var(--danger)" size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '22px', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Excluir Usuário?</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                O acesso de <strong style={{ color: 'var(--text-primary)' }}>{userToDelete.name}</strong> será revogado permanentemente em todos os dispositivos.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--surface-light)', color: 'var(--text-primary)' }} onClick={() => setUserToDelete(null)}>Manter</button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)' }} onClick={() => deleteUser(userToDelete)}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersView;
