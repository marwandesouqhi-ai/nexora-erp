import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '../lib/firebase';
import type { Company } from '../types';
import { logAction } from './auditService';

export const getCompanies = async (): Promise<Company[]> => {
  const querySnapshot = await getDocs(collection(db, 'companies'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Company[];
};

export const updateCompanyStatus = async (companyId: string, status: Company['status'], reason?: string, plan?: string) => {
  const companyRef = doc(db, 'companies', companyId);
  const dataToUpdate: any = { status };
  
  if (status === 'suspended' && reason) {
    dataToUpdate.suspended_reason = reason;
  }
  
  if (plan) {
    dataToUpdate['subscription.plan'] = plan;
  }

  await updateDoc(companyRef, dataToUpdate);
  const userEmail = auth.currentUser?.email || 'System';
  await logAction('تحديث حالة الشركة', userEmail, companyId, `الحالة الجديدة: ${status}`);
};

export const updateCompany = async (companyId: string, data: Partial<Company>) => {
  const companyRef = doc(db, 'companies', companyId);
  
  const dataToUpdate = { ...data };
  delete dataToUpdate.id; 

  await updateDoc(companyRef, dataToUpdate);
  const userEmail = auth.currentUser?.email || 'System';
  await logAction('تعديل بيانات شركة', userEmail, companyId, `تم تعديل بيانات الشركة بنجاح`);
};

export const createCompany = async (data: {
  companyName: string;
  companyEmail: string;
  ownerName: string;
  ownerEmail: string;
  /** رقم واتساب إدارة الشركة (يُوحَّد ويُحفظ في companies/{id}.admin_whatsapp) */
  adminWhatsapp?: string;
  plan?: 'basic' | 'pro' | 'enterprise';
}) => {
  const provision = httpsCallable<typeof data, {
    companyId: string;
    ownerUid: string;
    passwordResetLink: string;
  }>(functions, 'provisionCompany');
  const result = await provision(data);
  return result.data;
};

export const deleteCompany = async (companyId: string) => {
  const companyRef = doc(db, 'companies', companyId);
  await deleteDoc(companyRef);
  const userEmail = auth.currentUser?.email || 'System';
  await logAction('حذف شركة', userEmail, companyId, `تم حذف الشركة ومعرفها ${companyId}`);
};
