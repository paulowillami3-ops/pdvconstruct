import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import Product from './Product';
import Sale from './Sale';

export default class SaleItem extends Model {
  static table = 'sale_items'
  static associations = {
    sales: { type: 'belongs_to', key: 'sale_id' },
    products: { type: 'belongs_to', key: 'product_id' },
  } as const

  @field('sale_id') saleId!: string
  @field('product_id') productId!: string
  @field('quantity') quantity!: number
  @field('unit_price') unitPrice!: number
  @field('discount_amount') discountAmount!: number
  @field('total_item_price') totalItemPrice!: number

  @relation('sales', 'sale_id') sale!: Relation<Sale>
  @relation('products', 'product_id') product!: Relation<Product>
}
