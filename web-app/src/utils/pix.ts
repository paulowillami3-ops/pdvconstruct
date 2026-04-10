/**
 * Utilitário para geração de payloads PIX estáticos com suporte a valor dinâmico.
 * Segue o padrão EMVCo / BR Code do Banco Central.
 */

function generateCRC16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xFFFF;

  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ polynomial) : (crc << 1);
    }
  }

  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function formatTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export interface PixConfig {
  key: string;
  type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  name?: string;
  city?: string;
  amount?: number;
  txid?: string;
}

export function generatePixPayload({ key, type, name, city, amount, txid }: PixConfig): string {
  // Limpeza de campos e tratamento por tipo de chave
  let cleanKey = key.trim();
  
  if (type === 'phone') {
    // Remove tudo que não é número
    const numbersOnly = cleanKey.replace(/\D/g, '');
    // Adiciona +55 se não tiver
    cleanKey = numbersOnly.startsWith('55') ? `+${numbersOnly}` : `+55${numbersOnly}`;
  } else if (type === 'cpf' || type === 'cnpj') {
    // Remove tudo que não é número
    cleanKey = cleanKey.replace(/\D/g, '');
  }
  
  // Nome e Cidade limitados e simplificados para máxima compatibilidade
  const cleanName = (name || "LOJA MATERIAL").trim().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z ]/g, "")
    .substring(0, 25)
    .toUpperCase();
    
  const cleanCity = (city || "CIDADE").trim().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z ]/g, "")
    .substring(0, 15)
    .toUpperCase();

  const cleanTxid = (txid || "***").trim().normalize("NFD")
    .replace(/[^a-zA-Z0-9*]/g, "")
    .substring(0, 25) || "***";

  let payload = "";
  payload += formatTLV("00", "01"); // Payload Format Indicator
  
  // Merchant Account Information - Pix (Tag 26)
  const gui = formatTLV("00", "br.gov.bcb.pix");
  const keyField = formatTLV("01", cleanKey);
  payload += formatTLV("26", gui + keyField);
  
  payload += "52040000"; // Merchant Category Code
  payload += "5303986";  // Transaction Currency (BRL)
  
  if (amount && amount > 0) {
    payload += formatTLV("54", amount.toFixed(2));
  }
  
  payload += "5802BR"; // Country Code
  payload += formatTLV("59", cleanName || "LOJA MATERIAL");
  payload += formatTLV("60", cleanCity || "CIDADE");
  
  // Additional Data Field Template (Tag 62)
  const txidField = formatTLV("05", cleanTxid || "***");
  payload += formatTLV("62", txidField);
  
  payload += "6304"; // CRC16 Header
  
  const checksum = generateCRC16(payload);
  return payload + checksum;
}
