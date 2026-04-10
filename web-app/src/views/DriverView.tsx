import React, { useState, useEffect } from 'react';
import { db, type ShipmentLoad, type Delivery } from '../database/db';
import { Truck, CheckCircle, Package, User, Clock, MapPin } from 'lucide-react';

const DriverView: React.FC = () => {
  const [activeLoads, setActiveLoads] = useState<ShipmentLoad[]>([]);
  const [selectedLoad, setSelectedLoad] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [receiverName, setReceiverName] = useState('');
  const [signingDelivery, setSigningDelivery] = useState<string | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    setCurrentUser(user);
    if (user.id) {
      loadDriverData(user.id);
    }
  }, []);

  const loadDriverData = async (driverId: string) => {
    const loads = await db.shipment_loads
      .where('driver_id')
      .equals(driverId)
      .and(l => l.status !== 'completed')
      .toArray();
    setActiveLoads(loads);
  };

  const selectLoad = async (id: string) => {
    setSelectedLoad(id);
    const delivs = await db.deliveries.where('load_id').equals(id).toArray();
    setDeliveries(delivs);
    setSigningDelivery(null);
  };

  const handleSignDelivery = async () => {
    if (!signingDelivery || !receiverName) return;

    await db.deliveries.update(signingDelivery, {
      status: 'delivered',
      signed_at: Date.now(),
      signed_by: receiverName
    });

    // Refresh
    if (selectedLoad) selectLoad(selectedLoad);
    setReceiverName('');
    setSigningDelivery(null);

    // Check if all deliveries in load are done
    const remaining = deliveries.filter(d => d.id !== signingDelivery && d.status !== 'delivered');
    if (remaining.length === 0 && selectedLoad) {
      await db.shipment_loads.update(selectedLoad, { status: 'completed' });
      loadDriverData(currentUser.id);
      setSelectedLoad(null);
    }
  };

  const startLoad = async () => {
    if (!selectedLoad) return;
    await db.shipment_loads.update(selectedLoad, { status: 'in_transit' });
    loadDriverData(currentUser.id);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Truck className="text-blue-400" /> Painel do Entregador
          </h1>
          <p className="text-gray-400">Olá, {currentUser?.name}. Pronto para as entregas?</p>
        </div>
      </header>

      {!selectedLoad ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="text-xl font-semibold text-white col-span-full">Suas Cargas Pendentes</h2>
          {activeLoads.length === 0 ? (
            <div className="col-span-full bg-white/5 backdrop-blur-md rounded-2xl p-12 text-center border border-white/10">
              <Package className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma carga atribuída no momento.</p>
            </div>
          ) : (
            activeLoads.map(load => (
              <button
                key={load.id}
                onClick={() => selectLoad(load.id)}
                className="bg-white/5 backdrop-blur-md border border-white/10 hover:border-blue-500/50 p-6 rounded-2xl text-left transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    load.status === 'preparing' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {load.status === 'preparing' ? 'Preparando' : 'Em Trânsito'}
                  </span>
                  <Clock className="text-gray-500 w-5 h-5" />
                </div>
                <h3 className="text-white font-medium mb-1">Veículo: {load.vehicle_license}</h3>
                <p className="text-sm text-gray-400">Gerado em: {new Date(load.created_at).toLocaleDateString()}</p>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedLoad(null)}
              className="text-gray-400 hover:text-white"
            >
              ← Voltar para cargas
            </button>
            <h2 className="text-xl font-semibold text-white">Entregas do Romaneio</h2>
          </div>

          {activeLoads.find(l => l.id === selectedLoad)?.status === 'preparing' && (
            <button
              onClick={startLoad}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Truck className="w-5 h-5" /> Iniciar Rota (Mudar status para Em Trânsito)
            </button>
          )}

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
            {deliveries.map((delivery, index) => (
              <div 
                key={delivery.id}
                className={`p-6 border-b border-white/10 last:border-0 ${delivery.status === 'delivered' ? 'opacity-50' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-white/10 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <h3 className="text-white font-medium">Pedido: {delivery.sale_id.slice(0, 8).toUpperCase()}</h3>
                      {delivery.status === 'delivered' && (
                        <span className="text-green-400 flex items-center gap-1 text-xs">
                          <CheckCircle className="w-4 h-4" /> Entregue
                        </span>
                      )}
                    </div>
                    <p className="text-gray-300 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-500 mt-1 shrink-0" />
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.address)}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-blue-400 transition-colors underline decoration-dotted"
                      >
                        {delivery.address}
                      </a>
                    </p>
                    {delivery.signed_by && (
                      <p className="text-xs text-green-400 mt-2">
                        Recebido por: {delivery.signed_by} em {new Date(delivery.signed_at!).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  {delivery.status !== 'delivered' && (
                    <button
                      onClick={() => setSigningDelivery(delivery.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      Confirmar Entrega
                    </button>
                  )}
                </div>

                {signingDelivery === delivery.id && (
                  <div className="mt-4 p-4 bg-white/10 rounded-xl space-y-3">
                    <label className="block text-sm font-medium text-gray-300">
                      Quem recebeu a mercadoria?
                    </label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="Nome completo do recebedor"
                      className="w-full bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSignDelivery}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
                      >
                        Salvar Comprovante Digital
                      </button>
                      <button
                        onClick={() => setSigningDelivery(null)}
                        className="px-4 py-2 text-gray-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverView;
