import { callFunction } from '@/api/functions';

const call = (name, payload) => callFunction(name, payload);

export const createInvitation = (payload) => call('createInvitation', payload);
export const verifyInvitation = (token) => call('verifyInvitation', { token });
export const acceptInvitation = (token, password) => call('acceptInvitation', { token, password });
export const listManagedInvitations = (companyId) => call('listManagedInvitations', { company_id: companyId });
export const resendInvitation = (id) => call('resendInvitation', { id });
export const revokeInvitation = (id) => call('revokeInvitation', { id });
export const updateManagedUserSecure = (payload) => call('updateManagedUserSecure', payload);
