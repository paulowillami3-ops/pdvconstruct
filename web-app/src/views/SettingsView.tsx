import React, { useState, useEffect } from 'react';
import { db } from '../database/db';
import { Save, Check, Settings as SettingsIcon, CreditCard, Info, Trash2, Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SettingsView = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  // Prefixo único por empresa — garante isolamento total entre tenants no IndexedDB

  const [pixKeys, setPixKeys] = useState<Record<string, string>>({
    cpf: '', cnpj: '', email: '', phone: '', random: ''
  });
  const [pixKeyType, setPixKeyType] = useState('cpf');
  const [pixId, setPixId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadSettings(); }, []);

  // Helper: lê uma configuração isolada por tenant (Sem fallback legado)
  const getSetting = async (key: string) => {
    if (!currentUser.tenant_id) return null;
    return db.settings.get(`${currentUser.tenant_id}:${key}`);
  };

  // Helper: salva uma configuração isolada por tenant
  const putSetting = async (key: string, value: string) => {
    if (!currentUser.tenant_id) return;
    return db.settings.put({ 
      id: `${currentUser.tenant_id}:${key}`, 
      tenant_id: currentUser.tenant_id, 
      value,
      synced: false 
    });
  };

  const loadSettings = async () => {
    try {
      const typeSetting = await getSetting('pix_key_type');
      const activeType = typeSetting?.value || 'cpf';
      setPixKeyType(activeType);

      const types = ['cpf', 'cnpj', 'email', 'phone', 'random'];
      const loadedKeys: Record<string, string> = {};
      for (const t of types) {
        const s = await getSetting(`pix_key_${t}`);
        loadedKeys[t] = s?.value || '';
      }
      setPixKeys(loadedKeys);

      const idSetting = await getSetting('pix_id');
      if (idSetting) setPixId(idSetting.value);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('ATENÇÃO: Isso apagará todos os dados locais e forçará uma nova sincronização com a nuvem. Use apenas se notar inconsistências de dados. Deseja continuar?')) return;
    
    try {
      setSaving(true);
      // Desativa o motor de sincronização temporariamente se possível, ou apenas limpa
      await db.delete(); // Deleta o banco IndexedDB (o Dexie recria ao abrir)
      localStorage.removeItem('companyName');
      // Mantemos o currentUser para não deslogar imediatamente, mas forçamos refresh
      alert('Cache limpo com sucesso! O sistema será reiniciado.');
      window.location.reload();
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      alert('Erro ao limpar cache local.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.tenant_id) {
       alert('Erro: ID do Tenant não encontrado. Tente sair e entrar novamente.');
       return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await putSetting('pix_key_type', pixKeyType);
      for (const [type, value] of Object.entries(pixKeys)) {
        await putSetting(`pix_key_${type}`, value);
      }
      // Chave ativa no formato legado (lida pelo POSView)
      await putSetting('pix_key', pixKeys[pixKeyType]);
      await putSetting('pix_id', pixId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div className="responsive-view" style={{ flex: 1, overflowY: 'auto' }}>
      <div className="responsive-container" style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Section */}
        <div className="responsive-header" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '48px' }}>
          <div style={{ 
            padding: '16px', 
            background: 'var(--accent-glow)', 
            borderRadius: '20px', 
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <SettingsIcon className="text-blue-400" size={32} />
          </div>
          <div>
            <h1 className="responsive-title" style={{ fontSize: '32px', margin: 0 }}>Configurações</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '4px' }}>Gerencie os parâmetros do sistema</p>
          </div>
        </div>

        <div className="responsive-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px' }}>
          
          {/* Menu Lateral de Configurações */}
          <div className="hide-on-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '16px 20px', 
              background: 'var(--accent-glow)', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid var(--accent-primary)',
              color: 'var(--text-primary)',
              fontWeight: '600'
            }}>
              <CreditCard size={18} />
              Pagamentos (PIX)
            </div>
            
            <div style={{ 
              padding: '16px 20px', 
              background: 'var(--surface-glass-light)', 
              borderRadius: 'var(--radius-lg)', 
              opacity: 0.5,
              border: '1px solid transparent'
            }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Emissão de NFe (Breve)</p>
            </div>

            <div style={{ 
              padding: '16px 20px', 
              background: 'var(--surface-glass-light)', 
              borderRadius: 'var(--radius-lg)', 
              opacity: 0.5,
              border: '1px solid transparent'
            }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Backup em Nuvem (Breve)</p>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
              <button 
                onClick={handleClearCache}
                style={{ 
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Trash2 size={16} />
                Limpar Cache Local
              </button>
            </div>
          </div>

          {/* Conteúdo Principal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Atalho para Usuários - APENAS MOBILE */}
            <div className="show-on-mobile" style={{ marginBottom: '-16px' }}>
              <button
                onClick={() => navigate('/users')}
                className="glass-panel"
                style={{
                  width: '100%',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--accent-primary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
                  <Users size={22} color="var(--accent-primary)" />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Gerenciar Equipe</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Adicione e controle níveis de acesso.</p>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="card-glass responsive-modal" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                <CreditCard size={24} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '20px', margin: 0 }}>Recebimento PIX</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="responsive-form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px', fontWeight: '500' }}>
                      Tipo da Chave
                    </label>
                    <select
                      className="input-glass"
                      value={pixKeyType}
                      onChange={(e) => setPixKeyType(e.target.value)}
                    >
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone (Celular)</option>
                      <option value="random">Chave Aleatória</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px', fontWeight: '500' }}>
                      {pixKeyType === 'phone' ? 'Informe o Celular (com DDD)' : 'Informe a Chave PIX'}
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder={pixKeyType === 'phone' ? '(11) 99999-9999' : 'Sua chave PIX'}
                      value={pixKeys[pixKeyType] || ''}
                      onChange={(e) => setPixKeys((prev: Record<string, string>) => ({ ...prev, [pixKeyType]: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px', fontWeight: '500' }}>
                      Identificador (Opcional)
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="Ex: PGTO001"
                      value={pixId}
                      onChange={(e) => setPixId(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', padding: '16px', background: 'rgba(59,130,246,0.05)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.1)' }}>
                  <Info size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                    O sistema usará esses dados para gerar um QR Code dinâmico com o **valor exato da compra** no PDV, exatamente como nos sites de geração de PIX.
                  </p>
                </div>

                <div style={{ paddingTop: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary w-full"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      justifyContent: 'center',
                      padding: '16px 32px',
                      background: saved ? 'var(--success)' : undefined,
                      minWidth: '240px'
                    }}
                  >
                    {saving ? (
                      <div style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    ) : saved ? (
                      <>
                        <Check size={18} />
                        Configuração Salva!
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Salvar Configuração
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Dica Extra */}
            <div className="responsive-container" style={{ 
              background: 'rgba(245, 158, 11, 0.05)', 
              border: '1px solid rgba(245, 158, 11, 0.1)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '24px',
              display: 'flex',
              gap: '20px'
            }}>
              <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', height: 'fit-content' }}>
                <Info color="var(--warning)" size={24} />
              </div>
              <div>
                <h4 style={{ color: 'var(--warning)', margin: '0 0 8px 0', fontSize: '18px' }}>Como obter o melhor resultado?</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  Gere um <strong>QR Code Estático</strong> no app do seu banco e copie o código <strong>"PIX Copia e Cola"</strong>. 
                  Isso permite que o cliente escaneie e o banco já sugira o valor da compra, evitando erros de digitação.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SettingsView;
