import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Filter, Users, Building2 } from 'lucide-react';
import { PageHero } from '../components/page';
import { getCompanies, deleteCompany } from '../services/companiesService';
import type { Company } from '../types';
import { CreateCompanyModal } from '../components/CreateCompanyModal';
import { EditCompanyModal } from '../components/EditCompanyModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useAuth } from '../contexts/AuthContext';

export function Customers() {
  const { userRole } = useAuth();
  const canManageCompanies = userRole === 'platform_admin';
  const canDelete = canManageCompanies;
  const canAdd = canManageCompanies;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState<Company | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCompanyForDelete, setSelectedCompanyForDelete] = useState<Company | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to fetch companies', error);
    } finally {
      setLoading(false);
    }
  }

  const handleEditClick = (company: Company) => {
    setSelectedCompanyForEdit(company);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (company: Company) => {
    if (!canDelete) return;
    setSelectedCompanyForDelete(company);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCompanyForDelete?.id || !canDelete) return;
    try {
      await deleteCompany(selectedCompanyForDelete.id);
      setIsDeleteModalOpen(false);
      setSelectedCompanyForDelete(null);
      fetchData(); // Refresh list
    } catch (error) {
      console.error('Failed to delete company', error);
      alert('فشل حذف العميل');
    }
  };

  return (
    <div>
      <div>
        
        {/* Header Section */}
        <PageHero
          icon={Building2}
          tone="emerald"
          title="العملاء والشركات"
          subtitle="إدارة شاملة لجميع الشركات المسجلة وحساباتها بكل سهولة وسرعة."
          actions={
            <>
              <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 border border-border bg-card text-foreground hover:bg-card-muted">
                <Filter className="h-4 w-4 text-muted-foreground" />
                تصفية
              </button>
              {canAdd && (
                <button onClick={() => setIsCreateModalOpen(true)} type="button" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary-hover">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  إضافة شركة
                </button>
              )}
            </>
          }
        />

        {/* Table Card */}
        <div className="premium-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
          
          {/* Table Toolbar */}
          <div className="p-5 border-b border-border flex items-center justify-between bg-card-muted/50">
            <div className="relative max-w-sm w-full">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input 
                type="text"
                className="block w-full rounded-lg border-0 py-2 pr-10 pl-4 text-foreground ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                placeholder="ابحث عن شركة..."
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-card-muted/50">
                <tr>
                  <th scope="col" className="py-4 pl-4 pr-6 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    الشركة
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    البريد الإلكتروني
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    الحالة
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    تاريخ الانضمام
                  </th>
                  <th scope="col" className="relative py-4 pl-6 pr-4 text-left">
                    <span className="sr-only">إجراءات</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary mb-4"></div>
                        <span className="text-muted-foreground font-medium text-sm">جاري جلب البيانات...</span>
                      </div>
                    </td>
                  </tr>
                ) : companies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="text-muted-foreground mb-2"><Users className="h-12 w-12 mx-auto opacity-20" /></div>
                      <span className="text-muted-foreground font-medium text-sm">لا يوجد عملاء حالياً. أضف شركتك الأولى!</span>
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => (
                    <tr key={company.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                      <td className="whitespace-nowrap py-4 pl-4 pr-6">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-primary font-bold shadow-sm border border-white">
                            {company.name?.charAt(0).toUpperCase() || 'C'}
                          </div>
                          <div className="mr-4">
                            <div className="font-semibold text-foreground">{company.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">ID: {company.id?.substring(0,8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-secondary-text font-medium">{company.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                          company.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-rose-50 text-rose-700 ring-rose-600/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ml-1.5 ${company.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {company.status === 'active' ? 'نشط' : 'معلق'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                        {company.created_at ? new Date(company.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-6 pr-4 text-left text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {canManageCompanies && <button 
                            onClick={() => handleEditClick(company)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">تعديل {company.name}</span>
                          </button>}
                          {canDelete && (
                            <button 
                              onClick={() => handleDeleteClick(company)}
                              className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">حذف {company.name}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer (Visual) */}
          <div className="bg-card-muted/50 px-6 py-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">يعرض {companies.length} شركات</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-md text-sm font-medium text-muted-foreground bg-card border border-border cursor-not-allowed">السابق</button>
              <button className="px-3 py-1 rounded-md text-sm font-medium text-secondary-text bg-card border border-border hover:bg-card-muted">التالي</button>
            </div>
          </div>

        </div>
      </div>

      <CreateCompanyModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onCompanyCreated={fetchData} 
      />

      {selectedCompanyForEdit && (
        <EditCompanyModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCompanyForEdit(null);
          }}
          company={selectedCompanyForEdit}
          onCompanyUpdated={fetchData}
        />
      )}

      {selectedCompanyForDelete && (
        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedCompanyForDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          companyName={selectedCompanyForDelete.name || ''}
        />
      )}

    </div>
  );
}
