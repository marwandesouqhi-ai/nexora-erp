export default {
    "name": "Supplier",
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Supplier or company name"
        },
        "company": {
            "type": "string",
            "description": "Company or branch name"
        },
        "supplier_code": {
            "type": "string",
            "description": "Internal supplier reference code"
        },
        "category": {
            "type": "string",
            "enum": ["pharmaceuticals", "equipment", "consumables", "medical", "general"],
            "default": "general",
            "description": "Supplier category for reporting"
        },
        "phone": {
            "type": "string",
            "description": "Primary contact phone number"
        },
        "whatsapp": {
            "type": "string",
            "description": "WhatsApp or secondary contact number"
        },
        "email": {
            "type": "string",
            "format": "email",
            "description": "Supplier email address"
        },
        "address": {
            "type": "string",
            "description": "Postal or warehouse address"
        },
        "city": {
            "type": "string"
        },
        "governorate": {
            "type": "string",
            "description": "Egyptian governorate for the supplier location"
        },
        "tax_number": {
            "type": "string",
            "description": "Tax registration number"
        },
        "payment_terms": {
            "type": "string",
            "description": "Payment terms, e.g. 30 days"
        },
        "current_balance": {
            "type": "number",
            "default": 0,
            "description": "Supplier balance due (positive means we owe them)"
        },
        "total_purchases_value": {
            "type": "number",
            "default": 0,
            "description": "Accumulated purchase volume from this supplier"
        },
        "last_transaction_date": {
            "type": "string",
            "format": "date-time",
            "description": "Date of the most recent purchase or settlement"
        },
        "assigned_rep": {
            "type": "string",
            "description": "Sales or procurement representative assigned to this supplier"
        },
        "status": {
            "type": "string",
            "enum": ["active", "inactive", "suspended"],
            "default": "active"
        },
        "is_active": {
            "type": "boolean",
            "default": true
        },
        "notes": {
            "type": "string",
            "description": "Additional supplier notes"
        },
        "created_at": {
            "type": "string",
            "format": "date-time"
        },
        "updated_at": {
            "type": "string",
            "format": "date-time"
        }
    },
    "required": [
        "name",
        "phone"
    ]
};