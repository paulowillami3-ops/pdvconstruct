import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { database } from '../../src/database';
import Customer from '../../src/database/models/Customer';
import { IconSymbol } from '@/components/ui/icon-symbol';

const CustomerItem = ({ customer }: { customer: Customer }) => {
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erro', 'Informe um valor válido para o pagamento.');
      return;
    }

    await database.write(async () => {
      await customer.update(c => {
        c.balanceOwed = Math.max(0, c.balanceOwed - amount);
      });
    });
    
    setPayModalVisible(false);
    setPayAmount('');
    Alert.alert('Sucesso', 'Pagamento registrado com sucesso!');
  };

  return (
    <View style={styles.customerCard}>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{customer.name}</Text>
        <Text style={styles.customerDetail}>CPF: {customer.cpf || 'Não informado'}</Text>
        <Text style={styles.customerDetail}>Tel: {customer.phone}</Text>
      </View>
      
      <View style={styles.balanceContainer}>
        <Text style={[styles.balanceLabel, customer.balanceOwed > 0 && styles.debtLabel]}>
          Saldo Devedor
        </Text>
        <Text style={[styles.balanceValue, customer.balanceOwed > 0 && styles.debtValue]}>
          R$ {customer.balanceOwed.toFixed(2)}
        </Text>
        
        {customer.balanceOwed > 0 && (
          <TouchableOpacity 
            style={styles.payButton}
            onPress={() => setPayModalVisible(true)}
          >
            <Text style={styles.payButtonText}>Pagar</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={payModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar Pagamento</Text>
            <Text style={styles.modalSubtitle}>{customer.name}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Valor do Pagamento (R$)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={payAmount}
              onChangeText={setPayAmount}
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPayModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePayment}>
                <Text style={styles.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const EnhancedCustomerItem = withObservables(['customer'], ({ customer }) => ({
  customer: customer.observe(),
}))(CustomerItem);

const CustomersScreen = ({ customers }: { customers: Customer[] }) => {
  const [search, setSearch] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newCpf, setNewCpf] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLimit, setNewLimit] = useState('1000');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf.includes(search) ||
    c.phone.includes(search)
  );

  const handleAddCustomer = async () => {
    if (!newName || !newPhone) {
      Alert.alert('Erro', 'Nome e Telefone são obrigatórios.');
      return;
    }

    await database.write(async () => {
      await database.get<Customer>('customers').create(c => {
        c.name = newName;
        c.cpf = newCpf;
        c.phone = newPhone;
        c.creditLimit = parseFloat(newLimit) || 0;
        c.balanceOwed = 0;
        c.status = 'active';
      });
    });

    setIsAddModalVisible(false);
    setNewName('');
    setNewCpf('');
    setNewPhone('');
    Alert.alert('Sucesso', 'Cliente cadastrado com sucesso!');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clientes</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
          <IconSymbol name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <IconSymbol name="magnifyingglass" size={20} color="#64748B" />
        <TextInput 
          style={styles.searchInput}
          placeholder="Buscar por nome, CPF ou telefone..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <EnhancedCustomerItem customer={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum cliente encontrado.</Text>
        }
      />

      <Modal visible={isAddModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo Cliente</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nome Completo"
              placeholderTextColor="#64748B"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.input}
              placeholder="CPF"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={newCpf}
              onChangeText={setNewCpf}
            />
            <TextInput
              style={styles.input}
              placeholder="Telefone"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
             <TextInput
              style={styles.input}
              placeholder="Limite de Crédito (R$)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={newLimit}
              onChangeText={setNewLimit}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAddCustomer}>
                <Text style={styles.confirmBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    marginLeft: 10,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  customerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 13,
    color: '#64748B',
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  debtLabel: {
    color: '#F87171',
  },
  debtValue: {
    color: '#EF4444',
  },
  payButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  payButtonText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 40,
    fontSize: 16,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 16,
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});

const enhance = withObservables([], ({ database }: { database: any }) => ({
  customers: database.get<Customer>('customers').query().observe(),
}));

export default withDatabase(enhance(CustomersScreen));
