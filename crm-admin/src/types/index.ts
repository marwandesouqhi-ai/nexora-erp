export interface Company {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  subscription?: {
    plan?: string;
    startDate?: string | any;
    endDate?: string | any;
    amount?: number;
    billing_status?: 'paid' | 'pending' | 'overdue';
    start_date?: string | any;
    next_billing_date?: string | any;
  };
  status?: 'active' | 'inactive' | 'suspended';
  suspended_reason?: string;
  /** رقم واتساب إدارة الشركة بصيغة دولية أرقام فقط (مثال: 201012345678) */
  admin_whatsapp?: string;
  created_at?: string | any;
}

export interface AuditLog {
  id?: string;
  action: string;
  userEmail: string;
  target?: string;
  details?: string;
  timestamp: string | any;
}

// CRM accounts are platform staff. They are deliberately separate from the
// ERP `users` collection and its organisation roles.
export type UserRole = 'platform_admin' | 'billing_admin' | 'support_agent';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'suspended';
  created_at?: string | any;
}

export interface Invoice {
  id: string;
  companyId: string;
  companyName: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  dueDate: string | any;
  created_at: string | any;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string; // email of team member
  status: 'pending' | 'in_progress' | 'completed';
  deadline?: string | any;
  created_at: string | any;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  targetRole?: UserRole | 'all';
  targetUser?: string; // email
  read: boolean;
  created_at: string | any;
}

// ─── Support tickets (مشتركة مع Nexora ERP) ────────────────────────────────
export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TicketActor {
  uid: string;
  name: string;
  email: string;
}

export interface SupportTicket {
  id: string;
  company_id: string;
  company_name?: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_by: TicketActor;
  assigned_to: string | null;
  created_at: any;
  updated_at?: any;
  last_message_at?: any;
  last_message_preview?: string;
  last_message_by?: 'customer' | 'staff';
  unread_for_staff?: boolean;
  unread_for_customer?: boolean;
  message_count?: number;
}

export interface TicketAttachment {
  name: string;
  url: string;
  path: string;
  content_type: string;
  size: number;
}

export interface TicketMessage {
  id: string;
  company_id: string;
  body: string;
  author: TicketActor;
  author_side: 'customer' | 'staff';
  internal: boolean;
  attachments?: TicketAttachment[];
  created_at: any;
}
