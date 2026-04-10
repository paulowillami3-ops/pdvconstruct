import Sale from '../database/models/Sale';
import SaleItem from '../database/models/SaleItem';

export interface ReceiptData {
  header: string;
  items: string[];
  footer: string;
  fullText: string;
}

export const generateReceiptText = async (sale: Sale): Promise<ReceiptData> => {
  const items = await sale.items.fetch() as SaleItem[];
  const dateStr = new Date(sale.timestamp).toLocaleString('pt-BR');
  
  const line = '--------------------------------\n';
  let header = `      CONSTRUX PDV - LOJA       \n`;
  header += `   Material de Construcao       \n`;
  header += line;
  header += `Data: ${dateStr}\n`;
  header += `Venda ID: ${sale.id.slice(0, 8)}\n`;
  header += line;
  header += `ITEM      QTD    UN    TOTAL\n`;

  let itemsBody = '';
  for (const item of items) {
    const product = await item.product.fetch();
    const name = product?.name.slice(0, 10).padEnd(10);
    const qty = item.quantity.toString().padEnd(6);
    const price = item.unitPrice.toFixed(2).padStart(6);
    const total = (item.unitPrice * item.quantity).toFixed(2).padStart(8);
    
    itemsBody += `${name} ${qty} ${price} ${total}\n`;
  }

  let footer = line;
  footer += `TOTAL: R$ ${sale.totalAmount.toFixed(2).padStart(20)}\n`;
  footer += `Pagamento: ${sale.paymentMethod.toUpperCase()}\n`;
  footer += line;
  footer += `   Obrigado pela Preferencia!   \n`;
  footer += `      www.construxpdv.com.br    \n`;

  return {
    header,
    items: [itemsBody],
    footer,
    fullText: header + itemsBody + footer
  };
};
