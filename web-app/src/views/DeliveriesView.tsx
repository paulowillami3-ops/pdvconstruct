import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Delivery, type User, type ShipmentLoad } from '../database/db';
import { Truck, MapPin, CheckCircle, Clock, Calendar, Printer, Plus, ClipboardList, X } from 'lucide-react';

export default function DeliveriesView() {
  const [filterStatus, setFilterStatus] = useState<'pending' | 'delivered' | 'all'>('pending');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState<ShipmentLoad | null>(null);
  const [drivers, setDrivers] = useState<User[]>([]);
  
  const [loadForm, setLoadForm] = useState({
    driver_id: '',
    vehicle: ''
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDelivery, setNewDelivery] = useState({
    address: '',
    schedule_date: new Date().toISOString().split('T')[0],
    fee: '0.00'
  });

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const tenantId = currentUser.tenant_id;

  const deliveries = useLiveQuery(() => {
    if (!tenantId) return [];
    if (filterStatus === 'all') return db.deliveries.where('tenant_id').equals(tenantId).reverse().sortBy('schedule_date');
    return db.deliveries.where({ tenant_id: tenantId, status: filterStatus }).toArray();
  }, [filterStatus, tenantId]) || [];

  const loads = useLiveQuery(() => 
    tenantId ? db.shipment_loads.where('tenant_id').equals(tenantId).reverse().toArray() : []
  , [tenantId]) || [];

  useEffect(() => {
    if (tenantId) {
      db.users.where({ tenant_id: tenantId, role: 'driver' }).toArray().then(setDrivers);
    }
  }, [tenantId]);

  const handleMarkAsDelivered = async (id: string) => {
    try {
      await db.deliveries.update(id, { 
        status: 'delivered', 
        signed_at: Date.now(), 
        signed_by: 'Confirmado manualmente' 
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar status da entrega.');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCreateLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loadForm.driver_id || !loadForm.vehicle || selectedIds.length === 0 || !tenantId) return;

    const loadId = crypto.randomUUID();
    
    await db.transaction('rw', [db.shipment_loads, db.deliveries], async () => {
      await db.shipment_loads.add({
        id: loadId,
        tenant_id: tenantId,
        synced: false,
        driver_id: loadForm.driver_id,
        vehicle_license: loadForm.vehicle,
        status: 'preparing',
        created_at: Date.now()
      });

      for (const dId of selectedIds) {
        await db.deliveries.update(dId, { load_id: loadId, status: 'shipped' });
      }
    });

    setSelectedIds([]);
    setShowLoadModal(false);
    setLoadForm({ driver_id: '', vehicle: '' });
  };

  const printRomaneio = (load: ShipmentLoad) => {
    setShowPrintView(load);
    setTimeout(() => {
      window.print();
      setShowPrintView(null);
    }, 500);
  };

  if (showPrintView) {
    const driver = drivers.find(d => d.id === showPrintView.driver_id);
    const loadDeliveries = deliveries.filter(d => d.load_id === showPrintView.id);

    return (
      <div className="print-only p-12 bg-white text-black min-h-screen">
        <div className="border-2 border-black p-6 mb-8">
          <div className="flex justify-between items-start border-b-2 border-dashed border-black pb-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold uppercase">Romaneio de Entrega</h1>
              <p className="text-sm">Construx Advanced ERP - Logística</p>
            </div>
            <div className="text-right">
              <p className="font-bold">ID: {showPrintView.id.slice(0,8).toUpperCase()}</p>
              <p>Gerado em: {new Date(showPrintView.created_at).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-xs uppercase font-bold text-gray-500">Motorista</p>
              <p className="text-xl font-bold">{driver?.name || 'Não identificado'}</p>
              <p className="text-sm">@{driver?.username}</p>
            </div>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-xs uppercase font-bold text-gray-500">Veículo / Placa</p>
              <p className="text-xl font-bold">{showPrintView.vehicle_license}</p>
            </div>
          </div>

          <table className="w-full border-collapse mb-8">
            <thead>
              <tr className="bg-gray-200 text-left border-y-2 border-black">
                <th className="p-3">SEQ</th>
                <th className="p-3">PEDIDO</th>
                <th className="p-3">ENDEREÇO COMPLETO</th>
                <th className="p-3 text-right">ASSINATURA DO CLIENTE</th>
              </tr>
            </thead>
            <tbody>
              {loadDeliveries.map((d, index) => (
                <tr key={d.id} className="border-b border-gray-300 h-24">
                  <td className="p-3 font-bold">{index + 1}</td>
                  <td className="p-3">{d.sale_id.slice(0,8).toUpperCase()}</td>
                  <td className="p-3 max-w-sm font-medium">{d.address}</td>
                  <td className="p-3 border-l border-gray-300"></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-12 pt-8 border-t-2 border-black grid grid-cols-2 gap-12 text-center">
            <div>
              <div className="h-px bg-black mb-2 mx-auto w-48"></div>
              <p className="text-xs font-bold uppercase">Assinatura do Motorista</p>
            </div>
            <div>
              <div className="h-px bg-black mb-2 mx-auto w-48"></div>
              <p className="text-xs font-bold uppercase">Conferente / Expedição</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="responsive-view overflow-auto" style={{ padding: '32px', gap: '32px', height: '100%' }}>
      
      <header className="mb-8" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }} className="flex items-center gap-3">
              <Truck size={32} className="text-blue-400" /> Logística e Entregas
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Crie romaneios e monitore as rotas dos motoristas.</p>
          </div>

          <div className="responsive-tools" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', justifyContent: 'center' }}
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={20} /> Nova Entrega
            </button>
            
            <select 
              className="input-glass" 
              style={{ minWidth: '150px', height: '48px' }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
            >
              <option value="pending" style={{ color: 'white' }}>Pendentes</option>
              <option value="delivered" style={{ color: 'white' }}>Entregues</option>
              <option value="all" style={{ color: 'white' }}>Todas</option>
            </select>

            {selectedIds.length > 0 && (
              <button 
                onClick={() => setShowLoadModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
                style={{ whiteSpace: 'nowrap' }}
              >
                <Plus size={20} /> Montar Romaneio ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Forecast Summary Cards */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
          {[
            { label: 'Hoje', date: new Date().toLocaleDateString(), count: deliveries.filter(d => {
              const d1 = new Date(d.schedule_date);
              const d2 = new Date();
              return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
            }).length },
            { label: 'Amanhã', date: new Date(Date.now() + 86400000).toLocaleDateString(), count: deliveries.filter(d => {
              const d1 = new Date(d.schedule_date);
              const d2 = new Date(Date.now() + 86400000);
              return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
            }).length },
            { label: 'Próximos 7 dias', count: deliveries.filter(d => {
              const now = new Date();
              now.setHours(0,0,0,0);
              const nextWeek = new Date(now.getTime() + 7 * 86400000 + 86400000);
              return d.schedule_date >= now.getTime() && d.schedule_date < nextWeek.getTime();
            }).length }
          ].map((card, i) => (
            <div key={i} className="glass-panel" style={{ padding: '16px 20px', flex: '1', minWidth: '200px', borderLeft: '3px solid var(--accent-primary)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700', letterSpacing: '0.05em' }}>{card.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{card.count}</div>
              {card.date && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.8 }}>{card.date}</div>}
            </div>
          ))}
        </div>
      </header>

      {/* Grid containing Loads and Deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Active Loads Column */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-white font-bold flex items-center gap-2 mb-4">
            <ClipboardList size={18} className="text-blue-400" /> Romaneios Recentes
          </h3>
          <div className="space-y-3 overflow-auto pr-2" style={{ maxHeight: '70vh' }}>
            {loads.map(load => {
              const driver = drivers.find(dr => dr.id === load.driver_id);
              return (
                <div key={load.id} className="glass-panel p-4 flex flex-col gap-3 group">
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      load.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {load.status === 'completed' ? 'Concluído' : 'Ativo'}
                    </span>
                    <button onClick={() => printRomaneio(load)} className="text-gray-500 hover:text-white transition-colors">
                      <Printer size={16} />
                    </button>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{driver?.name || 'Motorista'}</p>
                    <p className="text-gray-500 text-xs">P: {load.vehicle_license} | {new Date(load.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Deliveries Grid */}
        <div className="lg:col-span-3">
          {deliveries.length === 0 ? (
            <div className="glass-panel p-20 text-center flex flex-col items-center gap-4">
              <ClipboardList size={48} className="text-gray-500" />
              <p className="text-gray-400">Nenhuma entrega encontrada para este filtro.</p>
            </div>
          ) : (
            Object.entries(
              deliveries.reduce((acc, d) => {
                const date = new Date(d.schedule_date).toLocaleDateString();
                if (!acc[date]) acc[date] = [];
                acc[date].push(d);
                return acc;
              }, {} as Record<string, Delivery[]>)
            ).map(([date, items]) => (
              <div key={date} className="mb-8">
                <h3 className="text-gray-400 text-sm font-bold uppercase mb-4 flex items-center gap-2">
                  <Calendar size={16} /> {date === new Date().toLocaleDateString() ? 'Hoje' : date === new Date(Date.now() + 86400000).toLocaleDateString() ? 'Amanhã' : date} 
                  <span className="text-blue-500">({items.length})</span>
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px',
                  paddingRight: '8px'
                }}>
                  {items.map(d => (
                    <div 
                      key={d.id} 
                      className="glass-panel relative flex flex-col gap-4 group transition-all hover:scale-[1.02]"
                      style={{ 
                        padding: '24px', 
                        borderLeft: `4px solid ${d.status === 'delivered' ? 'var(--success)' : d.load_id ? 'var(--info)' : 'var(--accent-primary)'}`,
                        opacity: d.status === 'delivered' ? 0.7 : 1
                      }}
                    >
                      {d.status === 'pending' && !d.load_id && (
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(d.id)}
                          onChange={() => toggleSelection(d.id)}
                          className="absolute top-4 right-4 w-5 h-5 rounded border-white/20 bg-white/5 cursor-pointer accent-blue-500"
                        />
                      )}
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: d.status === 'delivered' ? 'var(--success)' : 'var(--accent-primary)' }}>
                          {d.status === 'delivered' ? <CheckCircle size={20} /> : <Clock size={20} />}
                          <div style={{ fontWeight: '600', fontSize: '15px' }}>{d.address || 'Sem endereço'}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-gray-400 bg-white/5 p-3 rounded-lg mt-auto">
                        <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(d.schedule_date).toLocaleDateString()}</span>
                        <span className="text-blue-400 font-bold">Frete: R$ {d.fee.toFixed(2)}</span>
                      </div>

                      {d.status === 'pending' && !d.load_id && (
                        <button 
                          className="btn-primary py-2 mt-2" 
                          onClick={() => handleMarkAsDelivered(d.id)}
                        >
                          Marcar como Entregue
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showLoadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
             {/* Background glow for modal */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[100px] pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Truck className="text-blue-400"/> Gerar Romaneio</h2>
              <button onClick={() => setShowLoadModal(false)} className="text-gray-500 hover:text-white"><X /></button>
            </div>
            
            <p className="text-gray-400 text-sm mb-6">Você está agrupando {selectedIds.length} entregas para uma única saída.</p>

            <form onSubmit={handleCreateLoad} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Motorista Responsável</label>
                <select 
                  required
                  className="input-glass w-full"
                  value={loadForm.driver_id}
                  onChange={e => setLoadForm({...loadForm, driver_id: e.target.value})}
                >
                  <option value="">Selecione um motorista...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id} style={{ color: 'white' }}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Veículo / Placa</label>
                <input 
                  required
                  placeholder="Ex: Volvo XYZ-1234"
                  className="input-glass w-full uppercase"
                  value={loadForm.vehicle}
                  onChange={e => setLoadForm({...loadForm, vehicle: e.target.value})}
                />
              </div>
              
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/20 mt-6">
                Gerar e Enviar para Painel do Motorista
              </button>
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Plus className="text-blue-400"/> Agendar Entrega</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white"><X /></button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!tenantId) return;
              await db.deliveries.add({
                id: crypto.randomUUID(),
                tenant_id: tenantId,
                synced: false,
                sale_id: 'MANUAL',
                address: newDelivery.address,
                schedule_date: new Date(newDelivery.schedule_date).getTime(),
                fee: Number(newDelivery.fee),
                status: 'pending'
              });
              setIsAddModalOpen(false);
              setNewDelivery({ address: '', schedule_date: new Date().toISOString().split('T')[0], fee: '0.00' });
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Endereço de Entrega</label>
                <input 
                  required
                  placeholder="Rua, Número, Bairro..."
                  className="input-glass w-full"
                  value={newDelivery.address}
                  onChange={e => setNewDelivery({...newDelivery, address: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Data Programada</label>
                  <input 
                    required
                    type="date"
                    className="input-glass w-full"
                    value={newDelivery.schedule_date}
                    onChange={e => setNewDelivery({...newDelivery, schedule_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Taxa de Frete (R$)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="input-glass w-full"
                    value={newDelivery.fee}
                    onChange={e => setNewDelivery({...newDelivery, fee: e.target.value})}
                  />
                </div>
              </div>
              
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg mt-6">
                Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
