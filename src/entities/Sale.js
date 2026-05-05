module.exports = {
    "name": "Sale",
    "type": "object",
    "properties": {
        "invoice_number": {
            "type": "string",
            "description": "Unique Invoice ID (e.g., NEX-2026-0001)"
        },
        "customer_id": {
            "type": "string",
            "description": "Reference to Customer entity"
        },
        "customer_name": {
            "type": "string"
        },
        "customer_type": {
            "type": "string"
        },
        "sales_rep_id": {
            "type": "string",
            "description": "Employee ID of the sales representative"
        },
        "sales_rep_name": {
            "type": "string"
        },
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "product_id": { "type": "string" },
                    "product_name": { "type": "string" },
                    "unit": { "type": "string" },
                    "quantity": { "type": "number" },
                    "price": { "type": "number", "description": "Unit selling price" },
                    "cost_at_sale": { "type": "number", "description": "Product cost at time of sale for profit calculation" },
                    "discount_per_unit": { "type": "number", "default": 0 },
                    "total": { "type": "number" }
                },
                "required": ["product_id", "quantity", "price", "total"]
            }
        },
        "subtotal": {
            "type": "number"
        },
        "total_discount": {
            "type": "number",
            "default": 0
        },
        "tax_amount": {
            "type": "number",
            "default": 0,
            "description": "VAT (14% typical in Egypt)"
        },
        "total": {
            "type": "number",
            "description": "Final amount to be paid"
        },
        "profit_margin": {
            "type": "number",
            "description": "Calculated: total - total_cost"
        },
        "payment_method": {
            "type": "string",
            "enum": ["cash", "bank_transfer", "check", "credit", "instapay"],
            "default": "cash"
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
        "remaining_balance": {
            "type": "number",
            "description": "Automatically calculated: total - paid_amount"
        },
        "delivery_status": {
            "type": "string",
            "enum": ["pending", "shipped", "delivered", "returned"],
            "default": "delivered"
        },
        "due_date": {
            "type": "string",
            "format": "date",
            "description": "Crucial for credit sales"
        },
        "notes": {
            "type": "string"
        },
        "status": {
            "type": "string",
            "enum": ["confirmed", "draft", "cancelled", "returned"],
            "default": "confirmed"
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
        "sales_rep_id",
        "items",
        "total",
        "payment_status",
        "status"
    ]
}