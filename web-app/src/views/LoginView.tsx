import React, { useState } from 'react';
import { db } from '../database/db';
import { User, Lock, UserPlus, LogIn, ArrowRight, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

import type { User as UserType } from '../database/db';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);

    try {
      if (isRegistering) {
        if (!name || !email || !username || !password || !companyName) {
          setLoading(false);
          return setError('Preencha todos os campos, incluindo e-mail e nome da empresa.');
        }

        // Chama a Edge Function que usa poderes de admin para criar tudo atomicamente:
        // Auth User + Tenant + Profile, sem depender de RLS ou triggers.
        const { data: fnData, error: fnError } = await supabase.functions.invoke('register-owner', {
          body: {
            email: email.trim().toLowerCase(),
            password,
            full_name: name.trim(),
            username: username.trim().toLowerCase(),
            company_name: companyName.trim()
          }
        });

        if (fnError) throw fnError;
        if (fnData?.error) throw new Error(fnData.error);

        // Faz login automático para buscar a sessão
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });

        if (signInError) {
          // Cadastro funcionou, mas login falhou. Pede pro usuário logar manualmente.
          setIsRegistering(false);
          setPassword('');
          return setError('');
        }

        // Salva usuário local para acesso offline
        const newUser: UserType = {
          id: signInData.user.id,
          tenant_id: fnData.tenantId,
          name: name.trim(),
          username: username.trim().toLowerCase(),
          passwordHash: btoa(password),
          role: 'owner',
          synced: true
        };
        await db.users.put(newUser);
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        localStorage.setItem('companyName', companyName.trim());
        return onLoginSuccess(newUser);
      } else {
        if (!username || !password) {
          setLoading(false);
          return setError('Preencha usuário ou e-mail e senha.');
        }

        // Identify if login is by email (Owner) or username (Employee)
        const loginEmail = username.includes('@') 
          ? username.trim().toLowerCase() 
          : `construx_pdv_${username.trim().toLowerCase()}@gmail.com`;

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password
        });

        if (authError) {
          // Fallback simple offline check (optional, but good for UX)
          const localUser = await db.users.where('username').equals(username.trim().toLowerCase()).first();
          if (localUser && localUser.passwordHash === btoa(password)) {
             localStorage.setItem('currentUser', JSON.stringify(localUser));
             return onLoginSuccess(localUser);
          }
          throw authError;
        }

        // Fetch Profile to get tenant and role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, tenants(name)')
          .eq('id', authData.user.id)
          .single();

        if (profileError) throw profileError;

        const sessionUser: UserType = {
          id: authData.user.id,
          tenant_id: profile.tenant_id,
          name: profile.full_name,
          username: profile.username,
          passwordHash: btoa(password),
          role: profile.role,
          synced: true
        };

        // Cache/Update local user
        await db.users.put(sessionUser);

        // Save company name for display in the sidebar
        const companyNameFromProfile = (profile as any).tenants?.name || '';
        if (companyNameFromProfile) {
          localStorage.setItem('companyName', companyNameFromProfile);
        }

        localStorage.setItem('currentUser', JSON.stringify(sessionUser));
        onLoginSuccess(sessionUser);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao processar a requisição.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, var(--bg-secondary) 0%, var(--bg-primary) 100%)'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '32px' }}>Construx<span style={{ color: 'var(--accent-primary)' }}>PDV</span></h1>
          <p style={{ color: 'var(--text-muted)' }}>{isRegistering ? 'Cadastre um novo operador no sistema' : 'Faça login para acessar o terminal'}</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center', fontWeight: 'bold' }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {isRegistering && (
            <>
              <div>
                <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>E-mail do Responsável (Real)</label>
                <div style={{ position: 'relative' }}>
                  <LogIn style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                  <input required type="email" className="input-glass" style={{ paddingLeft: '48px' }} placeholder="Ex: joao@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Nome Completo do Responsável</label>
                <div style={{ position: 'relative' }}>
                  <UserPlus style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                  <input required autoFocus className="input-glass" style={{ paddingLeft: '48px' }} placeholder="Ex: João da Silva" value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Nome da Empresa / Loja</label>
                <div style={{ position: 'relative' }}>
                  <Building2 style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
                  <input required className="input-glass" style={{ paddingLeft: '48px' }} placeholder="Ex: Construx Materiais" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>{isRegistering ? 'Escolha um Nome de Usuário' : 'Usuário ou E-mail'}</label>
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
              <input required autoFocus={!isRegistering} className="input-glass" style={{ paddingLeft: '48px' }} placeholder={isRegistering ? 'Ex: joao.admin' : 'Usuário ou seu e-mail'} value={username} onChange={e => setUsername(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Senha de Acesso</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={20} />
              <input required type="password" className="input-glass" style={{ paddingLeft: '48px' }} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>

          <button disabled={loading} className="btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', marginTop: '8px', fontSize: '16px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Processando...' : isRegistering ? <><UserPlus size={20} /> Criar Conta de Empresa</> : <><LogIn size={20} /> Entrar no Sistema</>}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <button 
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            style={{ background: 'transparent', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {isRegistering ? 'Já possui login? Acesse aqui' : 'Criar nova empresa (Cadastro de Dono)'}
            <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}
