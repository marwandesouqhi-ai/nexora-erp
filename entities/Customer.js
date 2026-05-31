export default {
    "name": "Customer",
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Customer or company name"
        },
        "type": {
            "type": "string",
            "enum": [
                "pharmacy",
                "clinic",
                "distributor",
                "doctor",
                "farm",
                "other"
            ],
            "default": "pharmacy",
            "description": "Customer type or segment"
        },
        "contact_person": {
            "type": "string",
            "description": "Primary contact person"
        },
        "phone": {
            "type": "string",
            "description": "Primary phone number"
        },
        "phone2": {
            "type": "string",
            "description": "Secondary phone or WhatsApp number"
        },
        "email": {
            "type": "string",
            "format": "email",
            "description": "Customer email address"
        },
        "address": {
            "type": "string",
            "description": "Street address or delivery address"
        },
        "city": {
            "type": "string",
            "description": "City or district"
        },
        "governorate": {
            "type": "string",
            "description": "Egyptian governorate"
        },
        "tax_number": {
            "type": "string",
            "description": "Tax registration number"
        },
        "credit_limit": {
            "type": "number",
            "default": 0,
            "description": "Maximum allowed outstanding credit"
        },
        "balance": {
            "type": "number",
            "default": 0,
            "description": "Outstanding balance (positive = customer owes us, negative = customer credit)"
        },
        "total_purchases_count": {
            "type": "number",
            "default": 0,
            "description": "Total number of purchases or invoices"
        },
        "total_spent_amount": {
            "type": "number",
            "default": 0,
            "description": "Total amount spent by the customer"
        },
        "assigned_rep": {
            "type": "string",
            "description": "Sales representative responsible for this customer"
        },
        "last_order_date": {
            "type": "string",
            "format": "date-time",
            "description": "Date of the last recorded sale"
        },
        "status": {
            "type": "string",
            "enum": ["active", "inactive", "blocked"],
            "default": "active",
            "description": "Customer account status"
        },
        "notes": {
            "type": "string",
            "description": "Optional notes or customer remarks"
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
        "type",
        "phone"
    ]
};