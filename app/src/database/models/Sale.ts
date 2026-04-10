import { Model, Relation } from '@nozbe/watermelondb';
import { field, date, readonly, relation, children } from '@nozbe/watermelondb/decorators';
import Customer from './Customer';
import User from './User';
import type SaleItem from './SaleItem';

export default class Sale extends Model {
  static table = 'sales'
  static associations = {
    sale_items: { type: 'has_many', foreignKey: 'sale_id' },
  } as const

  @field('total_amount') totalAmount!: number
  @field('payment_method') paymentMethod!: string
  @field('status') status!: string
  @field('is_synced') isSynced!: boolean
  @field('timestamp') timestamp!: number

  @relation('customers', 'customer_id') customer!: Relation<Customer>
  @relation('users', 'user_id') user!: Relation<User>
  
  @children('sale_items') items!: any // SaleItem[]

  @readonly @date('created_at') createdAt!: Date
}
