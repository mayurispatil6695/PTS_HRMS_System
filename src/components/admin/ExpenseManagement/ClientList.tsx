// src/components/admin/ExpenseManagement/ClientList.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { Download, CircleDollarSign, FileText, Trash2 } from 'lucide-react';
import { Client, ClientPayment } from '@/types/finance';
import { formatCurrency, formatDate, getClientTotalPayments, getClientPendingAmount } from '../../../utils/financeHelpers';

interface Props {
  clients: Client[];
  payments: ClientPayment[];
  onRecordPayment: (clientId: string) => void;
  onDelete: (id: string, adminId?: string) => void;
  onExport?: () => void;
}

export const ClientList: React.FC<Props> = ({ clients, payments, onRecordPayment, onDelete, onExport }) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><CardTitle>Clients ({clients.length})</CardTitle><CardDescription>Manage your clients and their payments</CardDescription></div>
          {onExport && <Button onClick={onExport}><Download className="h-4 w-4 mr-2" /> Export Clients</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Package</TableHead><TableHead>Payments</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {clients.map(client => {
                const totalPaid = getClientTotalPayments(client.id, payments);
                const pending = getClientPendingAmount(client, payments);
                const percentage = (totalPaid / client.packageAmount) * 100;
                return (
                  <TableRow key={client.id}>
                    <TableCell><div className="font-medium">{client.name}</div><div className="text-xs text-gray-500">{client.contact}</div></TableCell>
                    <TableCell><div className="font-medium">{formatCurrency(client.packageAmount)}</div><div className="text-xs capitalize">{client.packageType}</div><div className="text-xs">Since {formatDate(client.startDate)}</div></TableCell>
                    <TableCell><div className="flex items-center gap-2"><Progress value={percentage} className="h-2 w-24" /><span>{percentage.toFixed(0)}%</span></div><div className="text-sm">Paid: {formatCurrency(totalPaid)}</div><div className={`text-sm ${pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>{pending > 0 ? `Pending: ${formatCurrency(pending)}` : 'Fully Paid'}</div></TableCell>
                    <TableCell><Badge variant={pending > 0 ? 'secondary' : 'default'}>{pending > 0 ? 'Pending' : 'Paid'}</Badge></TableCell>
                    <TableCell><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onRecordPayment(client.id)}><CircleDollarSign className="h-3 w-3 mr-1" /> Payment</Button><Button size="sm" variant="outline"><FileText className="h-3 w-3 mr-1" /> Invoice</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => onDelete(client.id, client.adminId)}><Trash2 className="h-3 w-3" /></Button></div></TableCell>
                  </TableRow>
                );
              })}
              {clients.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">No clients found. Add your first client.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};