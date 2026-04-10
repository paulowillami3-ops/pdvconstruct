import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { database } from '@/src/database';
import Product from '@/src/database/models/Product';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Product Item Component
const ProductItem = ({ product }: { product: Product }) => {
  const router = useRouter();
  const isOutOfStock = product.stockCurrent === 0;
  const isLowStock = product.stockCurrent <= product.stockMin;

  const stockBadgeStyle = [
    styles.stockBadge,
    isLowStock && styles.lowStockBadge,
    isOutOfStock && styles.noStockBadge,
  ];

  const stockTextStyle = [
    styles.stockValue,
    (isLowStock || isOutOfStock) && styles.alertText,
  ];

  return (
    <View style={styles.itemContainer}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{product.name}</Text>
        <Text style={styles.itemCategory}>{product.category} • {product.unitType}</Text>
        <Text style={styles.itemPrice}>R$ {product.priceSell.toFixed(2)}</Text>
      </View>
      
      <View style={styles.stockSection}>
        <View style={stockBadgeStyle}>
          <Text style={stockTextStyle}>{product.stockCurrent}</Text>
        </View>
        <Text style={styles.minStockLabel}>Mín: {product.stockMin}</Text>
      </View>

      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => router.push({ pathname: '/modal', params: { productId: product.id } })}
      >
        <IconSymbol name="pencil" size={20} color="#64748B" />
      </TouchableOpacity>
    </View>
  );
};

// Enhancement with WatermelonDB Observables
const EnhanceProductItem = withObservables(['product'], ({ product }: { product: Product }) => ({
  product: product.observe(),
}))(ProductItem);

const InventoryScreen = () => {
  const [search, setSearch] = useState('');

  // Observation of the products collection
  const productsQuery = database.get<Product>('products').query(
    Q.where('status', 'active'),
    search ? Q.where('name', Q.like(`%${search}%`)) : Q.where('name', Q.notEq(''))
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Estoque e Catálogo</Text>
        <TouchableOpacity style={styles.addButton}>
          <IconSymbol name="plus" size={24} color="#FFF" />
          <Text style={styles.addButtonText}>Novo Item</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <IconSymbol name="magnifyingglass" size={20} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar material (ex: cimento, barra ferro...)"
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <EnhancedProductList query={productsQuery} />
    </View>
  );
};

// Reactive List Component
const ProductList = ({ products }: { products: Product[] }) => (
  <FlatList
    data={products}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => <EnhanceProductItem product={item} />}
    contentContainerStyle={styles.listContent}
    ListEmptyComponent={
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhum produto encontrado.</Text>
      </View>
    }
  />
);

const EnhancedProductList = withObservables(['query'], ({ query }: { query: any}) => ({
  products: query.observe(),
}))(ProductList);

export default InventoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '700',
    marginLeft: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: '#F8FAFC',
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  itemContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  stockSection: {
    alignItems: 'center',
    marginHorizontal: 15,
  },
  stockBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 45,
    alignItems: 'center',
  },
  lowStockBadge: {
    backgroundColor: '#CA8A04', // Yellow 600
  },
  noStockBadge: {
    backgroundColor: '#DC2626', // Red 600
  },
  stockValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  alertText: {
    color: '#FFFFFF',
  },
  minStockLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  editButton: {
    padding: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
  },
});
