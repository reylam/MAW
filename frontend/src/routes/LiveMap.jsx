import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap, GeoJSON, LayersControl, LayerGroup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { mockCrossings } from '../lib/mockData';
import { LocateFixed, ZoomIn, ZoomOut, Train, Loader } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';
import PageHeader from '../components/ui/PageHeader';
import StatGrid from '../components/ui/StatGrid';
import { Card } from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Jakarta coordinates (default center for Indonesia)
const DEFAULT_CENTER = [-6.2088, 106.8456];
const DEFAULT_ZOOM = 10;

// Railway lines in Jakarta area (from Overpass API/OpenStreetMap - railway=rail)
const getOverpassQueryForRailway = (bounds) => {
  const { south, west, north, east } = bounds;
  return `[out:json][timeout:25];
  (
    way["railway"="rail"](${south},${west},${north},${east});
  );
  out body;
  >;
  out skel qt;`;
};

// Major Indonesian cities for search
const INDONESIAN_CITIES = [
  { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { name: 'Bandung', lat: -6.9175, lng: 107.6191 },
  { name: 'Surabaya', lat: -7.2575, lng: 112.7521 },
  { name: 'Semarang', lat: -6.9667, lng: 110.4167 },
  { name: 'Yogyakarta', lat: -7.7971, lng: 110.3705 },
  { name: 'Medan', lat: 3.5897, lng: 98.6737 },
  { name: 'Makassar', lat: -5.1477, lng: 119.4327 },
  { name: 'Palembang', lat: -2.9761, lng: 104.7759 },
];

// Custom marker icons for crossing status
const createCustomIcon = (status, type = 'crossing') => {
  const colors = {
    safe: '#10B981',
    warning: '#F59E0B',
    critical: '#EF4444',
    offline: '#64748B',
  };

  const pulse = status === 'critical' ? 'pulse-animation' : '';

  return L.divIcon({
    html: `
      <div class="crossing-marker ${status} ${pulse}">
        <div class="marker-inner">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      </div>
    `,
    className: `crossing-marker-icon ${status}`,
    iconSize: [25, 25],
  });
};

// Railway GeoJSON layer style
const railwayStyle = {
  color: '#374151',
  weight: 3,
  opacity: 0.8,
  lineCap: 'round',
  lineJoin: 'round',
};

// Railway Layer Component - fetches real railway data from Overpass API
function RailwayLayer({ onRailwayLoad, onRailwayError }) {
  const map = useMap();
  const [railwayData, setRailwayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRailwayData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const bounds = map.getBounds();
      const { _southWest: sw, _northEast: ne } = bounds;
      
      // Overpass API query for railway=rail within current map bounds
      const query = `
        [out:json][timeout:30];
        (
          way["railway"="rail"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          relation["railway"="rail"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
        );
        out body;
        >;
        out skel qt;
      `;

      const response = await fetch(
        'https://overpass-api.de/api/interpreter?' + 
        new URLSearchParams({ data: query })
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Convert Overpass data to GeoJSON
      const geoJson = {
        type: 'FeatureCollection',
        features: []
      };

      // Process ways (linear railway tracks)
      data.elements.forEach(element => {
        if (element.type === 'way' && element.nodes) {
          const coordinates = element.nodes.map(nodeId => {
            const node = data.elements.find(el => el.type === 'node' && el.id === nodeId);
            return node ? [node.lat, node.lon] : null;
          }).filter(coord => coord !== null);

          if (coordinates.length > 1) {
            geoJson.features.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: coordinates.map(coord => [coord[1], coord[0]])
              },
              properties: {
                id: element.id,
                railway: element.tags?.railway || 'rail',
                name: element.tags?.name || 'Railway',
                type: 'railway'
              }
            });
          }
        }
      });

      setRailwayData(geoJson);
      onRailwayLoad?.(geoJson.features.length);
      
    } catch (err) {
      setError(err.message);
      onRailwayError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [map, onRailwayLoad, onRailwayError]);

  // Fetch railway data when map moves
  useEffect(() => {
    if (!map) return;

    const debouncedFetch = setTimeout(() => {
      fetchRailwayData();
    }, 500);

    return () => clearTimeout(debouncedFetch);
  }, [map, fetchRailwayData]);

  if (railwayData) {
    return (
      <GeoJSON 
        key={`railway-${railwayData.features.length}`}
        data={railwayData} 
        style={railwayStyle}
      />
    );
  }

  return null;
}

