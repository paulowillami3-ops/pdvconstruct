import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product } from '../database/db';
import { PackageOpen, Plus, X, Tag, Hash, DollarSign, Edit2, Trash2, AlertTriangle, Search, Truck } from 'lucide-react';

export default function InventoryView() {
  const currentUserJson = localStorage.getItem('currentUser');
  const currentUser = currentUserJson ? JSON.parse(currentUserJson) : null;
  const tenantId = currentUser?.tenant_id;

  const products = useLiveQuery(
    () => tenantId ? db.products.where('tenant_id').equals(tenantId).toArray() : []
  , [tenantId]) || [];

  const suppliers = useLiveQuery(
    () => tenantId ? db.suppliers.where('tenant_id').equals(tenantId).toArray() : []
  , [tenantId]) || [];
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  );

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    price_cost: '',
    price_sell: '',
    stock_current: '',
    unit_type: 'unidade',
    supplier_id: '',
    purchase_unit: '',
    sale_unit: 'unidade',
    conversion_factor: '1'
  });

  const openNewModal = () => {
    setEditingProductId(null);
    setFormData({ 
      name: '', 
      barcode: '', 
      price_cost: '', 
      price_sell: '', 
      stock_current: '', 
      unit_type: 'unidade', 
      supplier_id: '',
      purchase_unit: '',
      sale_unit: 'unidade',
      conversion_factor: '1'
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProductId(p.id);
    setFormData({
      name: p.name,
      barcode: p.barcode,
      price_cost: p.price_cost.toString(),
      price_sell: p.price_sell.toString(),
      stock_current: p.stock_current.toString(),
      unit_type: p.unit_type,
      supplier_id: p.supplier_id || '',
      purchase_unit: p.purchase_unit || '',
      sale_unit: p.sale_unit || p.unit_type,
      conversion_factor: (p.conversion_factor || 1).toString()
    });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProductId) {
        await db.products.update(editingProductId, {
          name: formData.name,
          barcode: formData.barcode,
          price_cost: Number(formData.price_cost),
          price_sell: Number(formData.price_sell),
          stock_current: Number(formData.stock_current),
          unit_type: formData.sale_unit || formData.unit_type,
          supplier_id: formData.supplier_id || undefined,
          purchase_unit: formData.purchase_unit || undefined,
          sale_unit: formData.sale_unit || undefined,
          conversion_factor: Number(formData.conversion_factor) || 1,
          synced: false
        });
      } else {
        const pid = crypto.randomUUID();
        await db.products.add({
          id: pid,
          tenant_id: tenantId,
          synced: false,
          name: formData.name,
          barcode: formData.barcode,
          price_cost: Number(formData.price_cost),
          price_sell: Number(formData.price_sell),
          stock_current: Number(formData.stock_current),
          created_at: Date.now(),
          category: 'geral',
          unit_type: formData.sale_unit || formData.unit_type,
          stock_min: 5,
          volume_discount_strategy: 'none',
          status: 'active',
          supplier_id: formData.supplier_id || undefined,
          purchase_unit: formData.purchase_unit || undefined,
          sale_unit: formData.sale_unit || undefined,
          conversion_factor: Number(formData.conversion_factor) || 1
        });
        await db.stock_logs.add({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          synced: false,
          product_id: pid,
          type: 'initial',
          change_amount: Number(formData.stock_current),
          timestamp: Date.now(),
          notes: `Cadastro Inicial (${formData.unit_type})`
        });
      }
      setIsAddModalOpen(false);
      setFormData({ name: '', barcode: '', price_cost: '', price_sell: '', stock_current: '', unit_type: 'unidade', supplier_id: '', purchase_unit: '', sale_unit: 'unidade', conversion_factor: '1' });
      setEditingProductId(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar produto!');
    }
  };

  const executeDelete = async () => {
    if (!productToDelete) return;
    await db.products.delete(productToDelete.id);
    setProductToDelete(null);
  };

  return (
    <>
    <div className="responsive-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', gap: '32px' }}>
      <header className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)' }}>Estoque Atual</h2>
          <p style={{ color: 'var(--text-muted)' }}>Lista de produtos cadastrados.</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={openNewModal}>
          <Plus size={20} />
          Novo Item
        </button>
      </header>

      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Search color="var(--text-muted)" />
        <input 
          type="text" 
          placeholder="Pesquisar por nome ou código de barras..." 
          className="input-glass" 
          style={{ border: 'none', padding: '8px 0', fontSize: '16px' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-panel" style={{ flex: 1, padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="responsive-table-wrapper mobile-cards-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Produto & Codigo</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Custo</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Venda</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Quantidade Atual</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', width: '120px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'var(--surface-glass-light)' }}>
                  <td data-label="Produto" style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {p.barcode} 
                      {p.supplier_id && ` • ${suppliers.find(s => s.id === p.supplier_id)?.name || 'Fornecedor Desconhecido'}`}
                    </div>
                  </td>
                  <td data-label="Preço de Custo" style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>R$ {p.price_cost.toFixed(2)}</td>
                  <td data-label="Preço de Venda" style={{ padding: '16px 24px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>R$ {p.price_sell.toFixed(2)}</td>
                  <td data-label="Qtd Atual" style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: p.stock_current <= p.stock_min ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-secondary)', color: p.stock_current <= p.stock_min ? 'var(--warning)' : 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <PackageOpen size={16} />
                      {p.stock_current} {p.unit_type}
                    </div>
                  </td>
                  <td data-label="Ações" style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openEditModal(p)} style={{ background: 'var(--surface-light)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-secondary)' }}>
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => setProductToDelete(p)} style={{ background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--danger)' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel responsive-modal" style={{ width: '460px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{editingProductId ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                style={{ background: 'var(--surface-light)', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Nome do Produto</label>
                <div style={{ position: 'relative' }}>
                  <Tag style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                  <input required autoFocus className="input-glass" style={{ paddingLeft: '48px' }} placeholder="Ex: Cimento CP II" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Código de Barras ou SKU Interno (Opcional)</label>
                <div style={{ position: 'relative' }}>
                  <Hash style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                  <input className="input-glass" style={{ paddingLeft: '48px' }} placeholder="Ex: 789123456" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
                </div>
              </div>

              <div className="responsive-form-row" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Preço de Custo (R$)</label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                    <input required min="0" step="0.01" type="number" className="input-glass" style={{ paddingLeft: '48px' }} placeholder="0.00" value={formData.price_cost} onChange={e => setFormData({...formData, price_cost: e.target.value})} />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Preço de Venda (R$)</label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--accent-primary)' }} size={20} />
                    <input required min="0" step="0.01" type="number" className="input-glass" style={{ paddingLeft: '48px', color: 'var(--accent-primary)', fontWeight: 'bold' }} placeholder="0.00" value={formData.price_sell} onChange={e => setFormData({...formData, price_sell: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="responsive-form-row" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Quantidade Inicial em Estoque</label>
                  <div style={{ position: 'relative' }}>
                    <PackageOpen style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                    <input required min="0" step="1" type="number" className="input-glass" style={{ paddingLeft: '48px' }} placeholder="0" value={formData.stock_current} onChange={e => setFormData({...formData, stock_current: e.target.value})} />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Unidade de Venda</label>
                  <select className="input-glass" style={{ cursor: 'pointer' }} value={formData.sale_unit} onChange={e => setFormData({...formData, sale_unit: e.target.value, unit_type: e.target.value})}>
                    <option value="unidade" style={{ color: '#000' }}>Unidade (un)</option>
                    <option value="saco" style={{ color: '#000' }}>Saco</option>
                    <option value="kg" style={{ color: '#000' }}>Peso (kg)</option>
                    <option value="m" style={{ color: '#000' }}>Metro (m)</option>
                    <option value="m2" style={{ color: '#000' }}>Metro Q. (m²)</option>
                  </select>
                </div>
              </div>

              <div className="responsive-form-row" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Unidade de Compra (Opcional)</label>
                  <input className="input-glass" placeholder="Ex: CX / FARDO" value={formData.purchase_unit} onChange={e => setFormData({...formData, purchase_unit: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Fator Conversão (X vda)</label>
                  <input type="number" step="0.001" className="input-glass" placeholder="Ex: 12" value={formData.conversion_factor} onChange={e => setFormData({...formData, conversion_factor: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Fornecedor Preferencial (Opcional)</label>
                <div style={{ position: 'relative' }}>
                  <Truck style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                  <select 
                    className="input-glass" 
                    style={{ paddingLeft: '48px', cursor: 'pointer' }} 
                    value={formData.supplier_id} 
                    onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                  >
                    <option value="" style={{ color: '#000' }}>Nenhum fornecedor selecionado</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button className="btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', marginTop: '16px', fontSize: '16px' }}>
                {editingProductId ? 'Salvar Alterações' : 'Concluir Cadastro'}
              </button>

            </form>
          </div>
        </div>
      )}

      {productToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel responsive-modal" style={{ width: '380px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
            <AlertTriangle color="var(--danger)" size={48} />
            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>Remover Produto?</h3>
            <p style={{ color: 'var(--text-muted)' }}>Tem certeza que deseja apagar o produto <strong>{productToDelete.name}</strong>? Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--surface-light)', color: 'var(--text-primary)' }} onClick={() => setProductToDelete(null)}>
                Cancelar
              </button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)' }} onClick={executeDelete}>
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
