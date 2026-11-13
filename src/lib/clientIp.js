let cachedIp = '';
let ipRequest = null;

export const getClientIp = async () => {
    if (cachedIp) return cachedIp;
    if (ipRequest) return ipRequest;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    ipRequest = fetch('https://api.ipify.org?format=json', { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : {}))
        .then((data) => {
            cachedIp = data.ip || 'غير معروف';
            return cachedIp;
        })
        .catch(() => 'غير معروف')
        .finally(() => {
            clearTimeout(timeoutId);
            ipRequest = null;
        });

    return ipRequest;
};

export const getClientDevice = () => (
    typeof navigator !== 'undefined' ? navigator.userAgent : 'غير معروف'
);