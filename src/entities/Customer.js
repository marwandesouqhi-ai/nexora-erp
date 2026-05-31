export default {
    "name": "Customer",
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Customer / company name"
        },
        "type": {
            "type": "string",
            "enum": [
                "pharmacy",
                "clinic",
                "distributor",
                "doctor",
                "other",
                "farm"
            ],
            "default": "pharmacy",
            "description": "Customer type"
        },
        "contact_person": {
            "type": "string"
        },
        "phone": {
            "type": "string"
        },
        "phone2": {
            "type": "string"
        },
        "email": {
            "type": "string"
        },
        "address": {
            "type": "string"
        },
        "city": {
            "type": "string"
        },
        "governorate": {
            "type": "string",
            "description": "The governorate in Egypt (e.g., Ash Sharqia, Cairo)"
        },
        "tax_number": {
            "type": "string"
        },
        "credit_limit": {
            "type": "number",
            "default": 0,
            "description": "Max debt allowed for this customer"
        },
        "balance": {
            "type": "number",
            "default": 0,
            "description": "Outstanding balance (positive = owes us, negative = credit)"
        },
        "total_purchases_count": {
            "type": "number",
            "default": 0,
            "description": "Total number of invoices"
        },
        "total_spent_amount": {
            "type": "number",
            "default": 0,
            "description": "Total money paid by this customer"
        },
        "assigned_rep": {
            "type": "string",
            "description": "Sales rep email or ID"
        },
        "last_order_date": {
            "type": "string",
            "format": "date-time"
        },
        "notes": {
            "type": "string"
        },
        "status": {
            "type": "string",
            "enum": [
                "active",
                "inactive",
                "blocked"
            ],
            "default": "active"
        },
        "created_at": {
            "type": "string",
            "format": "date-time"
        }
    },
    "required": [
        "name",
        "type",
        "phone"
    ]
}