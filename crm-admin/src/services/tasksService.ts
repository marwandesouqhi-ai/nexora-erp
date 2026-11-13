import { collection, getDocs, doc, updateDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import type { Task } from '../types';
import { logAction } from './auditService';

export const getTasks = async (): Promise<Task[]> => {
  const q = query(collection(db, 'platform_tasks'), orderBy('created_at', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Task[];
};

export const createTask = async (title: string, assignedTo: string, description?: string, deadline?: string) => {
  const newTask = {
    title,
    assignedTo,
    description: description || '',
    status: 'pending',
    deadline: deadline || null,
    created_at: new Date().toISOString()
  };
  const docRef = await addDoc(collection(db, 'platform_tasks'), newTask);
  const currentUser = auth.currentUser?.email || 'System';
  await logAction('إسناد مهمة', currentUser, docRef.id, `إسناد مهمة جديدة للموظف ${assignedTo}`);
  return docRef.id;
};

export const updateTaskStatus = async (taskId: string, status: Task['status']) => {
  const taskRef = doc(db, 'platform_tasks', taskId);
  await updateDoc(taskRef, { status });
  const currentUser = auth.currentUser?.email || 'System';
  await logAction('تحديث مهمة', currentUser, taskId, `تغيير حالة المهمة إلى ${status}`);
};
