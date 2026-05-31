export default {
    "name": "Product",
    "type": "object",
    "properties": {
        "product_name": {
            "type": "string",
            "description": "Product name shown to the user"
        },
        "sku": {
            "type": "string",
            "description": "Stock Keeping Unit - unique internal code"
        },
        "barcode": {
            "type": "string",
            "description": "EAN/UPC for barcode scanner integration"
        },
        "category": {
            "type": "string",
            "description": "Product category, e.g. Vaccines, Antibiotics"
        },
        "brand": {
            "type": "string",
            "description": "Manufacturer or brand name"
        },
        "unit": {
            "type": "string",
            "enum": ["piece", "box", "vial", "kg", "liter", "bottle"],
            "default": "piece"
        },
        "current_stock": {
            "type": "number",
            "default": 0,
            "description": "Available quantity in stock"
        },
        "min_stock_level": {
            "type": "number",
            "default": 5,
            "description": "Low stock alert threshold"
        },
        "purchase_price": {
            "type": "number",
            "description": "Latest purchase cost per unit"
        },
        "selling_price": {
            "type": "number",
            "description": "Retail price per unit"
        },
        "wholesale_price": {
            "type": "number",
            "description": "Wholesale price per unit"
        },
        "expiry_date": {
            "type": "string",
            "format": "date",
            "description": "Expiration date for perishable or regulated items"
        },
        "batch_number": {
            "type": "string",
            "description": "Batch or lot number for traceability"
        },
        "location": {
            "type": "string",
            "description": "Warehouse or shelf location"
        },
        "supplier_id": {
            "type": "string",
            "description": "Reference ID for the preferred supplier"
        },
        "tax_rate": {
            "type": "number",
            "default": 14,
            "description": "VAT rate applied to this product"
        },
        "is_active": {
            "type": "boolean",
            "default": true
        },
        "image_url": {
            "type": "string",
            "description": "Optional image URL for product display"
        },
        "created_at": {
            "type": "string",
            "format": "date-time"
        },
        "last_update": {
            "type": "string",
            "format": "date-time"
        }
    },
    "required": [
        "product_name",
        "category",
        "current_stock",
        "purchase_price",
        "selling_price"
    ]
}