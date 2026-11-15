// Lo que escriben los usuarios se muestra dentro de ventanas de Leaflet, que interpretan HTML.
export const escaparHtml = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
