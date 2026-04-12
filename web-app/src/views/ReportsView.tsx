import { useState, useMemo, Fragment } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { Download, Calendar as CalendarIcon, LayoutList, TrendingUp, AlertCircle, DollarSign, PieChart, ChevronDown, ChevronRight } from 'lucide-react';

export default function ReportsView() {
  const [filterMode, setFilterMode] = useState<'today'|'week'|'month'|'custom'>('today');
  const [customStart, setCustomStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);


  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const tenantId = currentUser.tenant_id;

  // Use Dexie live queries with strict tenant filtering
  const sales = useLiveQuery(() => db.sales.where('tenant_id').equals(tenantId).toArray(), [tenantId]) || [];
  const saleItems = useLiveQuery(() => db.sale_items.where('tenant_id').equals(tenantId).toArray(), [tenantId]) || [];
  const products = useLiveQuery(() => db.products.where('tenant_id').equals(tenantId).filter(p => p.status !== 'deleted').toArray(), [tenantId]) || [];
  const expenses = useLiveQuery(() => db.expenses.where('tenant_id').equals(tenantId).toArray(), [tenantId]) || [];
  const customers = useLiveQuery(() => db.customers.where('tenant_id').equals(tenantId).toArray(), [tenantId]) || [];
  
  // Apply date filters in memory since array is fast to process client-side
  const filteredSales = useMemo(() => {
    let startMs = 0;
    let endMs = Number.MAX_SAFE_INTEGER;
    const now = new Date();

    if (filterMode === 'today') {
      now.setHours(0,0,0,0);
      startMs = now.getTime();
    } else if (filterMode === 'week') {
      now.setHours(0,0,0,0);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // get monday
      startMs = new Date(now.setDate(diff)).getTime();
    } else if (filterMode === 'month') {
      startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    } else if (filterMode === 'custom') {
      startMs = new Date(customStart + 'T00:00:00').getTime();
      endMs = new Date(customEnd + 'T23:59:59').getTime();
    }

    // Optimization: Pre-sort or filter by date
    return sales.filter(s => s.timestamp >= startMs && s.timestamp <= endMs);
  }, [sales, filterMode, customStart, customEnd]);

  // Calculate summaries
  const totalMoney = filteredSales.filter(s => s.payment_method === 'dinheiro').reduce((a, b) => a + b.total_amount, 0);
  const totalPix = filteredSales.filter(s => s.payment_method === 'pix').reduce((a, b) => a + b.total_amount, 0);
  const totalCard = filteredSales.filter(s => s.payment_method === 'cartao').reduce((a, b) => a + b.total_amount, 0);
  const totalCredit = filteredSales.filter(s => s.payment_method === 'fiado').reduce((a, b) => a + b.total_amount, 0);
  const grandTotal = totalMoney + totalPix + totalCard + totalCredit;
  const ticketMedio = filteredSales.length > 0 ? grandTotal / filteredSales.length : 0;

  const filteredExpenses = useMemo(() => {
    let startMs = 0;
    let endMs = Number.MAX_SAFE_INTEGER;
    const now = new Date();

    if (filterMode === 'today') {
      now.setHours(0,0,0,0);
      startMs = now.getTime();
    } else if (filterMode === 'week') {
      now.setHours(0,0,0,0);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startMs = new Date(now.setDate(diff)).getTime();
    } else if (filterMode === 'month') {
      startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    } else if (filterMode === 'custom') {
      startMs = new Date(customStart + 'T00:00:00').getTime();
      endMs = new Date(customEnd + 'T23:59:59').getTime();
    }

    return expenses.filter(e => e.due_date >= startMs && e.due_date <= endMs);
  }, [expenses, filterMode, customStart, customEnd]);

  const totalExpenses = filteredExpenses.reduce((a, b) => a + b.amount, 0);

  // Efficiency/Profitability
  const estimatedProfit = useMemo(() => {
    let totalCogs = 0;
    const saleIds = new Set(filteredSales.map(s => s.id));
    const productMap = new Map(products.map(p => [p.id, p]));

    saleItems.forEach(item => {
      if (saleIds.has(item.sale_id)) {
        const product = productMap.get(item.product_id);
        if (product) {
          totalCogs += (product.price_cost * item.quantity);
        }
      }
    });
    return grandTotal - totalCogs;
  }, [filteredSales, saleItems, products, grandTotal]);

  const netProfit = estimatedProfit - totalExpenses;

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock_current <= p.stock_min);
  }, [products]);

  const productSalesReport = useMemo(() => {
    const report: Record<string, { product: any, items: any[], totalQty: number, totalValue: number }> = {};
    const saleMap = new Map(filteredSales.map(s => [s.id, s]));
    const productMap = new Map(products.map(p => [p.id, p]));
    const customerMap = new Map(customers.map(c => [c.id, c]));
    
    saleItems.forEach(item => {
      const sale = saleMap.get(item.sale_id);
      if (sale) {
        if (!report[item.product_id]) {
          const product = productMap.get(item.product_id);
          if (product) {
            report[item.product_id] = { product, items: [], totalQty: 0, totalValue: 0 };
          }
        }
        
        if (report[item.product_id]) {
          const customer = customerMap.get(sale.customer_id);
          report[item.product_id].items.push({
            id: item.id,
            date: sale.timestamp,
            qty: item.quantity,
            customerName: customer?.name || 'Não Identificado',
            total: item.total_item_price
          });
          report[item.product_id].totalQty += item.quantity;
          report[item.product_id].totalValue += item.total_item_price;
        }
      }
    });

    return Object.values(report).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredSales, saleItems, products, customers]);




  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="report-container responsive-container responsive-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', gap: '24px', overflowY: 'auto' }}>
      
      <header className="hide-on-print responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>Gerencial & Caixa</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Métricas, fluxo do dinheiro e exportação.</p>
        </div>
        <div className="responsive-tools">

          <button className="btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
            <Download size={20} /> Exportar PDF
          </button>
        </div>
      </header>

      {/* Date Filters Controller */}
      <div className="glass-panel hide-on-print" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <CalendarIcon size={24} color="var(--text-muted)" className="hide-on-mobile" />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <FilterBtn active={filterMode==='today'} onClick={() => setFilterMode('today')} label="Hoje" />
          <FilterBtn active={filterMode==='week'} onClick={() => setFilterMode('week')} label="Nesta Semana" />
          <FilterBtn active={filterMode==='month'} onClick={() => setFilterMode('month')} label="Neste Mês" />
          <FilterBtn active={filterMode==='custom'} onClick={() => setFilterMode('custom')} label="Personalizado" />
        </div>

        {filterMode === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>De:</span>
            <input type="date" className="input-glass" style={{ width: 'auto', padding: '8px 12px' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Até:</span>
            <input type="date" className="input-glass" style={{ width: 'auto', padding: '8px 12px' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        )}
      </div>

      {/* Internal Print Header only visible when printing */}
      <div className="only-on-print" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1>Relatório Gerencial - Construx PDV</h1>
        <p>Período Filtrado: {filteredSales.length} transações.</p>
        <hr style={{ margin: '16px 0', borderColor: '#ccc' }} />
      </div>

      {/* Dashboard Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        <MetricCard title="Total Bruto Recebido" value={grandTotal} highlight={true} icon={<TrendingUp size={24} />} />
        <MetricCard title="Lucro Bruto Est." value={estimatedProfit} success={true} icon={<PieChart size={24} />} sub="Vendas - Custos Diretos" />
        <MetricCard title="Despesas Totais" value={totalExpenses} danger={totalExpenses > 0} icon={<AlertCircle size={24} />} sub="Gastos Operacionais" />
        <MetricCard title="Lucro Real Líquido" value={netProfit} highlight={true} style={{ border: '2px solid var(--accent-primary)' }} icon={<DollarSign size={24} />} sub="Lucro Bruto - Despesas" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        <MetricCard title="Ticket Médio" value={ticketMedio} icon={<LayoutList size={24} />} />
        <MetricCard title="Estoque Baixo" value={lowStockProducts.length} isCount={true} danger={lowStockProducts.length > 0} icon={<AlertCircle size={24} />} />
        <MetricCard title="Entrada Dinheiro" value={totalMoney} sub="Na gaveta" />
        <MetricCard title="Entrada PIX" value={totalPix} sub="Na conta" />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        <MetricCard title="Entrada Cartão" value={totalCard} sub="Na maquininha" />
        <MetricCard title="Crediário / Fiado" value={totalCredit} danger={true} sub="A receber futura" />
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        <div className="glass-panel hide-on-print" style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <AlertCircle color="var(--danger)" />
             <h3 style={{ fontSize: '18px' }}>Alertas de Alerta de Estoque</h3>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {lowStockProducts.map(p => (
               <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--danger)' }}>Apenas {p.stock_current} {p.unit_type} restando</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mín: {p.stock_min}</div>
               </div>
             ))}
             {lowStockProducts.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Estoque em dia.</div>}
          </div>
        </div>

        {/* Sales List */}
        <div className="glass-panel print-flatten" style={{ flex: 2, minWidth: '400px', padding: '0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LayoutList color="var(--accent-primary)" />
          <h3 style={{ fontSize: '18px' }}>Extrato de Operações</h3>
        </div>
        <div className="responsive-table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600' }}>DATA/HORA</th>
                <th style={{ padding: '12px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600' }}>MÉTODO</th>
                <th style={{ padding: '12px 24px', color: 'var(--text-primary)', opacity: 0.6, fontWeight: '600' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale, idx) => (
                 <tr key={sale.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'var(--surface-glass-light)' }}>
                   <td style={{ padding: '12px 24px' }}>{new Date(sale.timestamp).toLocaleString()}</td>
                   <td style={{ padding: '12px 24px', textTransform: 'capitalize' }}>{sale.payment_method}</td>
                   <td style={{ padding: '12px 24px', fontWeight: 'bold' }}>R$ {sale.total_amount.toFixed(2)}</td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSales.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma operação encontrada no período.</div>
        )}
      </div>
      </div>

      {/* Relatório por Produto */}
      <div className="glass-panel print-flatten" style={{ padding: '0', display: 'flex', flexDirection: 'column', marginTop: '24px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrendingUp color="var(--success)" />
          <h3 style={{ fontSize: '18px' }}>Relatório de Vendas por Produto (Agrupado)</h3>
        </div>
        <div className="responsive-table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '12px 24px', color: 'var(--text-primary)', opacity: 0.6 }}>PRODUTO</th>
                <th style={{ padding: '12px 24px', color: 'var(--text-primary)', opacity: 0.6 }}>TOTAL QTD</th>
                <th style={{ padding: '12px 24px', color: 'var(--text-primary)', opacity: 0.6 }}>TOTAL VALOR</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {productSalesReport.map((group) => (
                <Fragment key={group.product.id}>
                  <tr 
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: expandedProduct === group.product.id ? 'var(--surface-glass-light)' : 'transparent' }}
                    onClick={() => setExpandedProduct(expandedProduct === group.product.id ? null : group.product.id)}
                  >
                    <td style={{ padding: '16px 24px', fontWeight: '700' }}>{group.product.name}</td>
                    <td style={{ padding: '16px 24px' }}>{group.totalQty} {group.product.unit_type}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--success)', fontWeight: 'bold' }}>R$ {group.totalValue.toFixed(2)}</td>
                    <td style={{ padding: '16px 24px' }}>
                      {expandedProduct === group.product.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </td>
                  </tr>
                  {expandedProduct === group.product.id && (
                    <tr>
                      <td colSpan={4} style={{ padding: '0 0 24px 24px', background: 'var(--surface-glass-dark)' }}>
                        <div style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: '20px', marginTop: '12px', overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '14px' }}>
                             <thead>
                               <tr style={{ color: 'var(--text-muted)' }}>
                                 <th style={{ padding: '8px 0', textAlign: 'left' }}>Data/Hora</th>
                                 <th style={{ padding: '8px 0', textAlign: 'left' }}>Cliente</th>
                                 <th style={{ padding: '8px 0', textAlign: 'left' }}>Qtd</th>
                                 <th style={{ padding: '8px 0', textAlign: 'right', paddingRight: '24px' }}>Total</th>
                               </tr>
                             </thead>
                             <tbody>
                               {group.items.sort((a,b) => b.date - a.date).map(item => (
                                 <tr key={item.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                   <td style={{ padding: '8px 0' }}>{new Date(item.date).toLocaleString()}</td>
                                   <td style={{ padding: '8px 0' }}>{item.customerName}</td>
                                   <td style={{ padding: '8px 0' }}>{item.qty}</td>
                                   <td style={{ padding: '8px 0', textAlign: 'right', paddingRight: '24px', fontWeight: '600' }}>R$ {item.total.toFixed(2)}</td>
                                 </tr>
                               ))}
                             </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}

const FilterBtn = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
  <button 
    onClick={onClick}
    style={{
      background: active ? 'var(--accent-glow)' : 'var(--bg-secondary)',
      color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
      border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
      padding: '8px 16px',
      borderRadius: 'var(--radius-sm)',
      fontWeight: '600',
      transition: 'all 0.2s'
    }}
  >
    {label}
  </button>
);

const MetricCard = ({ title, value, highlight, danger, success, sub, icon, isCount }: { title: string, value: number, highlight?: boolean, danger?: boolean, success?: boolean, sub?: string, icon?: React.ReactNode, isCount?: boolean }) => {
  let color = 'var(--text-primary)';
  if (highlight) {
    color = 'var(--accent-primary)';
  }
  if (danger) {
    color = 'var(--danger)';
  }
  if (success) {
    color = 'var(--success)';
  }

  return (
    <div className="glass-panel" style={{ 
      padding: '24px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px', 
      background: highlight ? 'var(--surface-primary)' : 'rgba(255,255,255,0.03)', 
      position: 'relative', 
      overflow: 'hidden',
      border: highlight ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
      boxShadow: highlight ? '0 8px 32px rgba(96, 165, 250, 0.15)' : 'none'
    }}>
      {icon && <div style={{ position: 'absolute', top: '16px', right: '16px', opacity: 0.4, color }}>{icon}</div>}
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: '900', color: highlight ? 'var(--text-primary)' : color, textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
        {isCount ? value : `R$ ${value.toFixed(2)}`}
      </div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>{sub}</div>}
    </div>
  );
};
