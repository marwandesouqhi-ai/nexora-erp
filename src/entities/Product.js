module.exports = {
    "name": "Product",
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Product name in Arabic/English"
        },
        "sku": {
            "type": "string",
            "description": "Stock Keeping Unit - unique identifier"
        },
        "barcode": {
            "type": "string",
            "description": "EAN/UPC for scanner integration"
        },
        "category": {
            "type": "string",
            "description": "e.g., Vaccines, Antibiotics, Feed Additives"
        },
        "brand": {
            "type": "string",
            "description": "Manufacturer or Company name"
        },
        "unit": {
            "type": "string",
            "enum": ["piece", "box", "vial", "kg", "liter", "bottle"],
            "default": "piece"
        },
        "cost_price": {
            "type": "number",
            "description": "Latest purchase price"
        },
        "sale_price": {
            "type": "number",
            "description": "Standard selling price"
        },
        "min_sale_price": {
            "type": "number",
            "description": "Minimum allowed price (Floor price) for sales staff"
        },
        "stock": {
            "type": "number",
            "default": 0
        },
        "min_stock_level": {
            "type": "number",
            "default": 5,
            "description": "Alert trigger for low stock"
        },
        "expiry_date": {
            "type": "string",
            "format": "date",
            "description": "Critical for veterinary/medical products"
        },
        "batch_number": {
            "type": "string",
            "description": "For tracking quality control batches"
        },
        "location": {
            "type": "string",
            "description": "Shelf or Warehouse section (e.g., A-12, Fridge-1)"
        },
        "supplier_id": {
            "type": "string",
            "description": "Primary supplier reference"
        },
        "tax_rate": {
            "type": "number",
            "default": 14,
            "description": "VAT percentage in Egypt"
        },
        "is_active": {
            "type": "boolean",
            "default": true
        },
        "image_url": {
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
        "name",
        "sku",
        "category",
        "cost_price",
        "sale_price",
        "stock"
    ]
}