import * as XLSX from 'xlsx';
import { DbClient } from '@/hooks/useClients';

type ClientExportRow = {
  Kundennummer: string;
  Kunde: string;
};

const compareByClientNumber = (a: DbClient, b: DbClient): number => {
  if (a.client_number && b.client_number) return a.client_number.localeCompare(b.client_number);
  if (a.client_number) return -1;
  if (b.client_number) return 1;
  return a.name.localeCompare(b.name, 'de');
};

export const buildClientExportRows = (clients: DbClient[]): ClientExportRow[] =>
  [...clients].sort(compareByClientNumber).map(client => ({
    Kundennummer: client.client_number ?? '',
    Kunde: client.name,
  }));

export const exportClientsToExcel = (clients: DbClient[], filename = 'kundenliste.xlsx'): void => {
  const worksheet = XLSX.utils.json_to_sheet(buildClientExportRows(clients));
  worksheet['!cols'] = [{ wch: 14 }, { wch: 45 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kunden');
  XLSX.writeFile(workbook, filename);
};
