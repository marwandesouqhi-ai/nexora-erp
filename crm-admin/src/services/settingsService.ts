import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSupabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';

export interface SystemSettings {
  supportEmail: string;
  planBasicPrice: number;
  planProPrice: number;
  planEnterprisePrice: number;
  maintenanceMode: boolean;
}

const defaultSettings: SystemSettings = {
  supportEmail: 'support@example.com',
  planBasicPrice: 99,
  planProPrice: 299,
  planEnterprisePrice: 999,
  maintenanceMode: false
};

// camelCase UI field -> snake_case column of public.platform_settings (single row id = 'general').
const COLUMN_BY_FIELD: Record<keyof SystemSettings, string> = {
  supportEmail: 'support_email',
  planBasicPrice: 'plan_basic_price',
  planProPrice: 'plan_pro_price',
  planEnterprisePrice: 'plan_enterprise_price',
  maintenanceMode: 'maintenance_mode',
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  if (isSupabaseBackend) {
    const { data, error } = await getSupabase().from('platform_settings').select('*').eq('id', 'general').maybeSingle();
    if (error) throw error;
    if (!data) return defaultSettings;
    return {
      supportEmail: data.support_email ?? defaultSettings.supportEmail,
      planBasicPrice: Number(data.plan_basic_price ?? defaultSettings.planBasicPrice),
      planProPrice: Number(data.plan_pro_price ?? defaultSettings.planProPrice),
      planEnterprisePrice: Number(data.plan_enterprise_price ?? defaultSettings.planEnterprisePrice),
      maintenanceMode: Boolean(data.maintenance_mode),
    };
  }
  const docRef = doc(db, 'platform_settings', 'general');
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as SystemSettings;
  } else {
    // The first platform admin may explicitly save these defaults. Reads never
    // create data, so a support account cannot mutate configuration by loading it.
    return defaultSettings;
  }
};

export const updateSystemSettings = async (settings: Partial<SystemSettings>): Promise<void> => {
  if (isSupabaseBackend) {
    const row: Record<string, unknown> = { id: 'general' };
    for (const [field, column] of Object.entries(COLUMN_BY_FIELD)) {
      const value = settings[field as keyof SystemSettings];
      if (value !== undefined) row[column] = value;
    }
    const { error } = await getSupabase().from('platform_settings').upsert(row, { onConflict: 'id' });
    if (error) throw error;
    return;
  }
  const docRef = doc(db, 'platform_settings', 'general');
  await setDoc(docRef, settings, { merge: true });
};
