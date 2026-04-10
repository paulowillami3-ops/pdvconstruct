import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { database } from '../../src/database';
import Sale from '../../src/database/models/Sale';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { generateReceiptText } from '../../src/utils/receipt-printer';

const SaleItem = ({ sale }: { sale: Sale }) => {
  const [customerName, setCustomerName] = React.useState('Consumidor');

  React.useEffect(() => {
    sale.customer.fetch().then(c => {
      if (c) setCustomerName(c.name);
    });
  }, [sale]);

  const handleReprint = async () => {
    const receipt = await generateReceiptText(sale);
    Alert.alert('Recibo Reimpressão', receipt.fullText);
    console.log(receipt.fullText);
  };

  return (
    <View style={styles.saleRow}>
      <View style={styles.saleInfo}>
        <Text style={styles.saleTime}>
          {new Date(sale.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.saleCustomer}>{customerName}</Text>
      </View>
      
      <View style={styles.saleFinance}>
        <Text style={styles.saleTotal}>R$ {sale.totalAmount.toFixed(2)}</Text>
        <Text style={styles.saleMethod}>{sale.paymentMethod.toUpperCase()}</Text>
      </View>

      <TouchableOpacity style={styles.reprintBtn} onPress={handleReprint}>
        <IconSymbol name="printer.fill" size={16} color="#60A5FA" />
      </TouchableOpacity>
    </View>
  );
};

const ReportsScreen = ({ sales }: { sales: Sale[] }) => {
  const summary = useMemo(() => {
    const totals = {
      total: 0,
      dinheiro: 0,
      pix: 0,
      cartao: 0,
      fiado: 0
    };

    sales.forEach(s => {
      totals.total += s.totalAmount;
      if (s.paymentMethod === 'dinheiro') totals.dinheiro += s.totalAmount;
      if (s.paymentMethod === 'pix') totals.pix += s.totalAmount;
      if (s.paymentMethod === 'cartao') totals.cartao += s.totalAmount;
      if (s.paymentMethod === 'fiado') totals.fiado += s.totalAmount;
    });

    return totals;
  }, [sales]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Relatórios</Text>
        <Text style={styles.subtitle}>Resumo do Dia</Text>
      </View>

      <View style={styles.summaryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
          <View style={[styles.summaryCard, { backgroundColor: '#3B82F6' }]}>
            <Text style={styles.summaryLabel}>Total Geral</Text>
            <Text style={styles.summaryValue}>R$ {summary.total.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Dinheiro</Text>
            <Text style={styles.summaryValue}>R$ {summary.dinheiro.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>PIX</Text>
            <Text style={styles.summaryValue}>R$ {summary.pix.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Cartão</Text>
            <Text style={styles.summaryValue}>R$ {summary.cartao.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#F87171', borderWidth: 1 }]}>
            <Text style={[styles.summaryLabel, { color: '#F87171' }]}>Fiado</Text>
            <Text style={[styles.summaryValue, { color: '#EF4444' }]}>R$ {summary.fiado.toFixed(2)}</Text>
          </View>
        </ScrollView>
      </View>

      <Text style={styles.sectionTitle}>Histórico de Vendas</Text>
      <FlatList
        data={sales}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <SaleItem sale={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="calendar.badge.exclamationmark" size={48} color="#1E293B" />
            <Text style={styles.emptyText}>Nenhuma venda registrada hoje.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    minWidth: 140,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  saleRow: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  saleInfo: {
    flex: 1,
  },
  saleTime: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '700',
    marginBottom: 2,
  },
  saleCustomer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  saleFinance: {
    alignItems: 'flex-end',
    marginRight: 16,
  },
  saleTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  saleMethod: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
  },
  reprintBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 14,
  },
});

const enhance = withObservables([], ({ database }: { database: any }) => ({
  sales: database.get<Sale>('sales').query().observe(),
}));

export default withDatabase(enhance(ReportsScreen));
