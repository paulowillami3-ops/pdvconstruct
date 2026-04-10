import { db } from '../database/db';
import { supabase } from './supabase';

/**
 * Motor de Sincronização Construx
 * Responsável por enviar dados locais (Dexie) para a nuvem (Supabase)
 * e garantir que o PDV funcione offline-first.
 */

const SYNC_INTERVAL = 30_000; // 30 segundos

// Campos que o Supabase recebe como campos locais/de controle — remover antes do upload
const LOCAL_ONLY_FIELDS = ['synced'];

// Campos que guardam timestamps em milissegundos no IndexedDB mas precisam de
// formato ISO 8601 no Supabase (tipo timestamptz / date)
const TIMESTAMP_MS_FIELDS = ['created_at', 'timestamp', 'opened_at', 'closed_at', 'due_date', 'schedule_date'];

/**
 * Normaliza um item local para envio ao Supabase:
 * - Remove campos de controle local (synced)
 * - Converte timestamps de milissegundos para ISO 8601
 */
/**
 * Normaliza um item local para envio ao Supabase:
 * - Remove campos de controle local (synced)
 * - Converte timestamps de milissegundos para ISO 8601
 * - Corrige IDs inválidos (ex: customer_id "avulso")
 */
function normalizeForSupabase(item: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(item)) {
    // Ignora campos só locais
    if (LOCAL_ONLY_FIELDS.includes(key)) continue;

    // Converte timestamps numéricos (ms) para ISO string
    if (TIMESTAMP_MS_FIELDS.includes(key) && typeof value === 'number' && value > 0) {
      result[key] = new Date(value).toISOString();
    } 
    // Trata IDs de venda avulsa que o Dexie permite mas o Supabase UUID não
    else if (key === 'customer_id' && value === 'avulso') {
      result[key] = null;
    }
    else {
      result[key] = value;
    }
  }

  return result;
}

async function syncTable(tableName: string, supabaseTable: string, tenantId: string) {
  try {
    // FILTRO CRÍTICO: Pega apenas o que não foi sincronizado E pertence ao tenant logado
    // Isso evita o erro 42501 (RLS) ao tentar subir dados de outro tenant que estão no PC
    const unsynced = await (db as any)[tableName]
      .filter((item: any) => item.synced !== true && item.tenant_id === tenantId)
      .toArray();

    if (unsynced.length === 0) return;

    console.log(`[Sync] Sincronizando ${unsynced.length} registros de '${tableName}' para tenant ${tenantId}...`);

    const toUpload = unsynced.map(normalizeForSupabase);

    const { error } = await supabase.from(supabaseTable).upsert(toUpload);

    if (error) {
      console.error(`[Sync] Erro ao sincronizar '${tableName}':`, error);
      return;
    }

    // Marca como sincronizado localmente
    const ids = unsynced.map((item: any) => item.id);
    await (db as any)[tableName].bulkUpdate(
      ids.map((id: string) => ({ key: id, changes: { synced: true } }))
    );

    console.log(`[Sync] '${tableName}' sincronizada com sucesso.`);
  } catch (err) {
    console.error(`[Sync] Falha na tabela '${tableName}':`, err);
  }
}

export async function runFullSync() {
  if (!navigator.onLine) return;

  // Garante que o usuário está autenticado antes de sincronizar
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = session?.user?.app_metadata?.tenant_id;
  
  if (!session || !tenantId) {
    console.log('[Sync] Sem sessão ou tenant_id — sincronização cancelada.');
    return;
  }

  // Tabelas Base
  await syncTable('suppliers',       'suppliers',       tenantId);
  await syncTable('products',        'products',        tenantId);
  await syncTable('customers',       'customers',       tenantId);
  
  // Operacionais
  await syncTable('expenses',        'expenses',        tenantId);
  await syncTable('cash_registers',  'cash_registers',  tenantId);
  await syncTable('stock_logs',      'stock_logs',      tenantId);
  
  // Vendas e Financeiro
  await syncTable('sales',           'sales',           tenantId);
  await syncTable('sale_items',      'sale_items',      tenantId);
  await syncTable('purchases',       'purchases',       tenantId);
  await syncTable('purchase_items',  'purchase_items',  tenantId);
  await syncTable('customer_payments','customer_payments',tenantId);
  
  // Logística e Outros
  await syncTable('deliveries',      'deliveries',      tenantId);
  await syncTable('returns',         'returns',         tenantId);
  await syncTable('settings',        'settings',        tenantId);
}

export function initSyncEngine() {
  console.log('[Sync] Motor de sincronização iniciado.');

  runFullSync();
  setInterval(runFullSync, SYNC_INTERVAL);

  window.addEventListener('online', () => {
    runFullSync();
  });
}
