import { collection, getDocs, doc, updateDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSupabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';
import type { Task } from '../types';
import { logAction } from './auditService';
import { getCurrentUserEmail } from './authService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toTask = (row: any): Task => ({
  id: row.id,
  title: row.title,
  description: row.description ?? undefined,
  assignedTo: row.assigned_to,
  status: row.status,
  deadline: row.deadline ?? undefined,
  created_at: row.created_at,
});

export const getTasks = async (): Promise<Task[]> => {
  if (isSupabaseBackend) {
    const { data, error } = await getSupabase().from('platform_tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toTask);
  }
  const q = query(collection(db, 'platform_tasks'), orderBy('created_at', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Task[];
};

export const createTask = async (title: string, assignedTo: string, description?: string, deadline?: string) => {
  let id: string;
  if (isSupabaseBackend) {
    const { data, error } = await getSupabase()
      .from('platform_tasks')
      .insert({ title, assigned_to: assignedTo, description: description || '', status: 'pending', deadline: deadline || null })
      .select('id')
      .single();
    if (error) throw error;
    id = data.id;
  } else {
    const newTask = {
      title,
      assignedTo,
      description: description || '',
      status: 'pending',
      deadline: deadline || null,
      created_at: new Date().toISOString()
    };
    id = (await addDoc(collection(db, 'platform_tasks'), newTask)).id;
  }
  await logAction('إسناد مهمة', await getCurrentUserEmail(), id, `إسناد مهمة جديدة للموظف ${assignedTo}`);
  return id;
};

export const updateTaskStatus = async (taskId: string, status: Task['status']) => {
  if (isSupabaseBackend) {
    const { error } = await getSupabase().from('platform_tasks').update({ status }).eq('id', taskId);
    if (error) throw error;
  } else {
    await updateDoc(doc(db, 'platform_tasks', taskId), { status });
  }
  await logAction('تحديث مهمة', await getCurrentUserEmail(), taskId, `تغيير حالة المهمة إلى ${status}`);
};
