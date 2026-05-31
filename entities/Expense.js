export default {
    name: "Expense",
    type: "object",
    properties: {
        title: {
            type: "string",
            description: "Short name for the expense"
        },
        category: {
            type: "string",
            enum: [
                "rent",
                "utilities",
                "salaries",
                "marketing",
                "maintenance",
                "office_supplies",
                "transportation",
                "taxes_and_fees",
                "purchases",
                "other"
            ],
            default: "other"
        },
        amount: {
            type: "number",
            description: "Total amount spent in EGP"
        },
        payment_method: {
            type: "string",
            enum: ["cash", "bank_transfer", "check", "credit_card", "instapay"],
            default: "cash"
        },
        reference_number: {
            type: "string",
            description: "Receipt or transaction number"
        },
        recorded_by: {
            type: "string",
            description: "Email of the employee who added this"
        },
        date: {
            type: "string",
            format: "date"
        },
        attachment_url: {
            type: "string",
            description: "Link to a photo of the receipt in Firebase Storage"
        },
        is_recurring: {
            type: "boolean",
            default: false,
            description: "Is this a monthly expense (like rent)?"
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
        "title",
        "category",
        "amount",
        "payment_method",
        "date"
    ]
};