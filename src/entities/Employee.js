export default {
    "name": "Employee",
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Employee full name"
        },
        "email": {
            "type": "string",
            "description": "Used for system login and notifications"
        },
        "role": {
            "type": "string",
            "enum": ["admin", "manager", "sales_rep", "accountant", "warehouse_keeper"],
            "description": "Job title and system permission level"
        },
        "phone": {
            "type": "string"
        },
        "national_id": {
            "type": "string",
            "description": "Egyptian National ID (14 digits)"
        },
        "base_salary": {
            "type": "number",
            "description": "Base monthly salary in EGP"
        },
        "commission_rate": {
            "type": "number",
            "default": 0,
            "description": "Percentage earned on sales (for sales_rep)"
        },
        "allowances": {
            "type": "number",
            "default": 0,
            "description": "Fixed monthly allowances (e.g., transportation)"
        },
        "current_balance": {
            "type": "number",
            "default": 0,
            "description": "Employee's current financial balance (positive = owed to them, negative = debt/loan)"
        },
        "status": {
            "type": "string",
            "enum": [
                "active",
                "on_leave",
                "terminated"
            ],
            "default": "active"
        },
        "join_date": {
            "type": "string",
            "format": "date"
        },
        "resignation_date": {
            "type": "string",
            "format": "date"
        },
        "emergency_contact": {
            "type": "string",
            "description": "Name and phone of someone to call in emergency"
        },
        "bank_account": {
            "type": "string",
            "description": "IBAN or InstaPay address for salary transfer"
        },
        "notes": {
            "type": "string"
        },
        "created_at": {
            "type": "string",
            "format": "date-time"
        }
    },
    "required": [
        "name",
        "email",
        "role",
        "base_salary",
        "join_date"
    ]
}