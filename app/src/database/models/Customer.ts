import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Customer extends Model {
  static table = 'customers'

  @field('name') name!: string
  @field('phone') phone!: string
  @field('cpf') cpf!: string
  @field('credit_limit') creditLimit!: number
  @field('balance_owed') balanceOwed!: number
  @field('status') status!: string // active, blocked

  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}
