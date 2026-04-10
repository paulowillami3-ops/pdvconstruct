import { db, generateId } from './db';

export const seedDatabase = async () => {
  const count = await db.products.count();
  if (count > 0) return; // Already seeded

  console.log('Seeding Database...');

  const cimentoId = generateId();
  const areiaId = generateId();
  const tijoloId = generateId();
  
  await db.products.bulkAdd([
    {
      id: cimentoId,
      name: 'Cimento Votorantim 50kg',
      category: 'Construção Base',
      barcode: '789123456001',
      price_sell: 32.50,
      price_cost: 25.00,
      stock_current: 100,
      stock_min: 20,
      unit_type: 'saco',
      volume_discount_strategy: 'auto',
      status: 'active',
      created_at: Date.now()
    },
    {
      id: areiaId,
      name: 'Areia Fina',
      category: 'Construção Base',
      barcode: 'AREIA500',
      price_sell: 120.00,
      price_cost: 80.00,
      stock_current: 15,
      stock_min: 5,
      unit_type: 'm3',
      volume_discount_strategy: 'manual',
      status: 'active',
      created_at: Date.now()
    },
    {
      id: tijoloId,
      name: 'Tijolo Baiano 8 Furos',
      category: 'Alvenaria',
      barcode: 'TIJ8F',
      price_sell: 0.85,
      price_cost: 0.40,
      stock_current: 5000,
      stock_min: 1000,
      unit_type: 'un',
      volume_discount_strategy: 'auto',
      status: 'active',
      created_at: Date.now()
    }
  ]);

  await db.customers.bulkAdd([
    {
      id: generateId(),
      name: 'João Silva Engenharia',
      cpf: '123.456.789-00',
      phone: '(11) 98765-4321',
      credit_limit: 5000,
      balance_owed: 1250.50,
      status: 'active',
      created_at: Date.now()
    },
    {
      id: generateId(),
      name: 'Maria Reforma Mestre',
      cpf: '987.654.321-11',
      phone: '(11) 91234-5678',
      credit_limit: 1000,
      balance_owed: 0,
      status: 'active',
      created_at: Date.now()
    }
  ]);

  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.add({
      id: generateId(),
      name: 'Administrador',
      username: 'admin',
      passwordHash: btoa('123456'), // Simple local encoding for offline offline demo
      role: 'admin'
    });
  }
};
