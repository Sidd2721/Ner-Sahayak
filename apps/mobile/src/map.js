import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NH27_CORRIDOR } from '@shared/constants/corridors';
import { db } from './db.js';

let map;
let userMarker;

// Setup custom icons for leaflets (since default icon URLs may fail in Vite without proper imports)
const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

const reportIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export async function renderCorridorMap() {
  if (!map) {
    const mapEl = document.getElementById('map-container');
    if (!mapEl) return;
    
    // We compute a center based on waypoints. For NH-27, Haflong is roughly the center: 25.158, 93.01
    const center = [25.158, 93.01];
    
    map = L.map('map-container', { zoomControl: true }).setView(center, 9);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 15,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Draw the corridor line simply by connecting the waypoints
    const lineCoords = NH27_CORRIDOR.waypoints.map(wp => [wp.lat, wp.lng]);
    L.polyline(lineCoords, { color: '#2563eb', weight: 4 }).addTo(map);
    
    // Plot Waypoints/Districts
    NH27_CORRIDOR.waypoints.forEach(wp => {
      L.marker([wp.lat, wp.lng], { icon: iconDefault }).bindPopup(wp.name).addTo(map);
    });
  }

  // Plot already-synced offline reports from local db as markers
  const reports = await db.reports.toArray();
  reports.forEach(r => {
    if (r.lat && r.lng) {
      L.marker([r.lat, r.lng], { icon: reportIcon })
        .bindPopup(`<b>${r.type}</b><br>Severity: ${r.severity}<br>${r.description || ''}`)
        .addTo(map);
    }
  });
}

// Live position via watchPosition()
export function startLiveLocationTracking() {
  if (!navigator.geolocation) return;

  navigator.geolocation.watchPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Surface the fix's own timestamp (recency check: a redrawn stale
    // reading shows an old time here; a live one tracks the clock) and
    // expose the last fix for on-device verification via the console.
    const fixTime = new Date(pos.timestamp).toLocaleTimeString();
    const popupHtml = `You are here<br>Fix: ${fixTime}`;
    window.__lastLiveFix = { lat, lng, timestamp: pos.timestamp };

    if (!map) return; // Map not initialized yet

    if (userMarker) {
      userMarker.setLatLng([lat, lng]);
      userMarker.setPopupContent(popupHtml);
    } else {
      userMarker = L.circleMarker([lat, lng], { color: '#22c55e', radius: 8 })
        .bindPopup(popupHtml)
        .addTo(map);
    }
  }, (err) => {
    console.warn('Live location tracking error (watchPosition):', err);
  }, { enableHighAccuracy: true });
}

// Route optimization (OSRM demo)
export async function optimizeRoute(start, end) {
  // Only trigger if online
  if (!navigator.onLine) {
    alert("Route optimization requires an active internet connection.");
    return;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      L.polyline(routeCoords, { color: '#eab308', weight: 4, dashArray: '10, 10' })
        .bindPopup('Optimized Alternate Route')
        .addTo(map);
    }
  } catch (err) {
    console.error("OSRM Route optimization failed:", err);
  }
}
