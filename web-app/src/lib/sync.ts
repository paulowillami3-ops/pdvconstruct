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

/**
 * Normaliza um item do Supabase para o Dexie:
 * - Adiciona synced: true
 * - Converte strings ISO 8601 para timestamps (ms)
 */
function normalizeFromSupabase(item: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...item, synced: true };

  for (const key of TIMESTAMP_MS_FIELDS) {
    if (item[key] && typeof item[key] === 'string') {
      result[key] = new Date(item[key]).getTime();
    }
  }

  return result;
}

async function pullTable(tableName: string, supabaseTable: string, tenantId: string) {
  try {
    console.log(`[Sync] Baixando '${tableName}' do Supabase para tenant ${tenantId}...`);

    const { data, error } = await supabase
      .from(supabaseTable)
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error(`[Sync] Erro ao baixar '${tableName}':`, error);
      return;
    }

    if (!data || data.length === 0) return;

    // Filtrar para NÃO sobrescrever itens locais que ainda não foram sincronizados
    const normalizedData = data.map(normalizeFromSupabase);
    
    // Usamos uma transação para garantir integridade
    await db.transaction('rw', (db as any)[tableName], async () => {
      for (const item of normalizedData) {
        const localItem = await (db as any)[tableName].get(item.id);
        
        // Só atualiza se o item local não existir OU se o item local já estiver sincronizado
        // (Isso protege mudanças locais pendentes de serem apagadas pelo servidor)
        if (!localItem || localItem.synced === true) {
          await (db as any)[tableName].put(item);
        }
      }
    });

    console.log(`[Sync] '${tableName}' baixada com sucesso (${data.length} itens).`);
  } catch (err) {
    console.error(`[Sync] Falha no pull da tabela '${tableName}':`, err);
  }
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

  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = session?.user?.app_metadata?.tenant_id;
  
  if (!session || !tenantId) return;

  const tables = [
    { dexie: 'suppliers',        sb: 'suppliers' },
    { dexie: 'products',         sb: 'products' },
    { dexie: 'customers',        sb: 'customers' },
    { dexie: 'expenses',         sb: 'expenses' },
    { dexie: 'cash_registers',   sb: 'cash_registers' },
    { dexie: 'stock_logs',       sb: 'stock_logs' },
    { dexie: 'sales',            sb: 'sales' },
    { dexie: 'sale_items',       sb: 'sale_items' },
    { dexie: 'purchases',        sb: 'purchases' },
    { dexie: 'purchase_items',   sb: 'purchase_items' },
    { dexie: 'customer_payments', sb: 'customer_payments' },
    { dexie: 'deliveries',       sb: 'deliveries' },
    { dexie: 'returns',          sb: 'returns' },
    { dexie: 'settings',         sb: 'settings' }
  ];

  // 1. Primeiro faz o Pull (Baixa do servidor para garantir hidratar novos dispositivos)
  for (const table of tables) {
    await pullTable(table.dexie, table.sb, tenantId);
  }

  // 2. Depois faz o Push (Sobe mudanças locais)
  for (const table of tables) {
    await syncTable(table.dexie, table.sb, tenantId);
  }
}

export function initSyncEngine() {
  console.log('[Sync] Motor de sincronização iniciado.');

  runFullSync();
  const intervalId = setInterval(runFullSync, SYNC_INTERVAL);

  const handleOnline = () => {
    runFullSync();
  };

  window.addEventListener('online', handleOnline);

  return () => {
    clearInterval(intervalId);
    window.removeEventListener('online', handleOnline);
    console.log('[Sync] Motor de sincronização parado.');
  };
}
