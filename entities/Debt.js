module.exports = {
    "name": "Debt",
    "type": "object",
    "properties": {
        "party_name": {
            "type": "string",
            "description": "Name of person/entity"
        },
        "party_type": {
            "type": "string",
            "enum": [
                "customer",
                "supplier",
                "employee",
                "other"
            ],
            "default": "customer"
        },
        "party_id": {
            "type": "string",
            "description": "Reference ID for Customer or Supplier entity"
        },
        "reference_invoice": {
            "type": "string",
            "description": "The Invoice ID linked to this debt (Sale or Purchase)"
        },
        "amount": {
            "type": "number",
            "description": "Total initial debt amount in EGP"
        },
        "paid_amount": {
            "type": "number",
            "default": 0,
            "description": "Total amount paid so far"
        },
        "remaining_amount": {
            "type": "number",
            "description": "Calculated field: amount - paid_amount"
        },
        "direction": {
            "type": "string",
            "enum": [
                "owed_to_us",
                "we_owe"
            ],
            "default": "owed_to_us",
            "description": "owed_to_us (Debit), we_owe (Credit)"
        },
        "due_date": {
            "type": "string",
            "format": "date"
        },
        "installments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "due_date": { "type": "string", "format": "date" },
                    "amount": { "type": "number" },
                    "is_paid": { "type": "boolean", "default": false }
                }
            },
            "description": "Optional: break debt into scheduled payments"
        },
        "status": {
            "type": "string",
            "enum": [
                "pending",
                "partial",
                "settled",
                "overdue"
            ],
            "default": "pending"
        },
        "priority": {
            "type": "string",
            "enum": ["low", "medium", "high", "urgent"],
            "default": "medium"
        },
        "description": {
            "type": "string",
            "description": "Reason for debt (e.g., Sale #INV-102)"
        },
        "notes": {
            "type": "string"
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
        "party_name",
        "party_id",
        "amount",
        "direction",
        "due_date"
    ]
};