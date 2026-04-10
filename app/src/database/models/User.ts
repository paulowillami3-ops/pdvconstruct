import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users'

  @field('name') name!: string
  @field('username') username!: string
  @field('password_hash') passwordHash!: string
  @field('role') role!: string // admin, manager, cashier
  @field('status') status!: string // active, inactive

  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}
