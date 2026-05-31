export default {
    name: "Supplier",
    type: "object",
    properties: {
        name: {
            type: "string",
            description: "Primary contact name"
        },
        company: {
            type: "string",
            description: "Official company name (Legal Entity)"
        },
        category: {
            type: "string",
            enum: ["manufacturer", "distributor", "wholesaler", "service_provider"],
            description: "Type of supplier"
        },
        phone: {
            type: "string"
        },
        whatsapp: {
            type: "string",
            description: "For automated order notifications"
        },
        email: {
            type: "string"
        },
        address: {
            type: "string"
        },
        city: {
            type: "string"
        },
        tax_id: {
            type: "string",
            description: "Tax Registration Number (الرقم الضريبي)"
        },
        current_balance: {
            type: "number",
            default: 0,
            description: "Outstanding balance we owe (positive = we owe them)"
        },
        total_purchases_value: {
            type: "number",
            default: 0,
            description: "Cumulative value of all purchases"
        },
        payment_terms: {
            type: "string",
            description: "e.g., Net 30, Cash on Delivery, etc."
        },
        is_active: {
            type: "boolean",
            default: true
        },
        notes: {
            type: "string"
        },
        created_at: {
            type: "string",
            format: "date-time"
        },
        updated_at: {
            type: "string",
            format: "date-time"
        }
    },
    required: [
        "name",
        "company",
        "phone"
    ]
};