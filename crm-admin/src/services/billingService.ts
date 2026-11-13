import { collection, getDocs, doc, updateDoc, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Invoice } from '../types';
import { logAction } from './auditService';
import { getCompanies, updateCompanyStatus } from './companiesService';

export const getInvoices = async (): Promise<Invoice[]> => {
  const q = query(collection(db, 'platform_invoices'), orderBy('created_at', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Invoice[];
};

export const getCompanyInvoices = async (companyId: string): Promise<Invoice[]> => {
  const q = query(collection(db, 'platform_invoices'), where('companyId', '==', companyId), orderBy('created_at', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Invoice[];
};

export const generateInvoice = async (companyId: string, companyName: string, amount: number, dueDate: string) => {
  const newInvoice = {
    companyId,
    companyName,
    amount,
    status: 'unpaid',
    dueDate,
    created_at: new Date().toISOString()
  };
  const docRef = await addDoc(collection(db, 'platform_invoices'), newInvoice);
  await logAction('إصدار فاتورة', 'System', docRef.id, `إصدار فاتورة جديدة بقيمة ${amount} لشركة ${companyName}`);
  return docRef.id;
};

export const payInvoice = async (invoiceId: string) => {
  const invRef = doc(db, 'platform_invoices', invoiceId);
  await updateDoc(invRef, { status: 'paid' });
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
