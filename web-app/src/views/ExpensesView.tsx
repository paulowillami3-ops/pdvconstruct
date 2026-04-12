import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Expense } from '../database/db';
import { 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  TrendingDown, 
  CheckCircle, 
  Clock, 
  X,
  AlertCircle,
  Filter
} from 'lucide-react';

const CATEGORIES: Record<string, string> = {
  fixa: 'Fixa',
  variavel: 'Variável',
  fornecedor: 'Fornecedor',
  pessoal: 'Pró-labore / Salários'
};

const ExpensesView: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const tenantId = currentUser.tenant_id;

  // Live Query with strict tenant filtering
  const expenses = useLiveQuery(async () => {
    if (!tenantId) return [];
    
    let query = db.expenses.where('tenant_id').equals(tenantId);
    let list = await query.reverse().sortBy('due_date');
    
    if (filter !== 'all') {
      list = list.filter(e => e.status === filter);
    }
    
    if (!searchTerm) return list;
    return list.filter(e => 
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (CATEGORIES[e.category] || e.category).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tenantId, searchTerm, filter]) || [];

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    category: 'fixa'
  });

  const totals = {
    pending: expenses.filter(e => e.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0),
    paid: expenses.filter(e => e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0),
    total: expenses.reduce((acc, curr) => acc + curr.amount, 0)
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !formData.description || !formData.amount) return;

    await db.expenses.add({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      synced: false,
      description: formData.description,
      amount: parseFloat(formData.amount),
      due_date: new Date(formData.due_date + 'T12:00:00').getTime(),
      status: 'pending',
      category: formData.category,
      created_at: Date.now()
    });

    setFormData({
      description: '',
      amount: '',
      due_date: new Date().toISOString().split('T')[0],
      category: 'fixa'
    });
    setShowModal(false);
  };

  const toggleStatus = async (expense: Expense) => {
    await db.expenses.update(expense.id, {
      status: expense.status === 'pending' ? 'paid' : 'pending',
      synced: false
    });
  };

  const deleteExpense = async (id: string) => {
    if (confirm('Deseja excluir esta conta?')) {
      await db.expenses.delete(id);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('pt-BR');
  };

  return (
    <div className="responsive-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', gap: '32px' }}>
      
      {/* Header com busca e botão */}
      <header className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>Contas a Pagar</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Controle suas despesas, aluguel e fornecedores.</p>
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
              <Plus size={20} /> Nova Despesa
            </button>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--danger)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ color: 'var(--text-primary)', opacity: 0.7, fontSize: '14px', margin: 0, fontWeight: '600' }}>Total Pendente</p>
            <Clock size={20} color="var(--danger)" />
          </div>
          <p style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: '#FFFFFF', textShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}>
            R$ {totals.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--success)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ color: 'var(--text-primary)', opacity: 0.7, fontSize: '14px', margin: 0, fontWeight: '600' }}>Total Pago</p>
            <CheckCircle size={20} color="var(--success)" />
          </div>
          <p style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: '#FFFFFF', textShadow: '0 0 20px rgba(16, 185, 129, 0.3)' }}>
            R$ {totals.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--primary)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ color: 'var(--text-primary)', opacity: 0.7, fontSize: '14px', margin: 0, fontWeight: '600' }}>Filtro de Status</p>
            <Filter size={18} color="var(--primary)" />
          </div>
          <select 
            className="input-glass"
            style={{ padding: '8px', border: 'none', background: 'transparent', width: '100%', fontWeight: '600', cursor: 'pointer', color: 'white' }}
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
          >
            <option value="all" style={{ color: 'white' }}>Todas as Contas</option>
            <option value="pending" style={{ color: 'white' }}>Somente Pendentes</option>
            <option value="paid" style={{ color: 'white' }}>Somente Pagas</option>
          </select>
        </div>
      </div>

      {/* Tabela de Despesas */}
      <div className="glass-panel mobile-cards-table" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>STATUS</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>DESCRIÇÃO</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>CATEGORIA</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>VENCIMENTO</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>VALOR</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const isOverdue = expense.status === 'pending' && expense.due_date < Date.now();
                return (
                  <tr key={expense.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                    <td data-label="Status" style={{ padding: '16px 24px' }}>
                      <button 
                        onClick={() => toggleStatus(expense)}
                        style={{ 
                          padding: '6px 14px', 
                          borderRadius: '20px', 
                          fontSize: '11px', 
                          fontWeight: '700',
                          cursor: 'pointer',
                          border: '1px solid transparent',
                          background: expense.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: expense.status === 'paid' ? 'var(--success)' : 'var(--danger)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {expense.status === 'paid' ? <CheckCircle size={12} /> : (isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />)}
                        {expense.status === 'paid' ? 'PAGO' : (isOverdue ? 'VENCIDO' : 'PENDENTE')}
                      </button>
                    </td>
                    <td data-label="Descrição" style={{ padding: '16px 24px', color: 'var(--text-primary)', fontWeight: '600' }}>{expense.description}</td>
                    <td data-label="Categoria" style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: '12px', background: 'var(--surface-light)', padding: '4px 10px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        {CATEGORIES[expense.category] || expense.category}
                      </span>
                    </td>
                    <td data-label="Vencimento" style={{ padding: '16px 24px', color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={14} opacity={0.5} />
                        {formatDate(expense.due_date)}
                      </div>
                    </td>
                    <td data-label="Valor" style={{ padding: '16px 24px', color: expense.status === 'pending' ? 'var(--danger)' : 'var(--text-primary)', fontWeight: '700', fontSize: '15px' }}>
                      R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td data-label="Ações" style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <button 
                        onClick={() => deleteExpense(expense.id)}
                        style={{ color: 'var(--text-muted)', padding: '8px', cursor: 'pointer', borderRadius: '50%', background: 'transparent' }}
                        className="btn-icon-hover"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <TrendingDown size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                    <p>Nenhuma despesa encontrada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel responsive-modal" style={{ width: '460px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Lançar Nova Despesa</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'var(--surface-light)', borderRadius: '50%', padding: '6px' }}>
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Descrição da Conta</label>
                <input 
                  required 
                  className="input-glass" 
                  placeholder="Ex: Aluguel Mensal" 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Valor</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01"
                    className="input-glass" 
                    placeholder="0,00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Vencimento</label>
                  <input 
                    required 
                    type="date"
                    className="input-glass"
                    value={formData.due_date}
                    onChange={e => setFormData({...formData, due_date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Categoria</label>
                <select 
                  className="input-glass"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  style={{ color: 'white' }}
                >
                  <option value="fixa" style={{ color: 'white' }}>Fixa (Mensal)</option>
                  <option value="variavel" style={{ color: 'white' }}>Variável / Emergência</option>
                  <option value="fornecedor" style={{ color: 'white' }}>Fornecedores / Matéria-prima</option>
                  <option value="pessoal" style={{ color: 'white' }}>Pró-labore e Salários</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '12px', padding: '16px' }}>
                Salvar Despesa
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesView;
