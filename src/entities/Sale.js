module.exports = {
    "name": "Sale",
    "type": "object",
    "properties": {
        "invoice_number": {
            "type": "string",
            "description": "Unique invoice identifier"
        },
        "customer_id": {
            "type": "string",
            "description": "Reference to the Customer entity"
        },
        "customer_name": {
            "type": "string",
            "description": "Customer display name"
        },
        "customer_type": {
            "type": "string",
            "description": "Customer segment or classification"
        },
        "customer_phone": {
            "type": "string",
            "description": "Customer contact number"
        },
        "sales_rep_id": {
            "type": "string",
            "description": "ID of the employee who processed the sale"
        },
        "sales_rep_name": {
            "type": "string",
            "description": "Sales representative name"
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
                    "unit": {
                        "type": "string",
                        "description": "Unit of measure (piece, box, vial, etc.)"
                    },
                    "quantity": {
                        "type": "number"
                    },
                    "price": {
                        "type": "number",
                        "description": "Sale price per unit"
                    },
                    "cost_price": {
                        "type": "number",
                        "description": "Cost per unit at time of sale"
                    },
                    "discount": {
                        "type": "number",
                        "default": 0,
                        "description": "Per-item discount amount"
                    },
                    "total": {
                        "type": "number",
                        "description": "Line total after discount"
                    }
                },
                "required": ["product_id", "quantity", "price", "total"]
            }
        },
        "subtotal": {
            "type": "number",
            "description": "Total before tax and discounts"
        },
        "total_discount": {
            "type": "number",
            "default": 0,
            "description": "Total discount applied to the invoice"
        },
        "tax_amount": {
            "type": "number",
            "default": 0,
            "description": "VAT or sales tax amount"
        },
        "total_amount": {
            "type": "number",
            "description": "Final invoice amount"
        },
        "total_cost": {
            "type": "number",
            "default": 0,
            "description": "Total cost of goods sold for the invoice"
        },
        "profit_margin": {
            "type": "number",
            "description": "Calculated profit: total_amount - total_cost"
        },
        "payment_type": {
            "type": "string",
            "enum": ["cash", "bank_transfer", "check", "credit", "instapay"],
            "default": "cash",
            "description": "How the invoice is paid"
        },
        "payment_status": {
            "type": "string",
            "enum": ["paid", "partial", "unpaid", "refunded"],
            "default": "paid"
        },
        "paid_amount": {
            "type": "number",
            "default": 0
        },
        "remaining_amount": {
            "type": "number",
            "description": "Amount still due after payments"
        },
        "delivery_status": {
            "type": "string",
            "enum": ["pending", "shipped", "delivered", "returned"],
            "default": "pending"
        },
        "due_date": {
            "type": "string",
            "format": "date",
            "description": "Payment due date for credit sales"
        },
        "delivery_address": {
            "type": "string"
        },
        "notes": {
            "type": "string"
        },
        "status": {
            "type": "string",
            "enum": ["confirmed", "draft", "cancelled", "returned"],
            "default": "confirmed"
        },
        "created_by": {
            "type": "string",
            "description": "User ID or email who recorded the sale"
        },
        "updated_by": {
            "type": "string",
            "description": "Last editor of the sale record"
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
        "customer_id",
        "items",
        "total_amount",
        "payment_status",
        "status"
    ]
};