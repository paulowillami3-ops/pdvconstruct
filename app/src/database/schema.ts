import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'products',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'unit_type', type: 'string' }, // un, kg, m3
        { name: 'price_sell', type: 'number' },
        { name: 'price_cost', type: 'number' },
        { name: 'stock_current', type: 'number' },
        { name: 'stock_min', type: 'number' },
        { name: 'barcode', type: 'string', isIndexed: true },
        { name: 'volume_discount_strategy', type: 'string' }, // auto, manual
        { name: 'status', type: 'string' }, // active, inactive
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'cpf', type: 'string', isIndexed: true },
        { name: 'credit_limit', type: 'number' },
        { name: 'balance_owed', type: 'number' },
        { name: 'status', type: 'string' }, // active, blocked
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'users',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'username', type: 'string', isIndexed: true },
        { name: 'password_hash', type: 'string' },
        { name: 'role', type: 'string' }, // admin, manager, cashier
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'sales',
      columns: [
        { name: 'total_amount', type: 'number' },
        { name: 'payment_method', type: 'string' }, // cash, pix, card, credit (fiado)
        { name: 'customer_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' }, // completed, cancelled
        { name: 'is_synced', type: 'boolean' },
        { name: 'timestamp', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'sale_items',
      columns: [
        { name: 'sale_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string', isIndexed: true },
        { name: 'quantity', type: 'number' },
        { name: 'unit_price', type: 'number' },
        { name: 'discount_amount', type: 'number' },
        { name: 'total_item_price', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'stock_logs',
      columns: [
        { name: 'product_id', type: 'string', isIndexed: true },
        { name: 'change_amount', type: 'number' },
        { name: 'type', type: 'string' }, // supply, sale_manual, adjustment
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'notes', type: 'string' },
        { name: 'timestamp', type: 'number' },
      ],
    }),
  ],
});
