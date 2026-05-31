export default {
    name: "SalaryPayment",
    type: "object",
    properties: {
        payment_id: {
            type: "string",
            description: "Unique transaction ID for the salary slip"
        },
        employee_id: {
            type: "string",
            description: "Link to Employee entity"
        },
        employee_name: {
            type: "string"
        },
        month_year: {
            type: "string",
            description: "Format: YYYY-MM (e.g., 2026-05)"
        },
        base_salary: {
            type: "number",
            description: "Base salary at the time of payment"
        },
        commission_amount: {
            type: "number",
            default: 0,
            description: "Total commission earned from sales in this month"
        },
        allowances: {
            type: "number",
            default: 0,
            description: "Total fixed and variable allowances"
        },
        bonus: {
            type: "number",
            default: 0,
            description: "Extra rewards or incentives"
        },
        deductions: {
            type: "number",
            default: 0,
            description: "Total deductions (Absence, penalties, or loan repayments)"
        },
        tax_deducted: {
            type: "number",
            default: 0,
            description: "Income tax or insurance deductions"
        },
        net_salary: {
            type: "number",
            description: "Calculated: (base + commission + allowances + bonus) - (deductions + tax)"
        },
        payment_method: {
            type: "string",
            enum: ["cash", "bank_transfer", "instapay", "check"],
            default: "cash"
        },
        payment_status: {
            type: "string",
            enum: ["pending", "paid", "cancelled"],
            default: "pending"
        },
        payment_date: {
            type: "string",
            format: "date-time"
        },
        approved_by: {
            type: "string",
            description: "Admin or Manager email who approved the payment"
        },
        notes: {
            type: "string"
        },
        created_at: {
            type: "string",
            format: "date-time"
        }
    },
    required: [
        "employee_id",
        "month_year",
        "base_salary",
        "net_salary",
        "payment_status"
    ]
};