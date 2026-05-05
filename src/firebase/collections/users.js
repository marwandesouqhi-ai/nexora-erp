import { db } from '@/api/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';

const usersCollection = collection(db, 'users');

export const getUsers = async () => {
    const usersQuery = query(usersCollection, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(usersQuery);
    return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
};

export const addUser = async (data) => {
    const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        role: data.role || 'sales',
        status: data.status || 'active',
        temp_password: data.password || '',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };
    const docRef = await addDoc(usersCollection, payload);
    return { id: docRef.id, ...payload };
};

export const updateUser = async (id, data) => {
    const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        role: data.role || 'sales',
        status: data.status || 'active',
        updated_at: serverTimestamp(),
    };

    if (data.password) {
        payload.temp_password = data.password;
    }

    await updateDoc(doc(db, 'users', id), payload);
};

export const deleteUserDoc = async (id) => {
    await deleteDoc(doc(db, 'users', id));
};
