import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product, generateId } from '../database/db';
import { Plus, Trash2, Search, Truck, Save, X, Factory, Scale } from 'lucide-react';

interface PurchaseItemInput {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
  useConversion: boolean;
  conversionFactor: number;
  purchaseUnit: string;
  saleUnit: string;
}

export default function PurchasesView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [items, setItems] = useState<PurchaseItemInput[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  
  // Quick Create State
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateData, setQuickCreateData] = useState({
    name: '',
    barcode: '',
    priceSell: '',
    unitType: 'unidade',
    supplierId: '',
    purchaseUnit: '',
    conversionFactor: '1'
  });

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const tenantId = currentUser.tenant_id;

  const suppliers = useLiveQuery(() => 
    tenantId ? db.suppliers.where('tenant_id').equals(tenantId).toArray() : []
  , [tenantId]) || [];

  const products = useLiveQuery(() => 
    tenantId ? db.products.where('tenant_id').equals(tenantId).toArray() : []
  , [tenantId]) || [];

  const purchases = useLiveQuery(() => 
    tenantId ? db.purchases.where('tenant_id').equals(tenantId).reverse().toArray() : []
  , [tenantId]) || [];

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) || p.barcode.includes(searchProduct)
  ).slice(0, 5);

  const addItem = (p: Product) => {
    if (items.find(i => i.productId === p.id)) return;
    setItems([...items, { 
      productId: p.id, 
      name: p.name, 
      quantity: 1, 
      unitCost: p.price_cost,
      useConversion: !!p.purchase_unit,
      conversionFactor: p.conversion_factor || 1,
      purchaseUnit: p.purchase_unit || '',
      saleUnit: p.sale_unit || p.unit_type
    }]);
    setSearchProduct('');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.productId !== id));
  };

  const updateItem = (id: string, updates: Partial<PurchaseItemInput>) => {
    setItems(items.map(i => i.productId === id ? { ...i, ...updates } : i));
  };

  const calculateTotal = () => items.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);

  const handleSavePurchase = async () => {
    if (!selectedSupplierId || items.length === 0 || !tenantId) {
      alert('Selecione um fornecedor e adicione itens.');
      return;
    }

    const purchaseId = generateId();
    const totalCost = calculateTotal();

    try {
      await db.transaction('rw', db.purchases, db.purchase_items, db.products, db.stock_logs, async () => {
        await db.purchases.add({
          id: purchaseId,
          tenant_id: tenantId,
          synced: false,
          supplier_id: selectedSupplierId,
          total_cost: totalCost,
          timestamp: Date.now()
        });

        for (const item of items) {
          const finalStockAdd = item.useConversion ? item.quantity * item.conversionFactor : item.quantity;

          await db.purchase_items.add({
            id: generateId(),
            tenant_id: tenantId,
            synced: false,
            purchase_id: purchaseId,
            product_id: item.productId,
            quantity: item.quantity,
            unit_cost: item.unitCost
          });

          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, {
              stock_current: product.stock_current + finalStockAdd,
              price_cost: item.unitCost
            });

            await db.stock_logs.add({
              id: generateId(),
              tenant_id: tenantId,
              synced: false,
              product_id: item.productId,
              change_amount: finalStockAdd,
              type: 'purchase',
              notes: `Compra ref: ${purchaseId.slice(0,8)}${item.useConversion ? ` (Conv. ${item.purchaseUnit}->${item.saleUnit})` : ''}`,
              timestamp: Date.now()
            });
          }
        }
      });

      setIsModalOpen(false);
      setItems([]);
      setSelectedSupplierId('');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar compra.');
    }
  };

  return (
    <div className="responsive-view overflow-auto" style={{ padding: '32px', gap: '32px', height: '100%' }}>
      
      <header className="responsive-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)' }} className="flex items-center gap-3">
            <Factory size={32} className="text-orange-400" /> Entrada de Mercadorias
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Registre compras e gerencie conversão de unidades para o estoque.</p>
        </div>
        
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          Registrar Compra
        </button>
      </header>

      <div className="glass-panel" style={{ flex: 1, padding: '0', overflowY: 'auto' }}>
        <div className="responsive-table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Data/Hora</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Fornecedor</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Valor Total</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600' }}>Referência</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p, idx) => {
                const supplier = suppliers.find(s => s.id === p.supplier_id);
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'var(--surface-glass-light)' }}>
                    <td style={{ padding: '16px 24px' }}>{new Date(p.timestamp).toLocaleString()}</td>
                    <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{supplier?.name || 'Vários'}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>R$ {p.total_cost.toFixed(2)}</td>
                    <td style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)' }}>{p.id.slice(0, 8).toUpperCase()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel responsive-modal" style={{ width: '900px', height: '90vh', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '24px', color: 'var(--text-primary)' }}>Nova Entrada de Mercadoria</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'var(--surface-light)', borderRadius: '50%', padding: '8px' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Fornecedor</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <select 
                    className="input-glass w-full pl-12"
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                  >
                    <option value="" className="text-black">Selecione o fornecedor...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id} className="text-black">{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Buscar Produto</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    className="input-glass w-full pl-12"
                    placeholder="Nome ou Código de Barras..."
                    value={searchProduct}
                    onChange={e => setSearchProduct(e.target.value)}
                  />
                  {searchProduct && (
                    <div className="glass-panel absolute top-full left-0 right-0 z-[101] mt-2 p-2 shadow-2xl">
                      {filteredProducts.map(p => (
                        <div key={p.id} className="p-3 hover:bg-white/5 cursor-pointer rounded-lg transition-colors border-b border-white/5 last:border-0" onClick={() => addItem(p)}>
                          <div className="font-bold text-white">{p.name}</div>
                          <div className="text-xs text-gray-400">
                             Estoque: {p.stock_current} {p.unit_type} 
                             {p.purchase_unit && <span className="text-blue-400 ml-2">• Compra: 1 {p.purchase_unit} = {p.conversion_factor} {p.sale_unit}</span>}
                          </div>
                        </div>
                      ))}
                      {filteredProducts.length === 0 && (
                        <div className="p-4 text-center cursor-pointer border-2 border-dashed border-blue-500/30 rounded-xl text-blue-400 font-bold flex flex-col items-center gap-2"
                          onClick={() => {
                            setQuickCreateData({ ...quickCreateData, name: searchProduct, supplierId: selectedSupplierId });
                            setIsQuickCreateOpen(true);
                          }}
                        >
                          <Plus size={24} />
                          Produto novo? Cadastrar Agora
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto border border-white/5 rounded-2xl">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#0f172a] border-b border-white/10">
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                    <th className="p-4">Produto</th>
                    <th className="p-4">Custo Un.</th>
                    <th className="p-4">Qtd. Compra</th>
                    <th className="p-4 text-center">Converter?</th>
                    <th className="p-4">Qtd. Estoque</th>
                    <th className="p-4 text-right">Subtotal</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map(item => (
                    <tr key={item.productId} className="group hover:bg-white/[0.02]">
                      <td className="p-4">
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase">{item.purchaseUnit || 'Sem unidade de compra'}</div>
                      </td>
                      <td className="p-4">
                        <input 
                          type="number" step="0.01" className="bg-white/5 border-0 rounded p-2 w-24 text-white"
                          value={item.unitCost}
                          onChange={e => updateItem(item.productId, { unitCost: parseFloat(e.target.value) })}
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="number" className="bg-white/5 border-0 rounded p-2 w-20 text-white"
                          value={item.quantity}
                          onChange={e => updateItem(item.productId, { quantity: parseFloat(e.target.value) })}
                        />
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => updateItem(item.productId, { useConversion: !item.useConversion })}
                          className={`p-2 rounded-lg transition-all ${item.useConversion ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-600'}`}
                        >
                          <Scale size={16} />
                        </button>
                      </td>
                      <td className="p-4 font-mono text-gray-400">
                        {item.useConversion ? (item.quantity * item.conversionFactor).toFixed(2) : item.quantity} {item.saleUnit}
                      </td>
                      <td className="p-4 text-right font-bold text-white">
                        R$ {(item.quantity * item.unitCost).toFixed(2)}
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => removeItem(item.productId)} className="text-gray-600 hover:text-red-400"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-white/5 p-6 rounded-3xl">
              <div>
                <p className="text-gray-400 text-sm">Total da Fatura/Pedido</p>
                <h4 className="text-4xl font-black text-orange-400">R$ {calculateTotal().toFixed(2)}</h4>
              </div>
              <button 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-12 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-xl shadow-blue-500/20"
                onClick={handleSavePurchase}
              >
                <Save size={24} /> Finalizar Entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Product Modal */}
      {isQuickCreateOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-8 shadow-2xl border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Cadastro Rápido</h3>
              <button onClick={() => setIsQuickCreateOpen(false)} className="text-gray-500 hover:text-white"><X /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Nome do Produto</label>
                <input className="input-glass w-full" value={quickCreateData.name} onChange={e => setQuickCreateData({...quickCreateData, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Preço Venda (R$)</label>
                  <input type="number" step="0.01" className="input-glass w-full font-bold text-blue-400" value={quickCreateData.priceSell} onChange={e => setQuickCreateData({...quickCreateData, priceSell: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Unidade Venda</label>
                  <select className="input-glass w-full" value={quickCreateData.unitType} onChange={e => setQuickCreateData({...quickCreateData, unitType: e.target.value})}>
                    <option value="unidade" className="text-black">un</option>
                    <option value="saco" className="text-black">saco</option>
                    <option value="kg" className="text-black">kg</option>
                    <option value="m" className="text-black">m</option>
                    <option value="m2" className="text-black">m²</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Un. Compra</label>
                  <input className="input-glass w-full" placeholder="Ex: CX / FARDO" value={quickCreateData.purchaseUnit} onChange={e => setQuickCreateData({...quickCreateData, purchaseUnit: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Fator Conv.</label>
                  <input type="number" className="input-glass w-full" value={quickCreateData.conversionFactor} onChange={e => setQuickCreateData({...quickCreateData, conversionFactor: e.target.value})} />
                </div>
              </div>

              <button 
                className="w-full btn-primary py-4 mt-4 font-bold"
                onClick={async () => {
                  if (!quickCreateData.name || !quickCreateData.priceSell) return alert('Pelo menos nome e preço de venda são necessários.');
                  
                  const newPid = crypto.randomUUID();
                  const newProduct: Product = {
                    id: newPid,
                    tenant_id: tenantId,
                    synced: false,
                    name: quickCreateData.name,
                    barcode: quickCreateData.barcode || `AUTO-${Date.now()}`,
                    price_cost: 0,
                    price_sell: parseFloat(quickCreateData.priceSell),
                    stock_current: 0,
                    stock_min: 5,
                    category: 'geral',
                    unit_type: quickCreateData.unitType,
                    status: 'active',
                    created_at: Date.now(),
                    volume_discount_strategy: 'none',
                    supplier_id: quickCreateData.supplierId || undefined,
                    purchase_unit: quickCreateData.purchaseUnit || undefined,
                    sale_unit: quickCreateData.unitType,
                    conversion_factor: parseFloat(quickCreateData.conversionFactor) || 1
                  };

                  try {
                    await db.products.add(newProduct);
                    addItem(newProduct);
                    setIsQuickCreateOpen(false);
                  } catch (e) {
                    console.error(e);
                    alert('Erro ao criar produto rapidamente.');
                  }
                }}
              >
                Cadastrar e Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
