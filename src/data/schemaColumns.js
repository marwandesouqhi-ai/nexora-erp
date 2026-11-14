/**
 * Column list of the tenant tables in the Supabase `public` schema, captured from
 * information_schema (table(col:type,...)). Used to split a Firestore-shaped
 * payload into real columns and the free-form `metadata` jsonb column.
 *
 * Regenerate when migrations add columns (see supabase/migrations).
 */
const SIGNATURE = `
accounts(id:uuid,company_id:uuid,legacy_firebase_id:text,account_name:text,account_type:text,balance:numeric,currency:text,account_number:text,is_active:boolean,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz,name:text,type:text)
activity_logs(id:uuid,company_id:uuid,legacy_firebase_id:text,user_id:uuid,legacy_firebase_uid:text,user_name:text,user_email:text,action:text,entity_type:text,details:text,ip_address:text,device:text,metadata:jsonb,created_at:tstz)
attendance(id:uuid,company_id:uuid,legacy_firebase_id:text,employee_id:text,employee_name:text,attendance_date:date,check_in:tstz,check_out:tstz,status:text,method:text,check_in_lat:numeric,check_in_lng:numeric,check_in_accuracy:numeric,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
cashflow(id:uuid,company_id:uuid,legacy_firebase_id:text,transaction_type:text,amount:numeric,source:text,balance_after:numeric,note:text,category:text,account_id:uuid,reference_id:text,reference_type:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
customers(id:uuid,company_id:uuid,legacy_firebase_id:text,name:text,customer_name:text,type:text,contact_person:text,phone:text,phone2:text,email:text,address:text,city:text,tax_number:text,credit_limit:numeric,balance:numeric,total_spent:numeric,customer_grade:text,is_blocked:boolean,status:text,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz,current_balance:numeric)
daily_reconciliations(id:uuid,company_id:uuid,legacy_firebase_id:text,reconciliation_date:date,rep_id:text,rep_name:text,total_sales:numeric,total_collected:numeric,expenses:numeric,net_cash:numeric,difference:numeric,status:text,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
dashboard_stats(id:uuid,company_id:uuid,legacy_firebase_id:text,stat_key:text,data:jsonb,snapshot_date:date,created_at:tstz,updated_at:tstz)
debts(id:uuid,company_id:uuid,legacy_firebase_id:text,party_id:text,party_name:text,party_type:text,source_type:text,source_id:text,invoice_number:text,amount:numeric,paid_amount:numeric,remaining_amount:numeric,direction:text,status:text,due_date:date,description:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
employees(id:uuid,company_id:uuid,legacy_firebase_id:text,name:text,email:text,phone:text,national_id:text,role:text,base_salary:numeric,commission_rate:numeric,allowances:numeric,current_balance:numeric,status:text,join_date:date,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
expenses(id:uuid,company_id:uuid,legacy_firebase_id:text,category:text,amount:numeric,expense_date:date,notes:text,receipt_url:text,status:text,employee_id:text,employee_name:text,account_id:uuid,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
field_expenses(id:uuid,company_id:uuid,legacy_firebase_id:text,employee_id:text,employee_name:text,category:text,amount:numeric,receipt_image_url:text,status:text,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
field_requests(id:uuid,company_id:uuid,legacy_firebase_id:text,employee_id:text,employee_name:text,type:text,title:text,details:text,priority:text,status:text,reviewed_by:text,reviewed_at:tstz,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
inventory_adjustments(id:uuid,company_id:uuid,legacy_firebase_id:text,adjustment_id:text,adjustment_type:text,status:text,adjusted_items:jsonb,total_loss_value:numeric,reason:text,location:text,performed_by:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
inventory_movements(id:uuid,company_id:uuid,legacy_firebase_id:text,product_id:text,product_name:text,quantity:numeric,direction:text,movement_type:text,reference_type:text,reference_id:text,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
manufacturing_orders(id:uuid,company_id:uuid,legacy_firebase_id:text,order_number:text,product_id:text,product_name:text,quantity:numeric,status:text,raw_materials:jsonb,start_date:date,due_date:date,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
notifications(id:uuid,company_id:uuid,legacy_firebase_id:text,type:text,title:text,message:text,severity:text,channel:text,recipient_type:text,recipient_id:text,metadata:jsonb,is_read:boolean,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz,body:text)
payroll_adjustments(id:uuid,company_id:uuid,legacy_firebase_id:text,employee_id:text,employee_name:text,type:text,title:text,amount:numeric,reason:text,adjustment_date:date,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz,status:text)
products(id:uuid,company_id:uuid,legacy_firebase_id:text,barcode:text,product_name:text,category:text,unit:text,current_stock:numeric,stock:numeric,min_stock_level:numeric,purchase_price:numeric,selling_price:numeric,wholesale_price:numeric,expiry_date:date,batch_number:text,supplier_id:text,supplier_name:text,supplier_company:text,description:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
profit_reports(id:uuid,company_id:uuid,legacy_firebase_id:text,period_type:text,period_label:text,start_date:date,end_date:date,total_sales:numeric,total_cost:numeric,total_expenses:numeric,net_profit:numeric,generated_by:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
purchases(id:uuid,company_id:uuid,legacy_firebase_id:text,invoice_no:text,supplier_id:uuid,supplier_legacy_id:text,supplier_name:text,items:jsonb,total_amount:numeric,paid_amount:numeric,remaining_amount:numeric,status:text,payment_method:text,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
receipts(id:uuid,company_id:uuid,legacy_firebase_id:text,receipt_number:text,customer_id:text,customer_name:text,amount:numeric,payment_method:text,account_id:text,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz,employee_id:text,employee_name:text,is_settled_to_safe:boolean,settlement_status:text,safe_account_id:uuid,settled_at:tstz)
returns(id:uuid,company_id:uuid,legacy_firebase_id:text,return_type:text,original_invoice_ref:text,refund_amount:numeric,party_id:text,party_name:text,items:jsonb,restocking_fees:numeric,refund_method:text,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
salary_payments(id:uuid,company_id:uuid,legacy_firebase_id:text,employee_id:text,employee_name:text,month_year:text,base_salary:numeric,commission_amount:numeric,allowances:numeric,bonus:numeric,deductions:numeric,tax_deducted:numeric,net_salary:numeric,status:text,payment_date:date,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
sales(id:uuid,company_id:uuid,legacy_firebase_id:text,invoice_number:text,customer_id:uuid,customer_legacy_id:text,customer_name:text,items:jsonb,total_amount:numeric,paid_amount:numeric,remaining_amount:numeric,payment_type:text,payment_status:text,account_id:uuid,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
settings(id:uuid,company_id:uuid,legacy_firebase_id:text,settings_key:text,business_name:text,logo_url:text,phone:text,address:text,currency:text,tax_rate:numeric,invoice_footer:text,invoice_template:jsonb,data:jsonb,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
suppliers(id:uuid,company_id:uuid,legacy_firebase_id:text,name:text,company:text,phone:text,whatsapp:text,email:text,address:text,category:text,balance:numeric,is_active:boolean,notes:text,metadata:jsonb,created_by_user:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz,current_balance:numeric,total_purchases_value:numeric)
van_inventory(id:uuid,company_id:uuid,legacy_firebase_id:text,van_id:text,rep_id:text,rep_name:text,items:jsonb,last_audit_date:tstz,notes:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
profiles(id:uuid,company_id:uuid,name:text,email:text,phone:text,avatar_url:text,role:erp_role,permission_overrides:jsonb,status:text,is_active:boolean,created_at:tstz,updated_at:tstz)
visits(id:uuid,company_id:uuid,legacy_firebase_id:text,employee_id:text,employee_name:text,customer_id:text,customer_name:text,customer_address:text,visit_date:date,latitude:numeric,longitude:numeric,start_time:tstz,end_time:tstz,notes:text,status:text,metadata:jsonb,created_by:uuid,legacy_firebase_uid:text,created_at:tstz,updated_at:tstz)
`;

/** @type {Record<string, Record<string, string>>} table -> { column: type } */
export const TABLE_COLUMNS = Object.fromEntries(
    SIGNATURE.trim()
        .split('\n')
        .map((line) => {
            const open = line.indexOf('(');
            const table = line.slice(0, open);
            const cols = Object.fromEntries(
                line.slice(open + 1, -1).split(',').map((c) => c.split(':'))
            );
            return [table, cols];
        })
);

/** Firestore collection name -> Supabase table name, where they differ. */
export const TABLE_ALIASES = {
    production_orders: 'manufacturing_orders',
    users: 'profiles', // Firestore users/{uid} -> public.profiles
};

export const resolveTable = (collectionName) => TABLE_ALIASES[collectionName] || collectionName;
