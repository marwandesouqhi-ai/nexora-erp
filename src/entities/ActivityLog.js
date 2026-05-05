module.exports = {
    "name": "ActivityLog",
    "type": "object",
    "properties": {
        "user_email": {
            "type": "string"
        },
        "user_name": {
            "type": "string"
        },
        "action": {
            "type": "string",
            "description": "e.g. create_sale, delete_product, update_stock"
        },
        "module": {
            "type": "string",
            "description": "The system section: sales, inventory, accounting, employees"
        },
        "entity_type": {
            "type": "string",
            "description": "e.g. Sale, Product, Customer"
        },
        "entity_id": {
            "type": "string"
        },
        "details": {
            "type": "string",
            "description": "Human readable description of the change"
        },
        "ip_address": {
            "type": "string"
        },
        "timestamp": {
            "type": "string",
            "format": "date-time",
            "description": "Server-side timestamp for accurate tracking"
        }
    },
    "required": [
        "user_email",
        "action",
        "module",
        "entity_type",
        "timestamp"
    ]
};