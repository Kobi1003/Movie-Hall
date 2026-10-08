import { ENV } from '../config/env.js';

// Pre-seeded high-precision coordinates for Indian cities and key districts
const KNOWN_LOCATIONS = {
  // Cities & Metros
  'kolkata': { lat: 22.5726, lng: 88.3639, name: 'Kolkata, West Bengal' },
  'hooghly': { lat: 22.8988, lng: 88.3970, name: 'Hooghly, West Bengal' },
  'serampore': { lat: 22.7523, lng: 88.3426, name: 'Serampore, Hooghly, West Bengal' },
  'barasat': { lat: 22.7230, lng: 88.4817, name: 'Barasat, North 24 Parganas, West Bengal' },
  'howrah': { lat: 22.5958, lng: 88.2636, name: 'Howrah, West Bengal' },
  'mumbai': { lat: 19.0760, lng: 72.8777, name: 'Mumbai, Maharashtra' },
  'mumbai (mmr)': { lat: 19.0760, lng: 72.8777, name: 'Mumbai (MMR), Maharashtra' },
  'delhi': { lat: 28.6139, lng: 77.2090, name: 'Delhi NCR' },
  'delhi ncr': { lat: 28.6139, lng: 77.2090, name: 'Delhi NCR' },
  'bengaluru': { lat: 12.9716, lng: 77.5946, name: 'Bengaluru, Karnataka' },
  'hyderabad': { lat: 17.3850, lng: 78.4867, name: 'Hyderabad, Telangana' },
  'chennai': { lat: 13.0827, lng: 80.2707, name: 'Chennai, Tamil Nadu' },
  'pune': { lat: 18.5204, lng: 73.8567, name: 'Pune, Maharashtra' },
  'ahmedabad': { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad, Gujarat' },
  'jaipur': { lat: 26.9124, lng: 75.7873, name: 'Jaipur, Rajasthan' },
  'lucknow': { lat: 26.8467, lng: 80.9462, name: 'Lucknow, Uttar Pradesh' },
  'chandigarh': { lat: 30.7333, lng: 76.7794, name: 'Chandigarh' },
  'kochi': { lat: 9.9312, lng: 76.2673, name: 'Kochi, Kerala' },
  'patna': { lat: 25.5941, lng: 85.1376, name: 'Patna, Bihar' },
  'bhubaneswar': { lat: 20.2961, lng: 85.8245, name: 'Bhubaneswar, Odisha' },
  'guwahati': { lat: 26.1445, lng: 91.7362, name: 'Guwahati, Assam' },

  // Landmark addresses
  'park street, kolkata': { lat: 22.5535, lng: 88.3518, name: 'Park Street, Kolkata' },
  '88 park street': { lat: 22.5535, lng: 88.3518, name: '88 Park Street, Kolkata' },
  'serampore, hooghly': { lat: 22.7523, lng: 88.3426, name: 'Serampore, Hooghly' },
  'kalinath bhattachariya street': { lat: 22.7523, lng: 88.3426, name: 'Serampore, Hooghly' }
};

export class GeoService {
  /**
   * Earth radius in kilometers
   */
  static EARTH_RADIUS_KM = 6371;

  /**
   * Calculate great-circle distance between two coordinates using Haversine formula
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number} Distance in kilometers
   */
  static haversineDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = GeoService.EARTH_RADIUS_KM * c;
    return Math.round(dist * 10) / 10; // 1 decimal place (e.g. 2.4 km)
  }

  /**
   * Format distance into human-friendly badge string
   */
  static formatDistance(distanceKm) {
    if (distanceKm == null) return null;
    if (distanceKm < 1) {
      const meters = Math.round(distanceKm * 1000);
      return `${meters} m away`;
    }
    return `${distanceKm.toFixed(1)} km away`;
  }

  /**
   * Look up coordinates for a city or known locality
   */
  static getKnownCityCoordinates(cityName) {
    if (!cityName) return null;
    const norm = cityName.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
    if (KNOWN_LOCATIONS[norm]) return KNOWN_LOCATIONS[norm];
    for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
      if (norm.includes(key) || key.includes(norm)) {
        return coords;
      }
    }
    return null;
  }

  /**
   * Geocode an address using Google Maps Geocoding API if key is available,
   * with fallback to known coordinate database or OSM Nominatim.
   */
  static async geocode({ address, city, state, postalCode }) {
    const fullAddress = [address, city, state, postalCode, 'India'].filter(Boolean).join(', ');
    const apiKey = ENV.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    // 1. Try Google Maps Geocoding API if key is present
    if (apiKey && apiKey !== 'your_google_maps_api_key_here') {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
            const loc = data.results[0].geometry.location;
            return {
              latitude: Number(loc.lat.toFixed(7)),
              longitude: Number(loc.lng.toFixed(7)),
              formattedAddress: data.results[0].formatted_address,
              source: 'google_maps'
            };
          }
        }
      } catch (err) {
        console.warn('[GeoService] Google Maps Geocode request failed:', err.message);
      }
    }

    // 2. Check local high-precision knowledge base
    const addressSearch = (address + ' ' + city).toLowerCase();
    for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
      if (addressSearch.includes(key)) {
        return {
          latitude: coords.lat,
          longitude: coords.lng,
          formattedAddress: coords.name,
          source: 'local_database'
        };
      }
    }

    // Fallback to city
    if (city) {
      const cityCoords = this.getKnownCityCoordinates(city);
      if (cityCoords) {
        return {
          latitude: cityCoords.lat,
          longitude: cityCoords.lng,
          formattedAddress: cityCoords.name,
          source: 'local_database'
        };
      }
    }

    // 3. Fallback to OpenStreetMap Nominatim
    try {
      const osmQuery = encodeURIComponent(`${city || address}, India`);
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${osmQuery}&format=json&limit=1`;
      const res = await fetch(osmUrl, {
        headers: { 'User-Agent': 'TixoraCinemaPlatform/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]?.lat && data?.[0]?.lon) {
          return {
            latitude: Number(parseFloat(data[0].lat).toFixed(7)),
            longitude: Number(parseFloat(data[0].lon).toFixed(7)),
            formattedAddress: data[0].display_name,
            source: 'osm_nominatim'
          };
        }
      }
    } catch (_) {}

    return null;
  }

  /**
   * Calculate distance matrix using Google Maps Distance Matrix API if configured,
   * or Haversine formula as fallback.
   */
  static async calculateDistance(origin, destination) {
    if (!origin || !destination) return null;
    const origLat = Number(origin.lat ?? origin.latitude);
    const origLng = Number(origin.lng ?? origin.longitude);
    const destLat = Number(destination.lat ?? destination.latitude);
    const destLng = Number(destination.lng ?? destination.longitude);

    if (isNaN(origLat) || isNaN(origLng) || isNaN(destLat) || isNaN(destLng)) return null;

    const apiKey = ENV.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    if (apiKey && apiKey !== 'your_google_maps_api_key_here') {
      try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origLat},${origLng}&destinations=${destLat},${destLng}&mode=driving&key=${apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const element = data?.rows?.[0]?.elements?.[0];
          if (element?.status === 'OK' && element.distance?.value) {
            const distanceKm = Math.round((element.distance.value / 1000) * 10) / 10;
            return {
              distanceKm,
              distanceText: element.distance.text || `${distanceKm} km away`,
              durationText: element.duration?.text || null,
              source: 'google_distance_matrix'
            };
          }
        }
      } catch (err) {
        console.warn('[GeoService] Google Maps Distance Matrix failed:', err.message);
      }
    }

    // Haversine fallback
    const distanceKm = this.haversineDistanceKm(origLat, origLng, destLat, destLng);
    return {
      distanceKm,
      distanceText: this.formatDistance(distanceKm),
      durationText: distanceKm ? `${Math.round(distanceKm * 2.2 + 5)} mins driving` : null,
      source: 'haversine'
    };
  }

  /**
   * Generate Google Maps URL for viewing cinema on map or getting directions
   */
  static getGoogleMapsUrls(cinema, userLocation = null) {
    const lat = cinema.latitude;
    const lng = cinema.longitude;
    const query = [cinema.cinema_name || cinema.name, cinema.address, cinema.city].filter(Boolean).join(', ');
    
    const searchUrl = lat && lng
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

    let directionsUrl = null;
    if (lat && lng) {
      if (userLocation?.latitude && userLocation?.longitude) {
        directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${lat},${lng}`;
      } else {
        directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      }
    }

    return { searchUrl, directionsUrl };
  }

  /**
   * Sort a list of cinema halls according to city names and closest distance.
   * - If user coordinates (userLat, userLng) are provided, calculates exact distances.
   * - If a reference city is provided without coordinates, uses city center coordinates.
   * - Sorts:
   *   a) By specific requested city if filtered: sorted strictly by closest distance.
   *   b) If "All Locations": grouped by City Name, and within each city sorted by closest distance.
   *      (Or if sortBy === 'distance', sorted across all cities strictly by nearest first).
   */
  static enrichAndSortCinemas(cinemas, { userLat, userLng, userCity, targetCity, sortBy = 'closest' } = {}) {
    let refLat = userLat != null ? Number(userLat) : null;
    let refLng = userLng != null ? Number(userLng) : null;

    // If user provided a city without explicit lat/lng, resolve reference coordinates from city
    if ((refLat == null || refLng == null) && userCity) {
      const cityCoords = this.getKnownCityCoordinates(userCity);
      if (cityCoords) {
        refLat = cityCoords.lat;
        refLng = cityCoords.lng;
      }
    }

    // Enrich each cinema with coordinates fallback (if null), distance, and maps links
    const enriched = cinemas.map((c) => {
      let lat = c.latitude != null ? Number(c.latitude) : null;
      let lng = c.longitude != null ? Number(c.longitude) : null;

      // If lat/lng was null, estimate from known locations database
      if (lat == null || lng == null) {
        const guessed = this.getKnownCityCoordinates(c.address + ' ' + c.city) || this.getKnownCityCoordinates(c.city);
        if (guessed) {
          lat = guessed.lat;
          lng = guessed.lng;
        }
      }

      let distanceKm = null;
      let distanceText = null;

      if (refLat != null && refLng != null && lat != null && lng != null) {
        distanceKm = this.haversineDistanceKm(refLat, refLng, lat, lng);
        distanceText = this.formatDistance(distanceKm);
      }

      const { searchUrl, directionsUrl } = this.getGoogleMapsUrls(
        { ...c, latitude: lat, longitude: lng },
        refLat != null && refLng != null ? { latitude: refLat, longitude: refLng } : null
      );

      return {
        ...c,
        latitude: lat,
        longitude: lng,
        distanceKm,
        distanceText,
        mapsUrl: searchUrl,
        directionsUrl
      };
    });

    // Filtering by target city if specified and not 'All Locations'
    let filtered = enriched;
    const isAll = !targetCity || targetCity === 'All Locations' || targetCity === 'All Locations / Metro';
    if (!isAll) {
      const targetNorm = targetCity.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
      filtered = enriched.filter((c) => {
        const cCity = (c.city || '').toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
        return cCity.includes(targetNorm) || targetNorm.includes(cCity);
      });
    }

    // Sorting algorithm:
    // If sortBy === 'closest' or user provided coords, sort by distance ascending (closest first)
    // For items with same distance (or without coords), sort by city then cinema name.
    return filtered.sort((a, b) => {
      // 1. If explicit distance sorting is requested or coords are available:
      if (sortBy === 'distance' || sortBy === 'closest') {
        if (a.distanceKm != null && b.distanceKm != null) {
          if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        } else if (a.distanceKm != null) {
          return -1;
        } else if (b.distanceKm != null) {
          return 1;
        }
      }

      // 2. City name alphabetical sorting
      const cityA = (a.city || '').toLowerCase();
      const cityB = (b.city || '').toLowerCase();
      if (cityA !== cityB) {
        return cityA.localeCompare(cityB);
      }

      // 3. Within same city: closest distance first if available
      if (a.distanceKm != null && b.distanceKm != null) {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      }

      // 4. Cinema name alphabetical fallback
      const nameA = (a.name || a.cinema_name || '').toLowerCase();
      const nameB = (b.name || b.cinema_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }
}
