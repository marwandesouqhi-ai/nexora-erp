import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, addUser, updateUser, deleteUserDoc } from '@/firebase/collections/users';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, UserCog, Lock, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const roleLabels = { admin: 'Administrator', manager: 'Manager', accountant: 'Accountant', sales: 'Sales' };
const roleColors = { admin: 'bg-rose-500/10 text-rose-600', manager: 'bg-indigo-500/10 text-indigo-600', accountant: 'bg-amber-500/10 text-amber-600', sales: 'bg-emerald-500/10 text-emerald-600' };
const statusLabels = { active: 'Active', inactive: 'Inactive' };
const statusColors = { active: 'bg-emerald-500/10 text-emerald-600', inactive: 'bg-red-500/10 text-red-600' };
const emptyForm = { name: '', email: '', phone: '', role: 'sales', status: 'active', password: '' };

export default function Users() {
    const { can } = useRole();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [showDialog, setShowDialog] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editUser, setEditUser] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [searchText, setSearchText] = useState('');

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: getUsers,
    });

    const createUserMutation = useMutation({
        mutationFn: addUser,
        onSuccess: async (_, variables) => {
            qc.invalidateQueries(['users']);
            await logActivity({
                user: currentUser?.uid || currentUser?.email || 'system',
                action: 'create_user',
                entity_type: 'User',
                details: 'Created user: ' + variables.name + ' (' + (roleLabels[variables.role] || variables.role) + ')',
            });
            toast({ title: 'User created successfully' });
            setShowDialog(false);
            setForm(emptyForm);
        },
    });

    const updateUserMutation = useMutation({
        mutationFn: ({ id, data }) => updateUser(id, data),
        onSuccess: async (_, variables) => {
            qc.invalidateQueries(['users']);
            await logActivity({
                user: currentUser?.uid || currentUser?.email || 'system',
                action: 'update_user',
                entity_type: 'User',
                details: 'Updated user: ' + variables.data.email + ' (' + (roleLabels[variables.data.role] || variables.data.role) + ')',
            });
            toast({ title: 'User updated successfully' });
            setEditUser(null);
            setShowDialog(false);
            setForm(emptyForm);
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: deleteUserDoc,
        onSuccess: async (_, userId) => {
            qc.invalidateQueries(['users']);
            await logActivity({
                user: currentUser?.uid || currentUser?.email || 'system',
                action: 'delete_user',
                entity_type: 'User',
                details: 'Deleted user: ' + userId,
            });
            toast({ title: 'User deleted successfully' });
            setDeleteId(null);
        },
    });

    if (!can('can_manage_users')) {
        return <div className="p-20 text-center font-bold text-slate-400">You do not have permission to manage users.</div>;
    }

    const visibleUsers = users.filter((u) =>
        (u.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchText.toLowerCase())
    );

    const openNewUserDialog = () => {
        setForm(emptyForm);
        setEditUser(null);
        setShowDialog(true);
    };

    const openEditUserDialog = (user) => {
        setEditUser(user);
        setForm({
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            role: user.role || 'sales',
            status: user.status || 'active',
            password: '',
        });
        setShowDialog(true);
    };

    const closeDialog = () => {
        setShowDialog(false);
        setEditUser(null);
        setForm(emptyForm);
    };

    const isSubmitting = editUser ? updateUserMutation.isLoading : createUserMutation.isLoading;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Users</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage users stored in Firestore.</p>
                </div>
                <Button onClick={openNewUserDialog} className="rounded-xl bg-slate-900 hover:bg-slate-800 gap-2 shadow-lg">
                    <UserPlus className="w-4 h-4" /> New user
                </Button>
            </div>

            <div className="erp-card">
                <div className="p-4 border-b border-border">
                    <div className="relative max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="pr-10"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-muted-foreground">
                                <th className="text-right font-semibold px-5 py-3">Name</th>
                                <th className="text-right font-semibold px-4 py-3">Email</th>
                                <th className="text-right font-semibold px-4 py-3">Role</th>
                                <th className="text-right font-semibold px-4 py-3">Status</th>
                                <th className="text-right font-semibold px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : visibleUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                visibleUsers.map((u) => (
                                    <tr key={u.id} className="erp-table-row">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                                                    <span className="text-primary text-xs font-black">{(u.name || u.email || 'U').charAt(0).toUpperCase()}</span>
                                                </div>
                                                <span className="font-semibold">{u.name || 'No name'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                                        <td className="px-4 py-3">
                                            <Badge className={`px-2 py-1 rounded-full font-semibold ${roleColors[u.role] || 'bg-muted text-muted-foreground'}`}>
                                                {roleLabels[u.role] || u.role || 'User'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={`px-2 py-1 rounded-full font-semibold ${statusColors[u.status] || 'bg-muted text-muted-foreground'}`}>
                                                {statusLabels[u.status] || u.status || 'Unknown'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 justify-end">
                                                {currentUser?.email !== u.email && (
                                                    <>
                                                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => openEditUserDialog(u)}>
                                                            <UserCog className="w-3 h-3 mr-1" /> Edit
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="text-xs text-rose-500" onClick={() => setDeleteId(u.id)}>
                                                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog(); }}>
                <DialogContent className="rounded-[2.5rem] max-w-lg p-8">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black flex items-center gap-2">
                            <UserPlus className="text-indigo-600" /> {editUser ? 'Edit user' : 'Add user'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-6">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-black text-slate-500">Name</label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-2xl h-12" placeholder="Full name" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500">Email</label>
                            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-2xl h-12" placeholder="email@example.com" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500">Phone</label>
                            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-2xl h-12" placeholder="0100xxxxxxx" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500">Password</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-3.5 w-4 h-4 text-slate-300" />
                                <Input
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="rounded-2xl h-12 pr-10"
                                    placeholder={editUser ? 'Leave blank to keep current password' : 'Temporary password'}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500">Role</label>
                            <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                                <SelectTrigger className="rounded-2xl h-12"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(roleLabels).map(([val, lbl]) => (
                                        <SelectItem key={val} value={val}>{lbl}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500">Status</label>
                            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                                <SelectTrigger className="rounded-2xl h-12"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-14 rounded-2xl font-black text-lg shadow-lg shadow-indigo-100"
                            onClick={() => {
                                const payload = {
                                    name: form.name.trim(),
                                    email: form.email.trim(),
                                    phone: form.phone.trim(),
                                    role: form.role,
                                    status: form.status,
                                };
                                if (form.password) payload.password = form.password;

                                if (editUser) {
                                    updateUserMutation.mutate({ id: editUser.id, data: payload });
                                } else {
                                    createUserMutation.mutate(payload);
                                }
                            }}
                            disabled={isSubmitting || !form.email || !form.name}
                        >
                            {isSubmitting ? 'Saving...' : editUser ? 'Update user' : 'Create user'}
                        </Button>
                        <Button variant="ghost" onClick={closeDialog} className="h-14 rounded-2xl px-6 italic">Cancel</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent className="rounded-[2rem] max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black text-xl">Confirm delete</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to remove this user? This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteUserMutation.mutate(deleteId)} className="bg-rose-600 hover:bg-rose-700 rounded-xl font-bold px-8">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
