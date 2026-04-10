import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class StockLog extends Model {
  static table = 'stock_logs'

  @field('product_id') productId!: string
  @field('change_amount') changeAmount!: number
  @field('type') type!: string // supply, sale_manual, adjustment
  @field('notes') notes!: string
  @field('timestamp') timestamp!: number

  @relation('products', 'product_id') product!: any
  @relation('users', 'user_id') user!: any

  @readonly @date('created_at') createdAt!: Date
  
  // Relations could be added here if needed
}
