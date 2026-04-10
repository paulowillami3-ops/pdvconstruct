import { Database } from '@nozbe/watermelondb';
import adapter from './adapter';

import schema from './schema';
import migrations from './migrations';
import Product from './models/Product';
import User from './models/User';
import Customer from './models/Customer';
import StockLog from './models/StockLog';
import Sale from './models/Sale';
import SaleItem from './models/SaleItem';

export const database = new Database({
  adapter,
  modelClasses: [
    Product,
    User,
    Customer,
    StockLog,
    Sale,
    SaleItem,
  ],
});
