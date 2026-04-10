import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, generateId } from '../database/db';
import { CreditCard, UserPlus, X, Edit2, Trash2, AlertTriangle, User, Search } from 'lucide-react';

export default function CustomersView() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [limit, setLimit] = useState('');

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, customerId: string, balance: number}>({isOpen: false, customerId: '', balance: 0});
  const [paymentAmount, setPaymentAmount] = useState('');
  const [search, setSearch] = useState('');
  const currentUserJson = localStorage.getItem('currentUser');
  const currentUser = currentUserJson ? JSON.parse(currentUserJson) : null;
  const tenantId = currentUser?.tenant_id;

  const customers = useLiveQuery(
    () => tenantId ? db.customers.where('tenant_id').equals(tenantId).toArray() : db.customers.toArray()
  , [tenantId]) || [];

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.cpf.includes(search) ||
    c.phone.includes(search)
  );

  const openNewModal = () => {
    setEditingCustomerId(null);
    setName(''); setCpf(''); setPhone(''); setLimit('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomerId(c.id);
    setName(c.name);
    setCpf(c.cpf);
    setPhone(c.phone);
    setLimit(c.credit_limit.toString());
    setIsAddModalOpen(true);
  };

  const executeDelete = async () => {
    if(!customerToDelete) return;
    try {
      await db.customers.delete(customerToDelete.id);
      setCustomerToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir do banco.');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!name) return;
    
    try {
      if (editingCustomerId) {
         await db.customers.update(editingCustomerId, {
            name,
            cpf,
            phone,
            credit_limit: parseFloat(limit) || 0,
            synced: false
         });
      } else {
         await db.customers.add({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            synced: false,
            name,
            cpf,
            phone,
            credit_limit: parseFloat(limit) || 0,
            balance_owed: 0,
            status: 'active',
            created_at: Date.now()
         });
      }
      setIsAddModalOpen(false);
      setEditingCustomerId(null);
      setName(''); setCpf(''); setPhone(''); setLimit('');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar contato.');
    }
  };

  const handlePayment = async () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (!isNaN(amount) && amount > 0) {
      try {
        await db.transaction('rw', db.customers, db.customer_payments, async () => {
          // 1. Record payment
          await db.customer_payments.add({
            id: generateId(),
            tenant_id: tenantId,
            synced: false,
            customer_id: paymentModal.customerId,
            amount: amount,
            method: 'dinheiro', // Default or could be improved later
            timestamp: Date.now()
          });

          // 2. Update balance
          const customer = await db.customers.get(paymentModal.customerId);
          if (customer) {
            await db.customers.update(paymentModal.customerId, {
              balance_owed: Math.max(0, customer.balance_owed - amount),
              synced: false
            });
          }
        });

        setPaymentModal({ isOpen: false, customerId: '', balance: 0 });
        setPaymentAmount('');
      } catch (err) {
        console.error(err);
        alert('Erro ao registrar pagamento.');
      }
    }
  };

  return (
    <div className="responsive-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', gap: '32px' }}>
      
      <header className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)' }}>Gestão de Clientes</h2>
          <p style={{ color: 'var(--text-muted)' }}>Controle de fiados, limites e crediário da loja.</p>
        </div>
        
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={openNewModal}>
          <UserPlus size={20} />
          Novo Cliente
        </button>
      </header>

      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-muted)' }} size={20} />
        <input 
          type="text" 
          className="input-glass" 
          style={{ paddingLeft: '48px' }}
          placeholder="Pesquisar por nome, CPF ou telefone..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-panel" style={{ flex: 1, padding: '0', overflowY: 'auto' }}>
        <div className="responsive-table-wrapper mobile-cards-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Cliente & Contato</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Limite Aprovado</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Saldo Devedor / Fiado</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'var(--surface-glass-light)' }}>
                  <td data-label="Cliente" style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{c.cpf} • {c.phone}</div>
                  </td>
                  <td data-label="Limite" style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>R$ {c.credit_limit.toFixed(2)}</td>
                  <td data-label="Saldo / Fiado" style={{ padding: '16px 24px' }}>
                    <div style={{ color: c.balance_owed > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold', fontSize: '16px' }}>
                      R$ {c.balance_owed.toFixed(2)}
                    </div>
                  </td>
                  <td data-label="Ações" style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        disabled={c.balance_owed <= 0}
                        onClick={() => setPaymentModal({ isOpen: true, customerId: c.id, balance: c.balance_owed })}
                        title="Quitar Débito do Fiado"
                        style={{ 
                          background: c.balance_owed > 0 ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                          color: c.balance_owed > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                          border: `1px solid ${c.balance_owed > 0 ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: c.balance_owed > 0 ? 'pointer' : 'not-allowed'
                        }}>
                        <CreditCard size={16} />
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Quitar</span>
                      </button>
                      <button onClick={() => openEditModal(c)} style={{ background: 'var(--surface-light)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-secondary)' }}>
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => setCustomerToDelete(c)} style={{ background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--danger)' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="glass-panel responsive-modal" style={{ width: '420px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{editingCustomerId ? 'Editar Cliente' : 'Cadastrar Cliente'}</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                style={{ background: 'var(--surface-light)', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Nome Completo</label>
                <div style={{ position: 'relative' }}>
                  <User style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                  <input required autoFocus className="input-glass" style={{ paddingLeft: '48px' }} placeholder="João Silva" value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>

              <div className="responsive-form-row" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>CPF / CNPJ</label>
                  <input className="input-glass" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Telefone</label>
                  <input className="input-glass" placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Limite de Crédito Aprovado (R$)</label>
                <div style={{ position: 'relative' }}>
                  <CreditCard style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--accent-primary)' }} size={20} />
                  <input required min="0" step="0.01" type="number" className="input-glass" style={{ paddingLeft: '48px', color: 'var(--accent-primary)', fontWeight: 'bold' }} placeholder="1000.00" value={limit} onChange={e => setLimit(e.target.value)} />
                </div>
              </div>

              <button className="btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', marginTop: '16px', fontSize: '16px' }}>
                {editingCustomerId ? 'Salvar Edição' : 'Concluir Cadastro'}
              </button>

            </form>
          </div>
        </div>
      )}

      {customerToDelete && (
        <div className="modal-overlay">
          <div className="glass-panel responsive-modal" style={{ width: '380px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
            <AlertTriangle color="var(--danger)" size={48} />
            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>Remover Cliente?</h3>
            <p style={{ color: 'var(--text-muted)' }}>Tem certeza que deseja apagar o registro de <strong>{customerToDelete.name}</strong>? Todo o histórico dele será desvinculado.</p>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--surface-light)', color: 'var(--text-primary)' }} onClick={() => setCustomerToDelete(null)}>
                Cancelar
              </button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)' }} onClick={executeDelete}>
                Sim, Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModal.isOpen && (
        <div className="modal-overlay">
          <div className="glass-panel responsive-modal" style={{ width: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>Registrar Pagamento</h3>
               <X style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setPaymentModal({isOpen: false, customerId: '', balance: 0})} />
            </div>
            
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Dívida Atual em Aberto</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--danger)' }}>R$ {paymentModal.balance.toFixed(2)}</div>
            </div>

            <div>
              <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Valor Sendo Pago Agora (R$)</label>
              <input 
                autoFocus
                className="input-glass" 
                type="number" 
                placeholder="Ex: 500.00" 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePayment()}
              />
            </div>
            
            <button className="btn-primary" onClick={handlePayment} style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
               <CreditCard size={20} />
               Confirmar Abatimento
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
