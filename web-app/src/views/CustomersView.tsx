import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, generateId } from '../database/db';
import { CreditCard, UserPlus, X, Edit2, Trash2, AlertTriangle, User, Search, Clock } from 'lucide-react';

export default function CustomersView() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, customerId: string, balance: number}>({isOpen: false, customerId: '', balance: 0});
  const [paymentAmount, setPaymentAmount] = useState('');
  const [search, setSearch] = useState('');
  
  // History Modal State
  const [historyModal, setHistoryModal] = useState<{isOpen: boolean, customerId: string, customerName: string}>({isOpen: false, customerId: '', customerName: ''});
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
    setName(''); setCpf(''); setPhone('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomerId(c.id);
    setName(c.name);
    setCpf(c.cpf);
    setPhone(c.phone);
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
            credit_limit: 999999,
            balance_owed: 0,
            status: 'active',
            created_at: Date.now()
         });
      }
      setIsAddModalOpen(false);
      setEditingCustomerId(null);
      setName(''); setCpf(''); setPhone('');
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
          await db.customer_payments.add({
            id: generateId(),
            tenant_id: tenantId,
            synced: false,
            customer_id: paymentModal.customerId,
            amount: amount,
            method: 'dinheiro',
            timestamp: Date.now()
          });

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
      
      <header className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>Gestão de Clientes</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Controle de fiados e histórico de compras.</p>
        </div>
        
        <div className="responsive-tools">
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', justifyContent: 'center' }} onClick={openNewModal}>
            <UserPlus size={20} /> Novo Cliente
          </button>
        </div>
      </header>

      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-secondary)' }} size={20} />
        <input 
          type="text" 
          className="input-glass" 
          style={{ paddingLeft: '48px', width: '100%' }}
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
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px' }}>CLIENTE & CONTATO</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px' }}>SALDO DEVEDOR (FIADO)</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'var(--surface-glass-light)' }}>
                  <td data-label="Cliente" style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 'bold', color: 'white' }}>{c.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{c.cpf} • {c.phone}</div>
                  </td>
                  <td data-label="Saldo / Fiado" style={{ padding: '16px 24px' }}>
                    <div style={{ color: c.balance_owed > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold', fontSize: '16px' }}>
                      R$ {c.balance_owed.toFixed(2)}
                    </div>
                  </td>
                  <td data-label="Ações" style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        onClick={async () => {
                           setHistoryModal({ isOpen: true, customerId: c.id, customerName: c.name });
                           setLoadingHistory(true);
                           const sales = await db.sales.where('customer_id').equals(c.id).reverse().sortBy('timestamp');
                           const salesWithItems = await Promise.all(sales.map(async s => {
                             const items = await db.sale_items.where('sale_id').equals(s.id).toArray();
                             const itemsWithNames = await Promise.all(items.map(async it => {
                               const prod = await db.products.get(it.product_id);
                               return { ...it, productName: prod?.name || 'Produto Removido' };
                             }));
                             return { ...s, items: itemsWithNames };
                           }));
                           setCustomerSales(salesWithItems);
                           setLoadingHistory(false);
                        }}
                        title="Ver Histórico de Compras"
                        className="btn-icon"
                        style={{ background: 'var(--surface-light)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--accent-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                        <Clock size={18} />
                      </button>
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
                  <td colSpan={3} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Modal */}
      {historyModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="glass-panel responsive-modal" style={{ width: '600px', maxWidth: '95vw', maxHeight: '80vh', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ fontSize: '22px', color: 'var(--text-primary)' }}>Histórico: {historyModal.customerName}</h3>
               <X style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setHistoryModal({isOpen: false, customerId: '', customerName: ''})} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando histórico...</div>
              ) : customerSales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhuma compra encontrada para este cliente.</div>
              ) : (
                customerSales.map(sale => (
                  <div key={sale.id} className="glass-panel" style={{ padding: '16px', background: 'var(--surface-glass-light)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        {new Date(sale.timestamp).toLocaleString('pt-BR')}
                      </div>
                      <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                        R$ {sale.total_amount.toFixed(2)} ({sale.payment_method.toUpperCase()})
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {sale.items.map((item: any) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span>{item.quantity}x {item.productName}</span>
                          <span style={{ color: 'var(--text-muted)' }}>R$ {item.total_item_price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
