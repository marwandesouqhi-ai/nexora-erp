const BASE44_API_URL = import.meta.env.VITE_BASE44_API_URL?.replace(/\/$/, "") || "";
const BASE44_API_KEY = import.meta.env.VITE_BASE44_API_KEY || import.meta.env.VITE_BASE44_TOKEN || "";

const buildHeaders = (overrides = {}) => {
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...overrides,
    };

    if (BASE44_API_KEY) {
        headers.Authorization = `Bearer ${BASE44_API_KEY}`;
    }

    return headers;
};

const createUrl = (path, query = {}) => {
    if (!BASE44_API_URL) {
        throw new Error("Base44 API URL is not configured. Set VITE_BASE44_API_URL in your environment.");
    }

    const url = new URL(path.startsWith("/") ? path.substring(1) : path, `${BASE44_API_URL}/`);
    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        url.searchParams.set(key, String(value));
    });

    return url.toString();
};

const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    return response.text();
};

const base44Request = async (method, path, { body, query, headers = {}, signal } = {}) => {
    const url = createUrl(path, query);
    const response = await fetch(url, {
        method,
        headers: buildHeaders(headers),
        body: body != null ? JSON.stringify(body) : undefined,
        signal,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
        const message = payload?.message || payload?.error || response.statusText;
        throw new Error(`Base44 request failed: ${message}`);
    }

    return payload;
};

export const isBase44Configured = () => Boolean(BASE44_API_URL && BASE44_API_KEY);

export const base44Get = async (path, query = {}, options = {}) => base44Request("GET", path, { query, ...options });
export const base44Post = async (path, body, options = {}) => base44Request("POST", path, { body, ...options });
export const base44Put = async (path, body, options = {}) => base44Request("PUT", path, { body, ...options });
export const base44Patch = async (path, body, options = {}) => base44Request("PATCH", path, { body, ...options });
export const base44Delete = async (path, options = {}) => base44Request("DELETE", path, options);

export const getBase44Customers = async (filters = {}) => base44Get("/customers", filters);
export const getBase44Suppliers = async (filters = {}) => base44Get("/suppliers", filters);
export const getBase44Products = async (filters = {}) => base44Get("/products", filters);
export const getBase44InventoryItems = async (filters = {}) => base44Get("/inventory", filters);

export const createBase44Customer = async (customerData) => base44Post("/customers", customerData);
export const createBase44Supplier = async (supplierData) => base44Post("/suppliers", supplierData);
export const createBase44Product = async (productData) => base44Post("/products", productData);
export const createBase44Invoice = async (invoiceData) => base44Post("/invoices", invoiceData);

export const updateBase44Customer = async (customerId, updateData) => base44Put(`/customers/${customerId}`, updateData);
export const updateBase44Supplier = async (supplierId, updateData) => base44Put(`/suppliers/${supplierId}`, updateData);
export const updateBase44Product = async (productId, updateData) => base44Put(`/products/${productId}`, updateData);
export const updateBase44InventoryItem = async (itemId, updateData) => base44Put(`/inventory/${itemId}`, updateData);

export const deleteBase44Customer = async (customerId) => base44Delete(`/customers/${customerId}`);
export const deleteBase44Supplier = async (supplierId) => base44Delete(`/suppliers/${supplierId}`);
export const deleteBase44Product = async (productId) => base44Delete(`/products/${productId}`);
export const deleteBase44InventoryItem = async (itemId) => base44Delete(`/inventory/${itemId}`);

export const syncBase44Stock = async (productId, stockLevel) =>
    base44Put(`/inventory/${productId}`, { stock_level: Number(stockLevel) });

export const searchBase44Resources = async (resource, query = {}) => {
    const allowedResources = ["customers", "suppliers", "products", "inventory", "invoices"];
    if (!allowedResources.includes(resource)) {
        throw new Error(`Base44 resource must be one of: ${allowedResources.join(", ")}`);
    }
    return base44Get(`/${resource}`, query);
};
