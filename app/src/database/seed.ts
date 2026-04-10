import { database } from './index';
import Product from './models/Product';
import User from './models/User';

export async function seedDatabase() {
  const usersCollection = database.get<User>('users');
  const productsCollection = database.get<Product>('products');

  const usersCount = await usersCollection.query().fetchCount();
  if (usersCount === 0) {
    await database.write(async () => {
      await usersCollection.create(user => {
        user.name = 'Administrador Construz';
        user.username = 'admin';
        user.passwordHash = 'admin123'; // In production, use bcrypt
        user.role = 'admin';
        user.status = 'active';
      });
      await usersCollection.create(user => {
        user.name = 'Caixa Balcão 01';
        user.username = 'caixa1';
        user.passwordHash = 'caixa123';
        user.role = 'cashier';
        user.status = 'active';
      });
    });
    console.log('Seed: Usuários criados.');
  }

  const productsCount = await productsCollection.query().fetchCount();
  if (productsCount === 0) {
    await database.write(async () => {
      // Saco de Cimento
      await productsCollection.create(p => {
        p.name = 'Saco de Cimento CP-II 50kg';
        p.category = 'Básicos';
        p.unitType = 'un';
        p.priceSell = 35.50;
        p.priceCost = 28.00;
        p.stockCurrent = 150;
        p.stockMin = 50;
        p.barcode = '7891234567890';
        p.volumeDiscountStrategy = 'auto';
        p.status = 'active';
      });

      // Areia Ensacada
      await productsCollection.create(p => {
        p.name = 'Areia Média Ensacada 20kg';
        p.category = 'Básicos';
        p.unitType = 'un';
        p.priceSell = 8.50;
        p.priceCost = 4.00;
        p.stockCurrent = 40; // Low stock (Min is 50)
        p.stockMin = 50;
        p.barcode = '7890000000001';
        p.volumeDiscountStrategy = 'manual';
        p.status = 'active';
      });

      // Tijolo Cerâmico
      await productsCollection.create(p => {
        p.name = 'Tijolo 8 Furos 9x19x19';
        p.category = 'Alvenaria';
        p.unitType = 'un';
        p.priceSell = 1.20;
        p.priceCost = 0.70;
        p.stockCurrent = 0; // Out of stock
        p.stockMin = 500;
        p.barcode = '7890000000002';
        p.volumeDiscountStrategy = 'auto';
        p.status = 'active';
      });

      // Barra de Ferro
      await productsCollection.create(p => {
        p.name = 'Vara de Ferro 3/8 pol 12m';
        p.category = 'Ferragens';
        p.unitType = 'un';
        p.priceSell = 58.90;
        p.priceCost = 45.00;
        p.stockCurrent = 85;
        p.stockMin = 20;
        p.barcode = '7890000000003';
        p.volumeDiscountStrategy = 'manual';
        p.status = 'active';
      });
    });
    console.log('Seed: Produtos criados.');
  }
}
