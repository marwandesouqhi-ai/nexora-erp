module.exports = {
    "name": "ActivityLog",
    "type": "object",
    "properties": {
        "user_id": {
            "type": "string",
            "description": "Identifier of the user who performed the action"
        },
        "user_name": {
            "type": "string",
            "description": "Readable name of the user who performed the action"
        },
        "action": {
            "type": "string",
            "description": "Action name or description, e.g. create_sale, delete_product, update_stock"
        },
        "module": {
            "type": "string",
            "description": "Business module or system area, e.g. sales, inventory, accounting"
        },
        "entity_type": {
            "type": "string",
            "description": "System entity affected by the action, e.g. Sale, Product, Customer"
        },
        "entity_id": {
            "type": "string",
            "description": "Optional identifier of the affected entity"
        },
        "details": {
            "type": "string",
            "description": "Human-readable details of the activity"
        },
        "ip_address": {
            "type": "string",
            "description": "Client IP address if available"
        },
        "timestamp": {
            "type": "string",
            "format": "date-time",
            "description": "Server-side timestamp for the activity"
        }
    },
    "required": [
        "user_id",
        "user_name",
        "action",
        "timestamp"
    ]
};