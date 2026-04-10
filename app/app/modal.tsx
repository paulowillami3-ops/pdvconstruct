import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { database } from '@/src/database';
import Product from '@/src/database/models/Product';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function StockAdjustModal() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (productId) {
      database.get<Product>('products').find(productId).then(setProduct);
    }
  }, [productId]);

  const handleUpdate = async () => {
    if (!product || isNaN(Number(newStock))) {
      Alert.alert('Erro', 'Insira um valor numérico válido.');
      return;
    }

    try {
      await database.write(async () => {
        await product.update((p) => {
          p.stockCurrent = Number(newStock);
        });
      });
      router.back();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar estoque.');
    }
  };

  if (!product) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.subtitle}>Ajuste de Estoque ({product.unitType})</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Estratégia de Desconto por Volume</Text>
          <View style={styles.strategyRow}>
            <TouchableOpacity 
              style={[styles.strategyBtn, product.volumeDiscountStrategy === 'auto' && styles.strategyBtnActive]}
              onPress={async () => {
                await database.write(async () => {
                  await product.update(p => p.volumeDiscountStrategy = 'auto');
                });
                setProduct(await database.get<Product>('products').find(product.id));
              }}
            >
              <Text style={styles.strategyBtnText}>Automático</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.strategyBtn, product.volumeDiscountStrategy === 'manual' && styles.strategyBtnActive]}
              onPress={async () => {
                await database.write(async () => {
                  await product.update(p => p.volumeDiscountStrategy = 'manual');
                });
                setProduct(await database.get<Product>('products').find(product.id));
              }}
            >
              <Text style={styles.strategyBtnText}>Manual</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
          <Text style={styles.saveButtonText}>Salvar Alterações</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  strategyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  strategyBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  strategyBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  strategyBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    padding: 18,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
