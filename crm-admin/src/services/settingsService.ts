import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

export const getSystemSettings = async (): Promise<SystemSettings> => {
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
  const docRef = doc(db, 'platform_settings', 'general');
  await setDoc(docRef, settings, { merge: true });
};
