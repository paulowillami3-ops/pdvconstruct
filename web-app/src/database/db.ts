import Dexie, { type EntityTable } from 'dexie';

export interface Product {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  name: string;
  category: string;
  unit_type: string;
  price_sell: number;
  price_cost: number;
  stock_current: number;
  stock_min: number;
  barcode: string;
  volume_discount_strategy: string;
  status: string;
  created_at: number;
  supplier_id?: string;
  purchase_unit?: string;
  sale_unit?: string;
  conversion_factor?: number;
}

export interface User {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  name: string;
  username: string;
  passwordHash: string; // In-local secure plain string wrapper for offline test
  role: 'admin' | 'cashier' | 'driver' | 'owner' | 'employee';
}

export interface Customer {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  name: string;
  phone: string;
  cpf: string;
  credit_limit: number;
  balance_owed: number;
  status: string;
  created_at: number;
}

export interface Sale {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  total_amount: number;
  payment_method: string;
  customer_id: string;
  status: string;
  is_delivery?: boolean;
  delivery_fee?: number;
  timestamp: number;
  created_at: number;
}

export interface SaleItem {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_item_price: number;
}

export interface StockLog {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  product_id: string;
  change_amount: number;
  type: string;
  notes: string;
  timestamp: number;
}

export interface Supplier {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  name: string;
  cnpj: string;
  phone: string;
  status: string;
  created_at: number;
}

export interface CashRegister {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  opened_at: number;
  closed_at: number | null;
  initial_balance: number;
  closed_balance: number | null;
  status: 'open' | 'closed';
  notes: string;
}

export interface Purchase {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  supplier_id: string;
  total_cost: number;
  timestamp: number;
}

export interface PurchaseItem {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
}

export interface CustomerPayment {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  customer_id: string;
  amount: number;
  method: string;
  timestamp: number;
}

export interface Delivery {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  sale_id: string;
  address: string;
  status: 'pending' | 'shipped' | 'delivered';
  schedule_date: number;
  fee: number;
  load_id?: string;
  signed_at?: number;
  signed_by?: string;
}

export interface ShipmentLoad {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  driver_id: string;
  vehicle_license: string;
  status: 'preparing' | 'in_transit' | 'completed';
  created_at: number;
}

export interface Expense {
  id: string;
  tenant_id?: string;
  synced?: boolean;
  description: string;
  amount: number;
  due_date: number;
  status: 'pending' | 'paid';
  category: string;
  created_at: number;
}

export interface Return {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  type: 'credit' | 'cash';
  reason: string;
  timestamp: number;
}

export interface Setting {
  id: string; // key
  tenant_id?: string;
  synced?: boolean;
  value: string;
}

// Generate simple uuid (v4 approximation) for client side
export const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const db = new Dexie('PDVConstructDB') as Dexie & {
  products: EntityTable<Product, 'id'>;
  customers: EntityTable<Customer, 'id'>;
  sales: EntityTable<Sale, 'id'>;
  sale_items: EntityTable<SaleItem, 'id'>;
  stock_logs: EntityTable<StockLog, 'id'>;
  users: EntityTable<User, 'id'>;
  suppliers: EntityTable<Supplier, 'id'>;
  cash_registers: EntityTable<CashRegister, 'id'>;
  purchases: EntityTable<Purchase, 'id'>;
  purchase_items: EntityTable<PurchaseItem, 'id'>;
  customer_payments: EntityTable<CustomerPayment, 'id'>;
  deliveries: EntityTable<Delivery, 'id'>;
  returns: EntityTable<Return, 'id'>;
  shipment_loads: EntityTable<ShipmentLoad, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  settings: EntityTable<Setting, 'id'>;
};

// Declaring the schema
db.version(1).stores({
  products: 'id, name, barcode, status',
  customers: 'id, name, cpf, status',
  sales: 'id, customer_id, status, timestamp',
  sale_items: 'id, sale_id, product_id',
  stock_logs: 'id, product_id, timestamp',
  users: 'id, username'
});

db.version(2).stores({
  suppliers: 'id, name, cnpj, status',
  cash_registers: 'id, opened_at, closed_at, status'
});

db.version(3).stores({
  sales: 'id, customer_id, status, is_delivery, timestamp',
  purchases: 'id, supplier_id, timestamp',
  purchase_items: 'id, purchase_id, product_id',
  customer_payments: 'id, customer_id, timestamp',
  deliveries: 'id, sale_id, status, schedule_date',
  returns: 'id, sale_id, product_id, timestamp'
});

db.version(4).stores({
  shipment_loads: 'id, driver_id, status, created_at',
  expenses: 'id, status, due_date, category',
  deliveries: 'id, sale_id, load_id, status, schedule_date'
});

db.version(6).stores({
  products: 'id, tenant_id, synced, name, barcode, status',
  customers: 'id, tenant_id, synced, name, cpf, status',
  sales: 'id, tenant_id, synced, customer_id, status, timestamp',
  sale_items: 'id, tenant_id, synced, sale_id, product_id',
  users: 'id, tenant_id, synced, username',
  settings: 'id, tenant_id, synced'
});

// v7: Add tenant_id index to all remaining stores that were missing it
db.version(7).stores({
  suppliers: 'id, tenant_id, synced, name, cnpj, status',
  stock_logs: 'id, tenant_id, synced, product_id, timestamp',
  cash_registers: 'id, tenant_id, synced, opened_at, status',
  purchases: 'id, tenant_id, synced, supplier_id, timestamp',
  purchase_items: 'id, tenant_id, synced, purchase_id, product_id',
  customer_payments: 'id, tenant_id, synced, customer_id, timestamp',
  deliveries: 'id, tenant_id, synced, sale_id, load_id, status, schedule_date',
  returns: 'id, tenant_id, synced, sale_id, product_id, timestamp'
});

db.version(8).stores({
  shipment_loads: 'id, tenant_id, synced, driver_id, status, created_at',
  expenses: 'id, tenant_id, synced, status, due_date, category'
});

db.version(9).stores({
  users: 'id, tenant_id, synced, username, [tenant_id+role]',
  deliveries: 'id, tenant_id, synced, sale_id, load_id, status, schedule_date, [tenant_id+status]',
  expenses: 'id, tenant_id, synced, status, due_date, category, [tenant_id+status]',
  shipment_loads: 'id, tenant_id, synced, driver_id, status, created_at, [tenant_id+status]',
  sales: 'id, tenant_id, synced, customer_id, status, timestamp, [tenant_id+status]',
  products: 'id, tenant_id, synced, name, barcode, status, [tenant_id+status]'
});

export { db };
