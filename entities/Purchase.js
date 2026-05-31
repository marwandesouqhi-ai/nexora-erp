export default {
    "name": "Purchase",
    "type": "object",
    "properties": {
        "invoice_number": {
            "type": "string",
            "description": "Supplier's invoice reference number"
        },
        "internal_id": {
            "type": "string",
            "description": "Auto-generated ID for internal tracking"
        },
        "supplier_id": {
            "type": "string",
            "description": "Link to Supplier entity"
        },
        "supplier_name": {
            "type": "string"
        },
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "string"
                    },
                    "product_name": {
                        "type": "string"
                    },
                    "quantity": {
                        "type": "number"
                    },
                    "unit": {
                        "type": "string",
                        "description": "e.g., box, piece, vial"
                    },
                    "cost": {
                        "type": "number",
                        "description": "Cost per unit in this batch"
                    },
                    "expiry_date": {
                        "type": "string",
                        "format": "date"
                    },
                    "batch_number": {
                        "type": "string"
                    },
                    "total": {
                        "type": "number"
                    }
                },
                "required": ["product_id", "quantity", "cost"]
            }
        },
        "subtotal": {
            "type": "number"
        },
        "tax_amount": {
            "type": "number",
            "default": 0
        },
        "discount": {
            "type": "number",
            "default": 0
        },
        "total": {
            "type": "number"
        },
        "payment_method": {
            "type": "string",
            "enum": [
                "cash",
                "bank_transfer",
                "check",
                "credit",
                "instapay"
            ],
            "default": "cash"
        },
        "payment_status": {
            "type": "string",
            "enum": [
                "paid",
                "partial",
                "unpaid"
            ],
            "default": "paid"
        },
        "paid_amount": {
            "type": "number",
            "default": 0
        },
        "remaining_balance": {
            "type": "number",
            "description": "Automatically calculated: total - paid_amount"
        },
        "warehouse_location": {
            "type": "string",
            "description": "Which warehouse or shelf received this"
        },
        "status": {
            "type": "string",
            "enum": ["ordered", "received", "cancelled"],
            "default": "received"
        },
        "due_date": {
            "type": "string",
            "format": "date",
            "description": "Date to pay the supplier if credit"
        },
        "received_date": {
            "type": "string",
            "format": "date"
        },
        "recorded_by": {
            "type": "string",
            "description": "Employee email who created the record"
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
        "supplier_id",
        "items",
        "total",
        "status",
        "received_date"
    ]
};