// Map Controls Component
function MapControls({ onLocateMe, railwayCount }) {
  const map = useMap();

  const ctrlBtn = 'p-2 rounded-maw-sm hover:bg-maw-hover transition-colors flex items-center gap-2 text-sm text-maw-text-muted';

  return (
    <div className="leaflet-control leaflet-bar leaflet-control-custom">
      <div className="flex flex-col gap-1 bg-maw-card rounded-maw shadow-maw border border-maw-border p-2">
        <button onClick={() => map.zoomIn()} className={ctrlBtn}>
          <ZoomIn size={15} />
          <span>Zoom in</span>
        </button>
        <button onClick={() => map.zoomOut()} className={ctrlBtn}>
          <ZoomOut size={15} />
          <span>Zoom out</span>
        </button>
        <button onClick={onLocateMe} className={ctrlBtn}>
          <LocateFixed size={15} />
          <span>Locate me</span>
        </button>
        <div className="border-t border-maw-border-subtle pt-1.5 mt-0.5">
          <select
            onChange={(e) => {
              const city = INDONESIAN_CITIES.find((c) => c.name === e.target.value);
              if (city) map.setView([city.lat, city.lng], 12);
            }}
            className="w-full text-sm bg-maw-surface text-maw-text-main border border-maw-border rounded-maw-sm px-2 py-1.5"
          >
            <option value="">Jump to city…</option>
            {INDONESIAN_CITIES.map((city) => (
              <option key={city.name} value={city.name}>{city.name}</option>
            ))}
          </select>
        </div>

        {railwayCount !== null && (
          <div className="border-t border-maw-border-subtle pt-1.5 mt-0.5 text-xs">
            <div className="flex items-center gap-2 text-maw-text-subtle">
              <Train size={12} />
              <span>Segments: {railwayCount}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserLocationMarker({ position }) {
  if (!position) return null;
  
  return L.divIcon({
    html: `
      <div class="user-location-marker">
        <div class="animate-ping"></div>
        <div class="inner"></div>
      </div>
    `,
    className: 'user-location-icon',
    iconSize: [30, 30],
  });
}

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function LiveMap() {
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [selectedCrossing, setSelectedCrossing] = useState(null);
  const [railwayCount, setRailwayCount] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [railwayError, setRailwayError] = useState(null);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationError(null);
      },
      (error) => {
        setLocationError("Location access denied");
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const handleCrossingClick = (crossing) => {
    setSelectedCrossing(crossing);
  };

  const safeCount = mockCrossings.filter(c => c.status === 'safe').length;
  const warningCount = mockCrossings.filter(c => c.status === 'warning').length;
  const criticalCount = mockCrossings.filter(c => c.status === 'critical').length;
  const offlineCount = mockCrossings.filter(c => c.status === 'offline').length;

  // Filter crossings that are near railway (validation)
  const validCrossings = mockCrossings.filter(crossing => {
    // Basic validation: crossing should have railway line property
    return crossing.railwayLine;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col max-w-[1600px] mx-auto w-full">
      <PageHeader
        eyebrow="Geospatial"
        title="Railway monitoring map"
        description="Live railway network and crossing status across Indonesia."
        actions={
          <button
            onClick={handleLocateMe}
            className="flex items-center gap-2 px-3.5 py-2 bg-maw-primary text-white rounded-maw hover:bg-maw-primary-hover transition-colors text-sm font-semibold"
          >
            <LocateFixed size={15} />
            Locate me
          </button>
        }
      />

      {/* Map Container */}
      <div className="flex-1 relative rounded-maw overflow-hidden border border-maw-border shadow-maw-sm mt-5 min-h-[360px]">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          whenReady={() => setMapReady(true)}
        >
          {/* Base Map Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Real Railway Layer - MUST LOAD FIRST */}
          <RailwayLayer 
            onRailwayLoad={(count) => {
              setRailwayCount(count);
              console.log(`Railway segments loaded: ${count}`);
            }}
            onRailwayError={(error) => {
              setRailwayError(error);
              console.error(`Railway loading error: ${error}`);
            }}
          />

          {/* ONLY THEN: Crossing Markers (only if railway data is loaded) */}
          {railwayCount !== null && validCrossings.map((crossing) => (
            <Marker
              key={crossing.id}
              position={[crossing.coordinates.lat, crossing.coordinates.lng]}
              icon={createCustomIcon(crossing.status)}
              eventHandlers={{
                click: () => handleCrossingClick(crossing),
              }}
            >
              <Popup>
                <div className="p-2 min-w-[280px]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-display font-bold text-slate-900 text-lg">{crossing.name}</div>
                      <div className="text-sm text-slate-600">{crossing.location}</div>
                    </div>
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                      crossing.status === 'safe' ? 'bg-emerald-100 text-emerald-700' :
                      crossing.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                      crossing.status === 'critical' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {crossing.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Railway Line</span>
                      <span className="font-medium text-slate-900">{crossing.railwayLine}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Train Status</span>
                      <span className={`font-medium ${crossing.trainDetected ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>
                        {crossing.trainDetected ? 'DETECTED' : 'CLEAR'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Barrier</span>
                      <span className="font-medium text-slate-900 capitalize">{crossing.barrierStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Obstacle</span>
                      <span className={`font-medium ${crossing.obstacleDetected ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>
                        {crossing.obstacleDetected ? 'DETECTED' : 'NONE'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                    MAW Device: {crossing.connectivity} • Last update: {new Date(crossing.lastUpdate).toLocaleTimeString('id-ID')}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Custom Controls */}
          {mapReady && <MapControls onLocateMe={handleLocateMe} railwayCount={railwayCount} />}
          <ZoomControl position="bottomright" />
        </MapContainer>

        {/* Map Legend */}
        <div className="absolute top-3 right-3 bg-maw-card rounded-maw border border-maw-border p-3.5 shadow-maw z-[1000]">
          <div className="eyebrow mb-2">Legend</div>
          <div className="space-y-1.5">
            {[
              { label: 'Safe', dot: 'bg-maw-safe' },
              { label: 'Warning', dot: 'bg-maw-warning' },
              { label: 'Critical', dot: 'bg-maw-critical' },
              { label: 'Offline', dot: 'bg-maw-offline' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span className={`status-dot ${l.dot}`} />
                <span className="text-xs text-maw-text-muted">{l.label}</span>
              </div>
            ))}
            <div className="pt-1.5 border-t border-maw-border-subtle mt-1.5 flex items-center gap-2">
              <span className="w-4 h-0.5 bg-maw-text-muted" />
              <span className="text-xs text-maw-text-muted">Railway track</span>
            </div>
          </div>
        </div>

        {/* Railway Data Status Panel */}
        {railwayError ? (
          <div className="absolute top-3 left-3 bg-maw-card rounded-maw border border-maw-critical-border p-3 shadow-maw z-[1000] max-w-[220px]">
            <div className="text-xs font-semibold text-maw-critical">Railway data error</div>
            <div className="text-[11px] text-maw-text-muted mt-1">{railwayError}</div>
            <div className="text-[11px] text-maw-text-subtle mt-1.5">Using crossing markers only.</div>
          </div>
        ) : railwayCount !== null ? (
          <div className="absolute top-3 left-3 bg-maw-card rounded-maw border border-maw-border p-3 shadow-maw z-[1000]">
            <div className="text-xs font-semibold text-maw-text-main">Railway network</div>
            <div className="text-[11px] text-maw-text-muted mt-1">{railwayCount} segments loaded</div>
            <div className="text-[11px] text-maw-text-subtle mt-0.5">{validCrossings.length} crossings monitored</div>
          </div>
        ) : (
          <div className="absolute top-3 left-3 bg-maw-card rounded-maw border border-maw-border p-3 shadow-maw z-[1000]">
            <div className="flex items-center gap-2">
              <Loader className="text-maw-primary animate-spin" size={15} />
              <div className="text-xs text-maw-text-muted">Loading railway data…</div>
            </div>
          </div>
        )}

        {/* Location Error */}
        {locationError && (
          <div className="absolute bottom-3 right-3 bg-maw-critical-soft border border-maw-critical-border text-maw-critical px-3.5 py-2 rounded-maw shadow-maw text-sm z-[1000]">
            {locationError}
          </div>
        )}

        {/* Selected Crossing Info */}
        {selectedCrossing && railwayCount !== null && (
          <div className="absolute bottom-3 left-3 bg-maw-card rounded-maw border border-maw-border shadow-maw p-4 max-w-xs z-[1000]">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-display font-semibold text-maw-text-main">{selectedCrossing.name}</h3>
              <button
                onClick={() => setSelectedCrossing(null)}
                className="text-maw-text-subtle hover:text-maw-text-main p-1 -m-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <StatusBadge status={selectedCrossing.status} showIcon />
            <div className="text-sm text-maw-text-muted mt-2">{selectedCrossing.railwayLine}</div>
            <div className="text-xs text-maw-text-subtle mb-3">{selectedCrossing.location}</div>
            <a
              href={`/crossing/${selectedCrossing.id}`}
              className="block text-center w-full py-2 bg-maw-primary text-white rounded-maw-sm hover:bg-maw-primary-hover transition-colors text-sm font-semibold"
            >
              View full details
            </a>
          </div>
        )}
      </div>

      {/* Status Summary */}
      <Card className="mt-5 overflow-hidden">
        <StatGrid
          items={[
            { label: 'Validated crossings', value: validCrossings.length },
            { label: 'Safe', value: safeCount, tone: 'safe' },
            { label: 'Warning', value: warningCount, tone: warningCount ? 'warning' : 'muted' },
            { label: 'Critical', value: criticalCount, tone: criticalCount ? 'critical' : 'muted' },
          ]}
        />
      </Card>
    </div>
  );
}
