import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, Keyboard } from 'react-native';
import { database } from '@/src/database';
import Product from '@/src/database/models/Product';
import { Q } from '@nozbe/watermelondb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
}

export default function PDVScreen() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const searchInputRef = useRef<TextInput>(null);
  const router = useRouter();

  // Search logic
  useEffect(() => {
    if (search.length > 1) {
      const timer = setTimeout(async () => {
        const results = await database.get<Product>('products').query(
          Q.or(
            Q.where('name', Q.like(`%${search}%`)),
            Q.where('barcode', Q.eq(search))
          ),
          Q.where('status', 'active'),
          Q.take(5)
        ).fetch();
        
        // Auto-add if exact barcode match
        const exactMatch = results.find(p => p.barcode === search);
        if (exactMatch) {
          addToCart(exactMatch);
          setSearch('');
          setSearchResults([]);
        } else {
          setSearchResults(results);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [search]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      const newQty = existing ? existing.quantity + 1 : 1;
      
      // Auto-discount logic: 5% off if qty >= 10 and strategy is 'auto'
      let finalPrice = product.priceSell;
      if (product.volumeDiscountStrategy === 'auto' && newQty >= 10) {
        finalPrice = product.priceSell * 0.95;
      }

      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: newQty, price: finalPrice } 
            : item
        );
      }
      return [...prev, { product, quantity: 1, price: finalPrice }];
    });
    Keyboard.dismiss();
    setSearch('');
    setSearchResults([]);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        
        // Re-apply auto-discount check
        let finalPrice = item.product.priceSell;
        if (item.product.volumeDiscountStrategy === 'auto' && newQty >= 10) {
          finalPrice = item.product.priceSell * 0.95;
        }

        return { ...item, quantity: newQty, price: finalPrice };
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Carrinho Vazio', 'Adicione produtos para continuar.');
      return;
    }
    // Pass cart data to checkout screen via params (simplified for now)
    // In a real app we might use a Global State or Draft Sale in DB
    router.push({
      pathname: '/checkout',
      params: { 
        cartJson: JSON.stringify(cart.map(i => ({ 
          id: i.product.id, 
          qty: i.quantity, 
          price: i.price,
          name: i.product.name 
        })))
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Venda de Balcão</Text>
        <TouchableOpacity onPress={() => setCart([])}>
          <Text style={styles.clearText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <IconSymbol name="barcode.viewfinder" size={24} color="#94A3B8" />
          <TextInput
            ref={searchInputRef}
            style={styles.input}
            placeholder="Escaneie ou digite o produto..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>

        {searchResults.length > 0 && (
          <View style={styles.resultsDropdown}>
            {searchResults.map(p => (
              <TouchableOpacity 
                key={p.id} 
                style={styles.resultItem}
                onPress={() => addToCart(p)}
              >
                <Text style={styles.resultName}>{p.name}</Text>
                <Text style={styles.resultPrice}>R$ {p.priceSell.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={cart}
        keyExtractor={item => item.product.id}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.product.name}</Text>
              <Text style={styles.itemMeta}>R$ {item.price.toFixed(2)} / {item.product.unitType}</Text>
            </View>
            
            <View style={styles.qtyControls}>
              <TouchableOpacity onPress={() => updateQuantity(item.product.id, -1)} style={styles.qtyBtn}>
                <IconSymbol name="minus" size={16} color="#F8FAFC" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity onPress={() => updateQuantity(item.product.id, 1)} style={styles.qtyBtn}>
                <IconSymbol name="plus" size={16} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => removeFromCart(item.product.id)} style={styles.deleteBtn}>
              <IconSymbol name="trash" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.cartList}
        ListEmptyComponent={
          <View style={styles.emptyCart}>
            <IconSymbol name="cart" size={64} color="#334155" />
            <Text style={styles.emptyText}>Carrinho vazio</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
          <Text style={styles.checkoutBtnText}>Fechar Pedido (F10)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  clearText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  searchWrapper: {
    zIndex: 10,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#334155',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    color: '#F8FAFC',
    fontSize: 18,
  },
  resultsDropdown: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  resultName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  resultPrice: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  cartList: {
    paddingHorizontal: 20,
    paddingBottom: 200,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#94A3B8',
    fontSize: 13,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 4,
    marginHorizontal: 10,
  },
  qtyBtn: {
    backgroundColor: '#334155',
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    color: '#F8FAFC',
    width: 30,
    textAlign: 'center',
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '600',
  },
  totalValue: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '900',
  },
  checkoutBtn: {
    backgroundColor: '#10B981', // Emerald 500
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  emptyCart: {
    alignItems: 'center',
    marginTop: 100,
    opacity: 0.5,
  },
  emptyText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 16,
  },
});
