import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product } from '../database/db';
import { Search, ShoppingCart, Plus, Minus, Trash2, Info, FileText, Truck, RefreshCcw, MapPin, DollarSign, Lock } from 'lucide-react';
import { generatePixPayload } from '../utils/pix';

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
}

export default function POSView() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [showPixModal, setShowPixModal] = useState(false);
  
  // Custom Alert Modal
  const [alertBox, setAlertBox] = useState<{message: string, isError: boolean} | null>(null);

  // Register Opening States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [initialBalance, setInitialBalance] = useState('');

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState<{
    items: CartItem[],
    total: number,
    paymentMethod: string,
    customerName?: string,
    deliveryAddress?: string,
    deliveryFee?: number,
    date: Date
  } | null>(null);

  const currentUserJson = localStorage.getItem('currentUser');
  const currentUser = currentUserJson ? JSON.parse(currentUserJson) : null;
  const tenantId = currentUser?.tenant_id;

  const products = useLiveQuery(
    () => tenantId 
      ? db.products.where('tenant_id').equals(tenantId).filter(p => p.status === 'active').toArray()
      : db.products.where('status').equals('active').toArray()
  , [tenantId]) || [];

  const customers = useLiveQuery(
    () => tenantId
      ? db.customers.where('tenant_id').equals(tenantId).filter(c => c.status === 'active').toArray()
      : db.customers.where('status').equals('active').toArray()
  , [tenantId]) || [];

  const openRegister = useLiveQuery(
    () => tenantId 
      ? db.cash_registers.where('tenant_id').equals(tenantId).filter(r => r.status === 'open').first()
      : db.cash_registers.where('status').equals('open').first()
  , [tenantId]) ?? null;

  // Carregamento unificado para evitar race conditions
  const allSettings = useLiveQuery(() => 
    tenantId 
      ? db.settings.where('tenant_id').equals(tenantId).toArray()
      : [] // Retorna vazio se não houver tenantId — NUNCA retorne todos para segurança total
  , [tenantId]) || [];
  
  const getSetting = (key: string, defaultValue: string = '') => {
    // Busca estritamente com prefixo de tenant (isolamento total)
    // Se não houver tenantId, não busca nada por segurança
    if (!tenantId) return defaultValue;
    const prefixedId = `${tenantId}:${key}`;
    return (
      allSettings.find(s => s.id === prefixedId)?.value ||
      defaultValue
    );
  };

  const pixKeyType = getSetting('pix_key_type', 'cpf');
  const pixKey = getSetting(`pix_key_${pixKeyType}`, getSetting('pix_key', '')); 
  const pixId = getSetting('pix_id', '***');

  // Debug payload logic
  const debugPayload = (amt: number) => {
    if (!pixKey) return '';
    const payload = generatePixPayload({
      key: pixKey.trim(),
      type: pixKeyType as any,
      txid: pixId,
      amount: amt
    });
    console.log(`[PIX DEBUG] Tipo: ${pixKeyType} | Chave: ${pixKey} | Payload:`, payload);
    return payload;
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  ).slice(0, 12); // limit for grid

  const addToCart = (product: Product) => {
    if (!openRegister) {
      setAlertBox({ message: 'Você precisa abrir o caixa antes de adicionar produtos.', isError: true });
      setShowRegisterModal(true);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      const newQty = existing ? existing.quantity + 1 : 1;
      
      let finalPrice = product.price_sell;
      if (product.volume_discount_strategy === 'auto' && newQty >= 10) {
        finalPrice = product.price_sell * 0.95;
      }

      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: newQty, price: finalPrice } : item);
      }
      return [...prev, { product, quantity: 1, price: finalPrice }];
    });
    setSearch('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        let finalPrice = item.product.price_sell;
        if (item.product.volume_discount_strategy === 'auto' && newQty >= 10) {
          finalPrice = item.product.price_sell * 0.95;
        }
        return { ...item, quantity: newQty, price: finalPrice };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.product.id !== id));

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleOpenRegister = async () => {
    const val = parseFloat(initialBalance);
    await db.cash_registers.add({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      synced: false,
      opened_at: Date.now(),
      closed_at: null,
      initial_balance: isNaN(val) ? 0 : val,
      closed_balance: null,
      status: 'open',
      notes: ''
    });
    setShowRegisterModal(false);
    setInitialBalance('');
    setAlertBox({ message: 'Caixa aberto com sucesso! Boas vendas.', isError: false });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return setAlertBox({message: 'O Carrinho está vazio.', isError: true});
    
    const subtotalCost = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const feeValue = isDelivery ? parseFloat(deliveryFee) || 0 : 0;
    const finalTotal = isReturnMode ? -subtotalCost : subtotalCost + feeValue;

    if (paymentMethod === 'fiado') {
      if (!selectedCustomerId) return setAlertBox({message: 'Selecione um cliente para vender no Fiado.', isError: true});
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer && (customer.balance_owed + finalTotal > customer.credit_limit)) {
        return setAlertBox({message: `Limite de crédito excedido para: ${customer.name}.`, isError: true});
      }
    }

    try {
      if (paymentMethod === 'pix' && !showPixModal) {
        setShowPixModal(true);
        return;
      }

      await db.transaction('rw', [db.sales, db.sale_items, db.products, db.customers, db.deliveries, db.stock_logs], async () => {
        const saleId = crypto.randomUUID();
        
        await db.sales.add({
          id: saleId,
          tenant_id: tenantId,
          synced: false,
          total_amount: finalTotal,
          payment_method: paymentMethod,
          customer_id: selectedCustomerId || 'avulso',
          status: 'completed',
          is_delivery: isDelivery,
          delivery_fee: feeValue,
          timestamp: Date.now(),
          created_at: Date.now()
        });

        if (isDelivery) {
          await db.deliveries.add({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            synced: false,
            sale_id: saleId,
            address: deliveryAddress,
            fee: feeValue,
            status: 'pending',
            schedule_date: new Date(scheduleDate).getTime()
          });
        }

        const itemsToAdd = cart.map(item => ({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          synced: false,
          sale_id: saleId,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_item_price: item.price * item.quantity
        }));

        await db.sale_items.bulkAdd(itemsToAdd);

        for (const item of cart) {
          const product = await db.products.get(item.product.id);
          if (product) {
            const stockChange = isReturnMode ? item.quantity : -item.quantity;
            await db.products.update(item.product.id, {
              stock_current: product.stock_current + stockChange
            });

            await db.stock_logs.add({
              id: crypto.randomUUID(),
              tenant_id: tenantId,
              synced: false,
              product_id: item.product.id,
              change_amount: stockChange,
              type: isReturnMode ? 'return' : 'sale',
              notes: `Venda ref: ${saleId.slice(0,8)}`,
              timestamp: Date.now()
            });
          }
        }

        if (paymentMethod === 'fiado' && selectedCustomerId) {
          const customer = await db.customers.get(selectedCustomerId);
          if (customer) {
            await db.customers.update(selectedCustomerId, {
              balance_owed: customer.balance_owed + finalTotal
            });
          }
        }
      });
      
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      setReceiptData({
        items: [...cart],
        total: finalTotal,
        paymentMethod: paymentMethod,
        customerName: customer ? customer.name : undefined,
        deliveryAddress: isDelivery ? deliveryAddress : undefined,
        deliveryFee: feeValue,
        date: new Date()
      });
      
      setCart([]);
      setSelectedCustomerId('');
      setIsDelivery(false);
      setDeliveryAddress('');
      setDeliveryFee('0');
      setIsReturnMode(false);
      setShowPixModal(false);
    } catch (e) {
        console.error(e);
        setAlertBox({message: 'Erro interno ao processar a venda.', isError: true});
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const closeReceipt = () => {
    setReceiptData(null);
  };

  return (
    <div className="responsive-container responsive-view" style={{ display: 'flex', height: '100%', padding: '24px', gap: '24px', position: 'relative' }}>
      
      {openRegister === null && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', maxWidth: '400px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '24px', borderRadius: '50%', color: 'var(--danger)' }}>
              <Lock size={48} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Caixa Fechado</h2>
              <p style={{ color: 'var(--text-muted)' }}>Você precisa abrir o caixa para começar a vender e gerenciar o catálogo.</p>
            </div>
            <button className="btn-primary" style={{ width: '100%', fontSize: '18px', padding: '16px' }} onClick={() => setShowRegisterModal(true)}>
              Abrir Caixa Agora
            </button>
          </div>
        </div>
      )}
      
      {/* Left side - Product Catalog */}
      <div className="responsive-catalog-panel hide-on-print" style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <header>
          <h2 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>Terminal de Vendas</h2>
          <p style={{ color: 'var(--text-muted)' }}>Busque produtos para adicionar ao carrinho</p>
        </header>

        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
          <input 
            type="text" 
            className="input-glass" 
            style={{ paddingLeft: '48px', fontSize: '18px' }}
            placeholder="Escaneie o código de barras ou digite o nome..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '16px',
          overflowY: 'auto',
          paddingRight: '8px'
        }}>
          {filteredProducts.map(p => (
            <div key={p.id} className="glass-panel" style={{ cursor: 'pointer', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }} onClick={() => addToCart(p)}>
              <div>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>{p.name}</h4>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.barcode} • Estq: {p.stock_current}</div>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '8px' }}>
                R$ {p.price_sell.toFixed(2)}
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum produto encontrado.</p>}
        </div>
      </div>

      {/* Right side - Cart & Checkout */}
      <div className="glass-panel responsive-cart-panel hide-on-print" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShoppingCart color="var(--accent-primary)" />
          <h3 style={{ fontSize: '20px' }}>Carrinho Atual</h3>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cart.map(item => (
            <div key={item.product.id} style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600' }}>{item.product.name}</div>
                <div style={{ fontSize: '14px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>R$ {item.price.toFixed(2)}</div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => updateQuantity(item.product.id, -1)} style={{ background: 'var(--surface-primary)', padding: '4px', borderRadius: '4px', color: 'white' }}><Minus size={16}/></button>
                <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, 1)} style={{ background: 'var(--surface-primary)', padding: '4px', borderRadius: '4px', color: 'white' }}><Plus size={16}/></button>
                <button onClick={() => removeFromCart(item.product.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '4px', borderRadius: '4px', marginLeft: '8px' }}><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>O carrinho está vazio.</div>}
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>Total a Pagar</span>
            <span style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>R$ {total.toFixed(2)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {['dinheiro', 'pix', 'cartao', 'fiado'].map(method => (
              <button 
                key={method}
                onClick={() => setPaymentMethod(method)}
                style={{ 
                  padding: '12px', 
                  borderRadius: 'var(--radius-sm)', 
                  border: `1px solid ${paymentMethod === method ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  background: paymentMethod === method ? 'var(--accent-glow)' : 'transparent',
                  color: 'white',
                  textTransform: 'capitalize',
                  fontWeight: '600'
                }}>
                {method}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
             <button 
                onClick={() => setIsReturnMode(!isReturnMode)}
                style={{ 
                  flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  background: isReturnMode ? 'var(--danger)' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px'
                }}>
                <RefreshCcw size={16} />
                {isReturnMode ? 'Modo Devolução Ativo' : 'Realizar Devolução'}
             </button>
             <button 
                onClick={() => setIsDelivery(!isDelivery)}
                style={{ 
                  flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  background: isDelivery ? 'var(--accent-glow)' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px'
                }}>
                <Truck size={16} />
                {isDelivery ? 'Entrega Agendada' : 'Marcar Entrega'}
             </button>
          </div>

          {isDelivery && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', background: 'var(--surface-light)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
               <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--text-muted)' }} />
                  <input 
                    className="input-glass" style={{ paddingLeft: '32px', fontSize: '14px' }} 
                    placeholder="Endereço de Entrega..." value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} 
                  />
               </div>
               <div style={{ position: 'relative' }}>
                  <DollarSign size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--accent-primary)' }} />
                  <input 
                    type="number" className="input-glass" style={{ paddingLeft: '32px', fontSize: '14px', color: 'var(--accent-primary)' }} 
                    placeholder="Taxa de Entrega (R$)" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} 
                  />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                 <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>Previsão de Entrega</label>
                 <input 
                    type="date" className="input-glass" style={{ fontSize: '14px' }} 
                    value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} 
                 />
               </div>
            </div>
          )}

          {paymentMethod === 'fiado' && (
            <select 
              className="input-glass" 
              value={selectedCustomerId} 
              onChange={e => setSelectedCustomerId(e.target.value)}
              style={{ marginBottom: '16px' }}
            >
              <option value="" style={{ color: 'black' }}>Selecione o Cliente (Obrigatório)...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id} style={{ color: 'black' }}>{c.name} - CPF: {c.cpf}</option>
              ))}
            </select>
          )}

          <button className="btn-primary" style={{ width: '100%', fontSize: '18px', padding: '16px' }} onClick={handleCheckout}>
            Finalizar Venda (Enter)
          </button>
        </div>

      </div>

      {alertBox && (
        <div className="hide-on-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel responsive-modal" style={{ width: '380px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
             <Info color={alertBox.isError ? 'var(--danger)' : 'var(--success)'} size={48} />
             <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{alertBox.isError ? 'Atenção' : 'Sucesso'}</h3>
             <p style={{ color: 'var(--text-muted)' }}>{alertBox.message}</p>
             <button className="btn-primary" style={{ width: '100%', marginTop: '16px', background: alertBox.isError ? 'var(--bg-secondary)' : undefined }} onClick={() => setAlertBox(null)}>
               Ok, Entendido
             </button>
          </div>
        </div>
      )}

      {showPixModal && (
        <div className="hide-on-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div className="glass-panel responsive-modal" style={{ width: '420px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', textAlign: 'center' }}>
             <div style={{ background: 'var(--accent-glow)', padding: '12px', borderRadius: '16px' }}>
                {pixKey ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=350x350&charset-target=UTF-8&ecc=M&data=${encodeURIComponent(
                      debugPayload(total + (isDelivery ? parseFloat(deliveryFee) || 0 : 0))
                    )}`} 
                    alt="PIX QR Code"
                    style={{ borderRadius: '8px', boxShadow: '0 0 20px var(--accent-glow)', width: '280px', height: '280px' }}
                  />
                ) : (
                  <div style={{ width: '250px', height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)', padding: '20px' }}>
                    Configure sua Chave PIX nas Configurações do Sistema.
                  </div>
                )}
             </div>
             <div>
                <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px' }}>Pagamento via PIX</h3>
                <p style={{ color: 'var(--text-muted)' }}>Aponte a câmera do celular ou copie o código.</p>
             </div>
             <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowPixModal(false)}>
                Confirmar Recebimento
             </button>
          </div>
        </div>
      )}

      {showRegisterModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div className="glass-panel" style={{ width: '380px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--success)' }}>
                <Lock size={24} />
                <h3 style={{ fontSize: '20px' }}>Abertura de Caixa</h3>
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Saldo Inicial em Dinheiro (R$)</label>
                <input 
                  type="number" 
                  className="input-glass" 
                  autoFocus
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={e => setInitialBalance(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleOpenRegister()}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Informe o valor que já está no gaveteiro hoje.</p>
             </div>

             <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-primary" style={{ flex: 1, background: 'var(--bg-secondary)' }} onClick={() => setShowRegisterModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleOpenRegister}>
                  Abrir Caixa
                </button>
             </div>
          </div>
        </div>
      )}

      {receiptData && (
        <div className="hide-on-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel responsive-modal" style={{ width: '400px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', textAlign: 'center' }}>
             <div style={{ width: '64px', height: '64px', background: 'var(--success-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart color="var(--success)" size={32} />
             </div>
             <div>
               <h3 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px' }}>Venda Concluída!</h3>
               <p style={{ color: 'var(--text-muted)' }}>O estoque foi baixado e o valor registrado.</p>
             </div>
             
             <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
               <button className="btn-primary" style={{ flex: 1, background: 'var(--surface-light)', color: 'var(--text-primary)' }} onClick={closeReceipt}>
                 Nova Venda
               </button>
               <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={handlePrint}>
                 <FileText size={18} />
                 Imprimir Recibo
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Estrutura Invisível para a Impressora Térmica */}
      {receiptData && (
        <div className="only-on-print">
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
            <h2 style={{ fontSize: '16px', margin: '0 0 2px 0' }}>CONSTRUX PDV</h2>
            <div style={{ fontSize: '10px' }}>Loja de Materiais </div>
            <div style={{ fontSize: '10px' }}>{receiptData.date.toLocaleString()}</div>
            <div style={{ borderBottom: '1px dashed #000', margin: '4mm 0' }}></div>
          </div>

          <div style={{ marginBottom: '4mm' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '2mm' }}>CUPOM NAO FISCAL</div>
            {receiptData.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                <div style={{ flex: 1, paddingRight: '2mm', wordBreak: 'break-word' }}>
                  {item.quantity}x {item.product.name}
                </div>
                <div>R$ {(item.price * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '4mm 0' }}></div>

          {receiptData.deliveryFee !== undefined && receiptData.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '1mm' }}>
              <span>Taxa de Entrega:</span>
              <span>R$ {receiptData.deliveryFee.toFixed(2)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginBottom: '2mm' }}>
            <span>TOTAL</span>
            <span>R$ {receiptData.total.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Pagamento:</span>
            <span style={{ textTransform: 'uppercase' }}>{receiptData.paymentMethod}</span>
          </div>

          {(receiptData.customerName || receiptData.deliveryAddress) && (
            <div style={{ marginTop: '2mm', fontSize: '12px', textAlign: 'left' }}>
              {receiptData.customerName && <div>Cliente: {receiptData.customerName}</div>}
              {receiptData.deliveryAddress && (
                <div style={{ marginTop: '2mm', border: '1px solid #000', padding: '1mm' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '10px' }}>ENDEREÇO DE ENTREGA:</div>
                  <div style={{ wordBreak: 'break-word' }}>{receiptData.deliveryAddress}</div>
                </div>
              )}
              {receiptData.customerName && (
                <div style={{ marginTop: '6mm', borderTop: '1px solid #000', paddingTop: '1mm', textAlign: 'center' }}>
                  Assinatura do Cliente
                </div>
              )}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '6mm', fontSize: '10px' }}>
            Obrigado e volte sempre!
          </div>
        </div>
      )}

    </div>
  );
}
