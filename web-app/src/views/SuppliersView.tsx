import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Supplier } from '../database/db';
import { Truck, X, Edit2, Trash2, AlertTriangle, Search, Factory } from 'lucide-react';

export default function SuppliersView() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');

  const currentUserJson = localStorage.getItem('currentUser');
  const currentUser = currentUserJson ? JSON.parse(currentUserJson) : null;
  const tenantId = currentUser?.tenant_id;

  const suppliers = useLiveQuery(
    () => tenantId ? db.suppliers.where('tenant_id').equals(tenantId).toArray() : []
  , [tenantId]) || [];

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.cnpj.includes(search) ||
    s.phone.includes(search)
  );

  const openNewModal = () => {
    setEditingSupplierId(null);
    setName(''); setCnpj(''); setPhone('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplierId(s.id);
    setName(s.name);
    setCnpj(s.cnpj);
    setPhone(s.phone);
    setIsAddModalOpen(true);
  };

  const executeDelete = async () => {
    if(!supplierToDelete) return;
    try {
      await db.suppliers.delete(supplierToDelete.id);
      setSupplierToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir do banco.');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!name) return;
    
    try {
      if (editingSupplierId) {
         await db.suppliers.update(editingSupplierId, {
            name,
            cnpj,
            phone
         });
      } else {
         await db.suppliers.add({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            name,
            cnpj,
            phone,
            status: 'active',
            created_at: Date.now()
         });
      }
      setIsAddModalOpen(false);
      setEditingSupplierId(null);
      setName(''); setCnpj(''); setPhone('');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar fornecedor.');
    }
  };

  return (
    <div className="responsive-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', gap: '32px' }}>
      
      <header className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>Gestão de Fornecedores</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Controle de distribuidores, atacadistas e fábricas.</p>
        </div>
        
        <div className="responsive-tools">
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }} onClick={openNewModal}>
            <Truck size={20} /> Novo Fornecedor
          </button>
        </div>
      </header>

      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-secondary)' }} size={20} />
        <input 
          type="text" 
          className="input-glass" 
          style={{ paddingLeft: '48px', width: '100%' }}
          placeholder="Pesquisar por nome, CNPJ ou telefone..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-panel" style={{ flex: 1, padding: '0', overflowY: 'auto' }}>
        <div className="responsive-table-wrapper mobile-cards-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px' }}>FORNECEDOR</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px' }}>CNPJ</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px' }}>CONTATO OFICIAL</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600', fontSize: '13px', textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((s, idx) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'var(--surface-glass-light)' }}>
                  <td data-label="Fornecedor" style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                  </td>
                  <td data-label="CNPJ" style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>{s.cnpj}</td>
                  <td data-label="Contato Oficial" style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                    {s.phone}
                  </td>
                  <td data-label="Ações" style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button onClick={() => openEditModal(s)} style={{ background: 'var(--surface-light)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-secondary)' }}>
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => setSupplierToDelete(s)} style={{ background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--danger)' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum fornecedor encontrado.
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
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{editingSupplierId ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                style={{ background: 'var(--surface-light)', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Razão Social / Nome</label>
                <div style={{ position: 'relative' }}>
                  <Factory style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                  <input required autoFocus className="input-glass" style={{ paddingLeft: '48px' }} placeholder="Indústria de Cimentos SA" value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>

              <div className="responsive-form-row" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>CNPJ</label>
                  <input className="input-glass" placeholder="00.000.000/0001-00" value={cnpj} onChange={e => setCnpj(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Telefone</label>
                  <input className="input-glass" placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>

              <button className="btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', marginTop: '16px', fontSize: '16px' }}>
                {editingSupplierId ? 'Salvar Edição' : 'Concluir Cadastro'}
              </button>

            </form>
          </div>
        </div>
      )}

      {supplierToDelete && (
        <div className="modal-overlay">
          <div className="glass-panel responsive-modal" style={{ width: '380px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
            <AlertTriangle color="var(--danger)" size={48} />
            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>Remover Fornecedor?</h3>
            <p style={{ color: 'var(--text-muted)' }}>Tem certeza que deseja apagar o registro de <strong>{supplierToDelete.name}</strong>? Todo o histórico dele será desvinculado.</p>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--surface-light)', color: 'var(--text-primary)' }} onClick={() => setSupplierToDelete(null)}>
                Cancelar
              </button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)' }} onClick={executeDelete}>
                Sim, Apagar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
