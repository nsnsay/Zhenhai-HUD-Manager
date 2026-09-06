export function apiUrl() {
  const ip = window.location.hostname;
  return `http://${ip}:1469`;
}
