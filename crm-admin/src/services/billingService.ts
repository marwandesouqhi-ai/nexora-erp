import { collection, getDocs, doc, updateDoc, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSupabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';
import type { Invoice } from '../types';
import { logAction } from './auditService';
import { getCompanies, updateCompanyStatus } from './companiesService';

// platform_invoices columns are snake_case; the UI types are camelCase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toInvoice = (row: any): Invoice => ({
  id: row.id,
  companyId: row.company_id,
  companyName: row.company_name,
  amount: Number(row.amount),
  status: row.status,
  dueDate: row.due_date,
  created_at: row.created_at,
});

export const getInvoices = async (): Promise<Invoice[]> => {
  if (isSupabaseBackend) {
    const { data, error } = await getSupabase().from('platform_invoices').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toInvoice);
  }
  const q = query(collection(db, 'platform_invoices'), orderBy('created_at', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Invoice[];
};

export const getCompanyInvoices = async (companyId: string): Promise<Invoice[]> => {
  if (isSupabaseBackend) {
    const { data, error } = await getSupabase()
      .from('platform_invoices').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toInvoice);
  }
  const q = query(collection(db, 'platform_invoices'), where('companyId', '==', companyId), orderBy('created_at', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Invoice[];
};

export const generateInvoice = async (companyId: string, companyName: string, amount: number, dueDate: string) => {
  let id: string;
  if (isSupabaseBackend) {
    const { data, error } = await getSupabase()
      .from('platform_invoices')
      .insert({ company_id: companyId, company_name: companyName, amount, status: 'unpaid', due_date: dueDate })
      .select('id')
      .single();
    if (error) throw error;
    id = data.id;
  } else {
    const newInvoice = {
      companyId,
      companyName,
      amount,
      status: 'unpaid',
      dueDate,
      created_at: new Date().toISOString()
    };
    id = (await addDoc(collection(db, 'platform_invoices'), newInvoice)).id;
  }
  await logAction('إصدار فاتورة', 'System', id, `إصدار فاتورة جديدة بقيمة ${amount} لشركة ${companyName}`);
  return id;
};

export const payInvoice = async (invoiceId: string) => {
  if (isSupabaseBackend) {
    const { error } = await getSupabase().from('platform_invoices').update({ status: 'paid' }).eq('id', invoiceId);
    if (error) throw error;
  } else {
    await updateDoc(doc(db, 'platform_invoices', invoiceId), { status: 'paid' });
  }
  await logAction('سداد فاتورة', 'System', invoiceId, 'تم تحصيل الفاتورة بنجاح');
};

export const checkAndSuspendExpired = async () => {
  const companies = await getCompanies();
  const now = new Date();

  for (const company of companies) {
    if (company.status === 'active' && company.subscription?.endDate) {
      const endDate = new Date(company.subscription.endDate);
      if (endDate < now) {
        await updateCompanyStatus(company.id, 'suspended', 'انتهاء فترة الاشتراك وعدم التجديد');
        await logAction('تعليق آلي', 'System Automator', company.id, 'تم تعليق الشركة آلياً لانتهاء الاشتراك');
      }
    }
  }
};
