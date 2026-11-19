export async function fetchJSON(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

export const getLevels = () => fetchJSON("/api/levels/");
export const getLevel = (id) => fetchJSON(`/api/levels/${encodeURIComponent(id)}`);
export const saveLevel = (level) => fetchJSON("/api/levels/", {
    method: "POST",
    body: JSON.stringify(level),
});
