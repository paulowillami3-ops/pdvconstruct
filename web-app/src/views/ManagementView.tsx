import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, BarChart3, FileText, DollarSign } from 'lucide-react';

const ManagementView: React.FC = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: 'Relatórios de Vendas',
      description: 'Acompanhe faturamento, ticket médio e performance.',
      icon: <BarChart3 className="text-blue-400" size={28} />,
      path: '/reports',
      color: 'var(--accent-primary)'
    },
    {
      title: 'Contas a Pagar',
      description: 'Gestão de despesas, vencimentos e fornecedores.',
      icon: <DollarSign className="text-red-400" size={28} />,
      path: '/expenses',
      color: 'var(--danger)'
    }
  ];

  return (
    <div className="responsive-view" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px 0' }}>Gerencial</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Administrativo e Financeiro</p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className="glass-panel"
              style={{
                width: '100%',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: 'var(--surface-glass)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  {item.description}
                </p>
              </div>
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          ))}
        </div>

        {/* Info Card */}
        <div style={{ 
          marginTop: '40px', 
          padding: '20px', 
          background: 'var(--accent-glow)', 
          borderRadius: '20px', 
          border: '1px solid var(--border-color)',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
            <FileText size={20} className="text-blue-400" />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>
            Esta área unifica as ferramentas de gestão para facilitar o acesso rápido via celular. No computador, você pode acessar cada menu diretamente pela barra lateral.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManagementView;
