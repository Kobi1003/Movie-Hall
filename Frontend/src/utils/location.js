// Utility for browser geolocation, Google Maps integration, and distance calculation

const LOCATION_STORAGE_KEY = 'tixora_user_location';

/**
 * Earth radius in kilometers for Haversine distance
 */
export const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = EARTH_RADIUS_KM * c;
  return Math.round(dist * 10) / 10;
}

export function formatDistance(distanceKm) {
  if (distanceKm == null || isNaN(distanceKm)) return null;
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m away`;
  }
  return `${Number(distanceKm).toFixed(1)} km away`;
}

/**
 * Request real-time GPS position from browser navigator
 */
export async function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: Date.now()
        };
        try {
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(coords));
        } catch {
          // ignore storage error
        }
        resolve(coords);
      },
      (err) => {
        let message = 'Unable to retrieve location.';
        if (err.code === 1) message = 'Location access was denied. Please allow location permissions in your browser.';
        else if (err.code === 2) message = 'Position unavailable.';
        else if (err.code === 3) message = 'Location request timed out.';
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * Retrieve saved location from localStorage
 */
export function getSavedLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.latitude && data?.longitude) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear cached location
 */
export function clearSavedLocation() {
  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch {
    // ignore storage error
  }
}

/**
 * Find the closest city from user coordinates
 */
export function findClosestCity(userCoords, citiesList = []) {
  if (!userCoords?.latitude || !userCoords?.longitude || !citiesList.length) return null;
  let closest = null;
  let minDistance = Infinity;

  for (const city of citiesList) {
    if (city.latitude != null && city.longitude != null) {
      const dist = haversineDistanceKm(
        userCoords.latitude,
        userCoords.longitude,
        city.latitude,
        city.longitude
      );
      if (dist != null && dist < minDistance) {
        minDistance = dist;
        closest = { ...city, distanceKm: dist, distanceText: formatDistance(dist) };
      }
    }
  }

  return closest;
}

/**
 * Generate Google Maps search / directions URL
 */
export function getGoogleMapsUrl(theatre, userCoords = null) {
  if (!theatre) return '#';
  const lat = theatre.latitude;
  const lng = theatre.longitude;
  const label = [theatre.name, theatre.area, theatre.city].filter(Boolean).join(', ');

  if (userCoords?.latitude && userCoords?.longitude && lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&origin=${userCoords.latitude},${userCoords.longitude}&destination=${lat},${lng}`;
  }

  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
}
