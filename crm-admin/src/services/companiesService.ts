import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callFunction } from '../lib/functions';
import { getSupabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';
import type { Company } from '../types';
import { logAction } from './auditService';
import { getCurrentUserEmail } from './authService';

// Real columns of public.companies; anything else (e.g. admin_whatsapp) lives in metadata.
const COMPANY_COLUMNS = ['name', 'email', 'phone', 'address', 'status', 'suspended_reason', 'subscription'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCompany = (row: any): Company => {
  const { metadata, ...rest } = row;
  return { ...(metadata || {}), ...rest } as Company;
};

export const getCompanies = async (): Promise<Company[]> => {
  if (isSupabaseBackend) {
    const { data, error } = await getSupabase().from('companies').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCompany);
  }
  const querySnapshot = await getDocs(collection(db, 'companies'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Company[];
};

export const updateCompanyStatus = async (companyId: string, status: Company['status'], reason?: string, plan?: string) => {
  if (isSupabaseBackend) {
    const sb = getSupabase();
    const patch: Record<string, unknown> = { status };
    if (status === 'suspended' && reason) patch.suspended_reason = reason;
    if (plan) {
      const { data: row, error: readError } = await sb.from('companies').select('subscription').eq('id', companyId).single();
      if (readError) throw readError;
      patch.subscription = { ...(row?.subscription || {}), plan };
    }
    const { error } = await sb.from('companies').update(patch).eq('id', companyId);
    if (error) throw error;
  } else {
    const companyRef = doc(db, 'companies', companyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataToUpdate: any = { status };
    if (status === 'suspended' && reason) dataToUpdate.suspended_reason = reason;
    if (plan) dataToUpdate['subscription.plan'] = plan;
    await updateDoc(companyRef, dataToUpdate);
  }
  await logAction('تحديث حالة الشركة', await getCurrentUserEmail(), companyId, `الحالة الجديدة: ${status}`);
};

export const updateCompany = async (companyId: string, data: Partial<Company>) => {
  const dataToUpdate = { ...data };
  delete dataToUpdate.id;

  if (isSupabaseBackend) {
    const sb = getSupabase();
    const columns: Record<string, unknown> = {};
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dataToUpdate)) {
      if (value === undefined || key === 'created_at') continue;
      if ((COMPANY_COLUMNS as readonly string[]).includes(key)) columns[key] = value;
      else extra[key] = value;
    }
    if (Object.keys(extra).length) {
      const { data: row, error: readError } = await sb.from('companies').select('metadata').eq('id', companyId).single();
      if (readError) throw readError;
      columns.metadata = { ...(row?.metadata || {}), ...extra };
    }
    const { error } = await sb.from('companies').update(columns).eq('id', companyId);
    if (error) throw error;
  } else {
    await updateDoc(doc(db, 'companies', companyId), dataToUpdate);
  }
  await logAction('تعديل بيانات شركة', await getCurrentUserEmail(), companyId, 'تم تعديل بيانات الشركة بنجاح');
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
  return callFunction<typeof data, { companyId: string; ownerUid: string; passwordResetLink?: string; delivery?: string }>('provisionCompany', data);
};

export const deleteCompany = async (companyId: string) => {
  if (isSupabaseBackend) {
    const { error } = await getSupabase().from('companies').delete().eq('id', companyId);
    if (error) throw error;
  } else {
    await deleteDoc(doc(db, 'companies', companyId));
  }
  await logAction('حذف شركة', await getCurrentUserEmail(), companyId, `تم حذف الشركة ومعرفها ${companyId}`);
};
