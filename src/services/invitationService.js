import { httpsCallable } from 'firebase/functions';
import { functions } from '@/api/firebase';

const call = (name, payload) => httpsCallable(functions, name)(payload).then((result) => result.data);

export const createInvitation = (payload) => call('createInvitation', payload);
export const verifyInvitation = (token) => call('verifyInvitation', { token });
export const acceptInvitation = (token, password) => call('acceptInvitation', { token, password });
export const listManagedInvitations = (companyId) => call('listManagedInvitations', { company_id: companyId });
export const resendInvitation = (id) => call('resendInvitation', { id });
export const revokeInvitation = (id) => call('revokeInvitation', { id });
export const updateManagedUserSecure = (payload) => call('updateManagedUserSecure', payload);
