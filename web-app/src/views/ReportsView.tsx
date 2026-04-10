import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { Download, CalendarIcon, LayoutList, TrendingUp, AlertCircle, DollarSign, PieChart } from 'lucide-react';

export default function ReportsView() {
  const [filterMode, setFilterMode] = useState<'today'|'week'|'month'|'custom'>('today');
  const [customStart, setCustomStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);


  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const tenantId = currentUser.tenant_id;

  // Use Dexie live queries with strict tenant filtering
  const sales = useLiveQuery(() => db.sales.where('tenant_id').equals(tenantId).toArray(), [tenantId]) || [];
  const saleItems = useLiveQuery(() => db.sale_items.where('tenant_id').equals(tenantId).toArray(), [tenantId]) || [];
  const products = useLiveQuery(() => db.products.where('tenant_id').equals(tenantId).toArray(), [tenantId]) || [];
  const expenses = useLiveQuery(() => db.expenses.where('tenant_id').equals(tenantId).toArray(), [tenantId]) || [];
  
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
    saleItems.forEach(item => {
      if (saleIds.has(item.sale_id)) {
        const product = products.find(p => p.id === item.product_id);
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




  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="report-container responsive-container responsive-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', gap: '24px', overflowY: 'auto' }}>
      
      <header className="hide-on-print responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)' }}>Gerencial & Caixa</h2>
          <p style={{ color: 'var(--text-muted)' }}>Métricas, fluxo do dinheiro e exportação.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={20} />
            Exportar PDF
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
              <tr>
                <th style={{ padding: '12px 24px', color: 'var(--text-muted)' }}>Data/Hora</th>
                <th style={{ padding: '12px 24px', color: 'var(--text-muted)' }}>Método</th>
                <th style={{ padding: '12px 24px', color: 'var(--text-muted)' }}>Total</th>
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


    </div>
  );
}

const FilterBtn = ({ active, onClick, label }: any) => (
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

const MetricCard = ({ title, value, highlight, danger, success, sub, icon, isCount }: any) => {
  let color = 'var(--text-primary)';
  let bg = 'var(--surface-primary)';
  if (highlight) {
    color = 'var(--accent-primary)';
    bg = 'var(--bg-secondary)';
  }
  if (danger) {
    color = 'var(--danger)';
  }
  if (success) {
    color = 'var(--success)';
  }

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', background: bg, position: 'relative', overflow: 'hidden' }}>
      {icon && <div style={{ position: 'absolute', top: '16px', right: '16px', opacity: 0.2, color }}>{icon}</div>}
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', zIndex: 1 }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: '900', color, zIndex: 1 }}>
        {isCount ? value : `R$ ${value.toFixed(2)}`}
      </div>
      {sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)', zIndex: 1, marginTop: '4px' }}>{sub}</div>}
    </div>
  );
};
