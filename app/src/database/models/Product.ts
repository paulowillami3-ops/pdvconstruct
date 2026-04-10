import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Product extends Model {
  static table = 'products'

  @field('name') name!: string
  @field('category') category!: string
  @field('unit_type') unitType!: string
  @field('price_sell') priceSell!: number
  @field('price_cost') priceCost!: number
  @field('stock_current') stockCurrent!: number
  @field('stock_min') stockMin!: number
  @field('barcode') barcode!: string
  @field('volume_discount_strategy') volumeDiscountStrategy!: string
  @field('status') status!: string

  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}
