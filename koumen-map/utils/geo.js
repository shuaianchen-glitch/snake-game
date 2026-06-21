const EARTH_RADIUS = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function getDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function sortByDistance(shops, lat, lng) {
  return shops
    .map((shop) => ({
      ...shop,
      distance: getDistance(lat, lng, shop.latitude, shop.longitude),
    }))
    .sort((a, b) => a.distance - b.distance);
}

function filterByPrice(shops, maxPrice) {
  if (!maxPrice || maxPrice === Infinity) return shops;
  return shops.filter((s) => s.fullMealPrice <= maxPrice);
}

function getMarkerColor(price) {
  if (price <= 15) return '#2ecc71';
  if (price <= 20) return '#FF6B35';
  return '#f39c12';
}

module.exports = {
  getDistance,
  formatDistance,
  sortByDistance,
  filterByPrice,
  getMarkerColor,
};
