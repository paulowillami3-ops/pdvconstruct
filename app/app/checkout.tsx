import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { database } from '@/src/database';
import Product from '@/src/database/models/Product';
import Sale from '@/src/database/models/Sale';
import SaleItem from '@/src/database/models/SaleItem';
import StockLog from '@/src/database/models/StockLog';
import Customer from '@/src/database/models/Customer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/src/context/AuthContext';

type CartItem = {
  id: string;
  qty: number;
  price: number;
  name: string;
};

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Dinheiro', icon: 'banknote' },
  { id: 'pix', label: 'PIX', icon: 'qrcode' },
  { id: 'card', label: 'Cartão', icon: 'creditcard' },
  { id: 'credit', label: 'Fiado', icon: 'person.fill' },
];

export default function CheckoutScreen() {
  const { cartJson } = useLocalSearchParams<{ cartJson: string }>();
  const cart: CartItem[] = JSON.parse(cartJson || '[]');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();

  const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  useEffect(() => {
    database.get<Customer>('customers').query().fetch().then(setAllCustomers);
  }, []);

  const filteredCustomers = allCustomers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.cpf.includes(customerSearch)
  );

  const confirmSale = async () => {
    if (loading) return;

    // Validation: Fiado requires a customer
    if (paymentMethod === 'credit' && !selectedCustomer) {
      Alert.alert('Atenção', 'Selecione um cliente para realizar uma venda no Fiado.');
      return;
    }

    // Validation: Credit Limit
    if (paymentMethod === 'credit' && selectedCustomer) {
      const newBalance = selectedCustomer.balanceOwed + total;
      if (newBalance > selectedCustomer.creditLimit) {
        Alert.alert(
          'Limite Excedido', 
          `O cliente atingiu o limite de crédito!\n\nSaldo atual: R$ ${selectedCustomer.balanceOwed.toFixed(2)}\nLimite: R$ ${selectedCustomer.creditLimit.toFixed(2)}`
        );
        return;
      }
    }

    setLoading(true);

    try {
      await database.write(async () => {
        // 1. Create Sale
        const newSale = await database.get<Sale>('sales').create((s) => {
          s.totalAmount = total;
          s.paymentMethod = paymentMethod;
          s.status = 'completed';
          s.isSynced = false;
          s.timestamp = Date.now();
          if (user) s.user.set(user);
          if (selectedCustomer) s.customer.set(selectedCustomer);
        });

        // 2. Update Customer Balance if Fiado
        if (paymentMethod === 'credit' && selectedCustomer) {
          await selectedCustomer.update(c => {
            c.balanceOwed += total;
          });
        }

        // 3. Create Items & Deduct Stock
        for (const item of cart) {
          const product = await database.get<Product>('products').find(item.id);
          
          await database.get<SaleItem>('sale_items').create((si) => {
            si.sale.set(newSale);
            si.product.set(product);
            si.quantity = item.qty;
            si.unitPrice = item.price;
            si.discountAmount = 0;
            si.totalItemPrice = item.price * item.qty;
          });

          await product.update((p) => {
            p.stockCurrent -= item.qty;
          });

          await database.get<StockLog>('stock_logs').create((log) => {
            log.product.set(product);
            log.changeAmount = -item.qty;
            log.type = 'sale';
            log.timestamp = Date.now();
            if (user) log.user.set(user);
          });
        }
      });

      Alert.alert(
        'Venda Concluída!',
        'A transação foi salva e o estoque atualizado.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível salvar a venda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Fechamento</Text>
        
        {/* Customer Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente (Obrigatório para Fiado)</Text>
          <TouchableOpacity 
            style={[styles.customerPicker, selectedCustomer && styles.customerPickerActive]}
            onPress={() => setShowCustomerPicker(true)}
          >
            <IconSymbol name="person.crop.circle.badge.plus" size={20} color={selectedCustomer ? '#FFF' : '#64748B'} />
            <Text style={[styles.customerPickerText, selectedCustomer && styles.customerPickerTextActive]}>
              {selectedCustomer ? `${selectedCustomer.name} (Saldo: R$ ${selectedCustomer.balanceOwed.toFixed(2)})` : 'Selecionar Cliente...'}
            </Text>
            {selectedCustomer && (
              <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                <IconSymbol name="xmark.circle.fill" size={20} color="#F87171" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumo do Pedido</Text>
          {cart.map(item => (
            <View key={item.id} style={styles.summaryRow}>
              <Text style={styles.summaryName}>{item.qty}x {item.name}</Text>
              <Text style={styles.summaryPrice}>R$ {(item.price * item.qty).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryTotalRow}>
            <Text style={styles.totalLabel}>Total a Pagar</Text>
            <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Forma de Pagamento</Text>
        <View style={styles.methodsGrid}>
          {PAYMENT_METHODS.map(method => (
            <TouchableOpacity 
              key={method.id} 
              style={[
                styles.methodBtn, 
                paymentMethod === method.id && styles.methodBtnActive
              ]}
              onPress={() => setPaymentMethod(method.id)}
            >
              <IconSymbol 
                name={method.icon as any} 
                size={24} 
                color={paymentMethod === method.id ? '#FFF' : '#94A3B8'} 
              />
              <Text style={[
                styles.methodLabel,
                paymentMethod === method.id && styles.methodLabelActive
              ]}>{method.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.confirmBtn, loading && styles.disabledBtn]} 
          onPress={confirmSale}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.confirmBtnText}>Finalizar Transação</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Voltar ao Carrinho</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Customer Selection Overlay */}
      {showCustomerPicker && (
        <View style={styles.overlay}>
          <View style={styles.overlayContent}>
            <Text style={styles.overlayTitle}>Selecionar Cliente</Text>
            <TextInput 
              style={styles.overlayInput}
              placeholder="Buscar Cliente..."
              placeholderTextColor="#64748B"
              value={customerSearch}
              onChangeText={setCustomerSearch}
              autoFocus
            />
            <FlatList
              data={filteredCustomers}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.customerSelectItem}
                  onPress={() => {
                    setSelectedCustomer(item);
                    setShowCustomerPicker(false);
                    setCustomerSearch('');
                  }}
                >
                  <Text style={styles.customerSelectName}>{item.name}</Text>
                  <Text style={styles.customerSelectDetail}>CPF: {item.cpf}</Text>
                </TouchableOpacity>
              )}
              style={styles.overlayList}
            />
            <TouchableOpacity style={styles.overlayClose} onPress={() => setShowCustomerPicker(false)}>
              <Text style={styles.overlayCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  customerPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customerPickerActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F620',
  },
  customerPickerText: {
    flex: 1,
    color: '#64748B',
    marginLeft: 12,
    fontSize: 16,
  },
  customerPickerTextActive: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryTitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryName: {
    color: '#F8FAFC',
    fontSize: 16,
    flex: 0.7,
  },
  summaryPrice: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    color: '#10B981',
    fontSize: 28,
    fontWeight: '900',
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 40,
  },
  methodBtn: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  methodLabel: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  methodLabelActive: {
    color: '#FFF',
  },
  confirmBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cancelBtn: {
    padding: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  overlayContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    height: '80%',
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 20,
  },
  overlayInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 16,
  },
  overlayList: {
    flex: 1,
  },
  customerSelectItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  customerSelectName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  customerSelectDetail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  overlayClose: {
    padding: 20,
    alignItems: 'center',
  },
  overlayCloseText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 16,
  },
});
