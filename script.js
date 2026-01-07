/**
 * GPX Generator - Manual Waypoint Mode
 * Tap map to add waypoints, real-time stats calculation
 */

// ===================================
// App State
// ===================================
const state = {
  map: null,
  waypoints: [], // Array of {lat, lon, marker}
  polyline: null,
  gpxData: null,
  totalDistance: 0, // in km
  totalElevation: 0, // in meters
};

// ===================================
// Configuration
// ===================================
const ACTIVITY_CONFIG = {
  walking: {
    avgSpeed: 5, // km/h
    minSpeed: 4,
    maxSpeed: 6,
    strideLength: 0.7, // meters per step
    met: 4.3,
    gpsInterval: 2, // seconds between GPS points
    hrMin: 85, // heart rate min
    hrMax: 110, // heart rate max
    hrAvg: 95, // heart rate average
  },
  running: {
    avgSpeed: 10, // km/h
    minSpeed: 7,
    maxSpeed: 13,
    strideLength: 1.2, // meters per step
    met: 8.5,
    gpsInterval: 1.5,
    hrMin: 140,
    hrMax: 175,
    hrAvg: 155,
  },
  cycling: {
    avgSpeed: 22, // km/h
    minSpeed: 15,
    maxSpeed: 30,
    strideLength: 0, // no steps for cycling
    met: 7.0,
    gpsInterval: 2,
    hrMin: 110,
    hrMax: 150,
    hrAvg: 130,
  },
};

// Default location (Karawang)
const DEFAULT_CENTER = [-6.389444352997728, 107.41960131882718];
const DEFAULT_ZOOM = 15;

// ===================================
// DOM Elements
// ===================================
const elements = {
  map: document.getElementById("map"),

  // Buttons
  btnUndo: document.getElementById("btn-undo"),
  btnClear: document.getElementById("btn-clear"),
  btnCloseLoop: document.getElementById("btn-close-loop"),
  btnSave: document.getElementById("btn-save"),
  btnLoad: document.getElementById("btn-load"),
  generateGpxBtn: document.getElementById("generate-gpx"),
  downloadGpxBtn: document.getElementById("download-gpx"),
  generateGpxBtnMobile: document.getElementById("generate-gpx-mobile"),
  downloadGpxBtnMobile: document.getElementById("download-gpx-mobile"),

  // Form
  activityType: document.getElementById("activity-type"),
  activityDate: document.getElementById("activity-date"),
  startTime: document.getElementById("start-time"),
  bodyWeight: document.getElementById("body-weight"),

  // Stats
  statDistance: document.getElementById("stat-distance"),
  statElevation: document.getElementById("stat-elevation"),
  statWaypoints: document.getElementById("stat-waypoints"),
  statDuration: document.getElementById("stat-duration"),
  statPace: document.getElementById("stat-pace"),
  statSpeed: document.getElementById("stat-speed"),
  statCalories: document.getElementById("stat-calories"),
  statSteps: document.getElementById("stat-steps"),
  statHr: document.getElementById("stat-hr"),
  statPoints: document.getElementById("stat-points"),

  // Toast
  toastContainer: document.getElementById("toast-container"),
};

// ===================================
// Initialize App
// ===================================
function initApp() {
  initMap();
  initFormDefaults();
  initEventListeners();
  loadSavedRoute(); // Auto-load saved route on startup
  updateStats();
}

// ===================================
// Map Initialization
// ===================================
function initMap() {
  state.map = L.map("map", {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
    attributionControl: true,
  });

  // OpenStreetMap tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(state.map);

  // Initialize polyline
  state.polyline = L.polyline([], {
    color: "#4CAF50",
    weight: 4,
    opacity: 0.8,
  }).addTo(state.map);

  // Map click handler
  state.map.on("click", handleMapClick);

  // Map always stays at DEFAULT_CENTER coordinates
  // No geolocation - user controls the map manually
}

// ===================================
// Form Defaults
// ===================================
function initFormDefaults() {
  const now = new Date();

  // Set today's date
  elements.activityDate.value = now.toISOString().split("T")[0];

  // Set current time (rounded to 5 min)
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = (Math.floor(now.getMinutes() / 5) * 5)
    .toString()
    .padStart(2, "0");
  elements.startTime.value = `${hours}:${minutes}`;
}

// ===================================
// Event Listeners
// ===================================
function initEventListeners() {
  // Map control buttons
  elements.btnUndo.addEventListener("click", undoLastWaypoint);
  elements.btnClear.addEventListener("click", clearAllWaypoints);
  elements.btnCloseLoop.addEventListener("click", closeLoop);
  elements.btnSave.addEventListener("click", saveRoute);
  elements.btnLoad.addEventListener("click", loadRoute);

  // Generate buttons (Desktop)
  elements.generateGpxBtn.addEventListener("click", generateGPX);
  elements.downloadGpxBtn.addEventListener("click", downloadGPX);

  // Generate buttons (Mobile)
  elements.generateGpxBtnMobile.addEventListener("click", generateGPX);
  elements.downloadGpxBtnMobile.addEventListener("click", downloadGPX);

  // Form changes trigger stats update
  elements.activityType.addEventListener("change", updateStats);
  elements.bodyWeight.addEventListener("input", updateStats);
}

// ===================================
// Map Click Handler - Add Waypoint
// ===================================
function handleMapClick(e) {
  const { lat, lng } = e.latlng;
  addWaypoint(lat, lng);
}

// ===================================
// Waypoint Management
// ===================================
function addWaypoint(lat, lon) {
  const index = state.waypoints.length;

  // Create marker
  const isFirst = index === 0;
  const marker = L.marker([lat, lon], {
    icon: createMarkerIcon(index + 1, isFirst),
    draggable: true,
  }).addTo(state.map);

  // Marker drag handler
  marker.on("drag", () => updatePolyline());
  marker.on("dragend", () => {
    updateWaypointPosition(index);
    updateStats();
  });

  // Store waypoint
  state.waypoints.push({ lat, lon, marker });

  // Update polyline
  updatePolyline();

  // Update stats
  updateStats();

  // Enable generate button if we have at least 2 waypoints
  const canGenerate = state.waypoints.length < 2;
  elements.generateGpxBtn.disabled = canGenerate;
  elements.generateGpxBtnMobile.disabled = canGenerate;
}

function createMarkerIcon(number, isStart) {
  const color = isStart ? "#4CAF50" : "#2196F3";
  const html = `
    <div style="
      background: ${color};
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${number}</div>
  `;
  return L.divIcon({
    html,
    className: "custom-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function updateWaypointPosition(index) {
  if (state.waypoints[index]) {
    const pos = state.waypoints[index].marker.getLatLng();
    state.waypoints[index].lat = pos.lat;
    state.waypoints[index].lon = pos.lng;
  }
}

function updatePolyline() {
  const points = state.waypoints.map((wp) => {
    const pos = wp.marker.getLatLng();
    return [pos.lat, pos.lng];
  });
  state.polyline.setLatLngs(points);
}

function undoLastWaypoint() {
  if (state.waypoints.length === 0) return;

  const wp = state.waypoints.pop();
  state.map.removeLayer(wp.marker);
  updatePolyline();
  updateStats();

  const canGenerate = state.waypoints.length < 2;
  elements.generateGpxBtn.disabled = canGenerate;
  elements.generateGpxBtnMobile.disabled = canGenerate;
  showToast("Waypoint dihapus", "info");
}

function clearAllWaypoints() {
  if (state.waypoints.length === 0) return;

  state.waypoints.forEach((wp) => state.map.removeLayer(wp.marker));
  state.waypoints = [];
  updatePolyline();
  updateStats();

  elements.generateGpxBtn.disabled = true;
  elements.generateGpxBtnMobile.disabled = true;
  elements.downloadGpxBtn.disabled = true;
  elements.downloadGpxBtnMobile.disabled = true;
  state.gpxData = null;

  showToast("Semua waypoint dihapus", "info");
}

function closeLoop() {
  if (state.waypoints.length < 2) {
    showToast("Minimal 2 waypoint untuk close loop", "error");
    return;
  }

  // Add first point as last point
  const first = state.waypoints[0];
  addWaypoint(first.lat, first.lon);
  showToast("Loop ditutup", "success");
}

// ===================================
// Calculate Distance (Haversine)
// ===================================
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateTotalDistance() {
  let total = 0;
  for (let i = 1; i < state.waypoints.length; i++) {
    const prev = state.waypoints[i - 1];
    const curr = state.waypoints[i];
    total += haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
  }
  return total;
}

// ===================================
// Update All Stats (Real-time)
// ===================================
function updateStats() {
  const activity = elements.activityType.value;
  const config = ACTIVITY_CONFIG[activity];
  const weight = parseFloat(elements.bodyWeight.value) || 70;

  // Distance
  const distanceKm = calculateTotalDistance();
  state.totalDistance = distanceKm;
  elements.statDistance.textContent = distanceKm.toFixed(2);

  // Waypoints count
  elements.statWaypoints.textContent = state.waypoints.length;

  // Duration (based on avg speed)
  const durationHours = distanceKm / config.avgSpeed;
  const durationMinutes = durationHours * 60;
  const hours = Math.floor(durationMinutes / 60);
  const mins = Math.floor(durationMinutes % 60);
  elements.statDuration.textContent = `${hours
    .toString()
    .padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

  // Pace (min/km)
  if (distanceKm > 0) {
    const paceMinutes = durationMinutes / distanceKm;
    const paceMin = Math.floor(paceMinutes);
    const paceSec = Math.floor((paceMinutes - paceMin) * 60);
    elements.statPace.textContent = `${paceMin}:${paceSec
      .toString()
      .padStart(2, "0")}`;
  } else {
    elements.statPace.textContent = "--:--";
  }

  // Speed
  elements.statSpeed.textContent = config.avgSpeed.toFixed(1);

  // Calories (MET formula)
  const calories = Math.round(config.met * weight * durationHours);
  elements.statCalories.textContent = calories;

  // Steps (only for walking/running)
  if (config.strideLength > 0) {
    const distanceMeters = distanceKm * 1000;
    const steps = Math.round(distanceMeters / config.strideLength);
    elements.statSteps.textContent = steps.toLocaleString();
  } else {
    elements.statSteps.textContent = "N/A";
  }

  // Heart Rate (average)
  elements.statHr.textContent = `❤️ ${config.hrAvg}`;

  // Elevation (simple estimation based on distance)
  const elevation = Math.round(distanceKm * 5); // ~5m per km average
  state.totalElevation = elevation;
  elements.statElevation.textContent = elevation;

  // GPS Points estimation
  const totalSeconds = durationHours * 3600;
  const gpsPoints = Math.round(totalSeconds / config.gpsInterval);
  elements.statPoints.textContent = gpsPoints.toLocaleString();
}

// ===================================
// Generate GPX
// ===================================
function generateGPX() {
  if (state.waypoints.length < 2) {
    showToast("Tambahkan minimal 2 waypoint", "error");
    return;
  }

  const activity = elements.activityType.value;
  const config = ACTIVITY_CONFIG[activity];
  const weight = parseFloat(elements.bodyWeight.value) || 70;

  // Parse start time
  const dateStr = elements.activityDate.value;
  const timeStr = elements.startTime.value;
  const startTime = new Date(`${dateStr}T${timeStr}:00`);

  // Calculate duration and speed
  const distanceKm = state.totalDistance;
  const durationHours = distanceKm / config.avgSpeed;
  const durationSeconds = durationHours * 3600;

  // Generate GPS track points along the route
  const trackPoints = generateTrackPoints(startTime, durationSeconds, config);

  // Calculate actual stats from generated points
  const actualDistance = calculateTrackDistance(trackPoints);
  const actualDuration = durationSeconds;
  const calories = Math.round(config.met * weight * durationHours);
  const steps =
    config.strideLength > 0
      ? Math.round((distanceKm * 1000) / config.strideLength)
      : 0;

  // Build GPX XML
  const gpx = buildGPX(trackPoints, {
    activity,
    distance: actualDistance,
    duration: actualDuration,
    calories,
    steps,
    startTime,
  });

  state.gpxData = gpx;
  elements.downloadGpxBtn.disabled = false;
  elements.downloadGpxBtnMobile.disabled = false;

  showToast(`GPX berhasil dibuat! ${trackPoints.length} GPS points`, "success");

  // Log for verification
  console.log("=== GPX Generated ===");
  console.log(`Distance: ${(actualDistance / 1000).toFixed(2)} km`);
  console.log(`Duration: ${Math.round(actualDuration / 60)} minutes`);
  console.log(`GPS Points: ${trackPoints.length}`);
  console.log(`Calories: ${calories}`);
}

// ===================================
// Generate Track Points
// ===================================
function generateTrackPoints(startTime, totalDuration, config) {
  const points = [];
  const waypoints = state.waypoints;

  if (waypoints.length < 2) return points;

  // Calculate total distance
  const totalDistanceKm = state.totalDistance;
  const totalDistanceM = totalDistanceKm * 1000;

  // Speed in m/s
  const speedMs = (config.avgSpeed * 1000) / 3600;

  // GPS interval
  const gpsInterval = config.gpsInterval;

  // Generate points along the path
  let currentTime = new Date(startTime);
  let accumulatedDistance = 0;
  let currentSegment = 0;
  let segmentProgress = 0;

  // Calculate segment distances
  const segments = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dist =
      haversineDistance(
        waypoints[i].lat,
        waypoints[i].lon,
        waypoints[i + 1].lat,
        waypoints[i + 1].lon
      ) * 1000; // in meters
    segments.push({
      startLat: waypoints[i].lat,
      startLon: waypoints[i].lon,
      endLat: waypoints[i + 1].lat,
      endLon: waypoints[i + 1].lon,
      distance: dist,
    });
  }

  const totalSegmentDistance = segments.reduce((sum, s) => sum + s.distance, 0);

  // Add first point
  points.push({
    lat: waypoints[0].lat,
    lon: waypoints[0].lon,
    ele: generateElevation(0, totalDistanceM),
    hr: config.hrMin - 5, // Starting HR (before warm-up)
    time: new Date(currentTime),
  });

  // Generate points at GPS intervals
  let distanceCovered = 0;
  const distancePerInterval = speedMs * gpsInterval;

  while (distanceCovered < totalSegmentDistance - 1) {
    // Move by one interval
    distanceCovered += distancePerInterval;
    currentTime = new Date(currentTime.getTime() + gpsInterval * 1000);

    // Find which segment we're in
    let segmentStart = 0;
    let currentSeg = null;
    let segmentIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      if (distanceCovered <= segmentStart + segments[i].distance) {
        currentSeg = segments[i];
        segmentIndex = i;
        break;
      }
      segmentStart += segments[i].distance;
    }

    if (!currentSeg) {
      currentSeg = segments[segments.length - 1];
      segmentIndex = segments.length - 1;
      segmentStart = totalSegmentDistance - currentSeg.distance;
    }

    // Calculate position within segment
    const segmentDistance = distanceCovered - segmentStart;
    const segmentRatio = Math.min(1, segmentDistance / currentSeg.distance);

    // Interpolate position - EXACT position, no noise to preserve distance
    const lat =
      currentSeg.startLat +
      (currentSeg.endLat - currentSeg.startLat) * segmentRatio;
    const lon =
      currentSeg.startLon +
      (currentSeg.endLon - currentSeg.startLon) * segmentRatio;

    // NO GPS noise - keeps distance accurate
    // Real GPS watches have noise but it averages out
    // Adding noise here would double the reported distance

    // Generate elevation
    const ele = generateElevation(distanceCovered, totalSegmentDistance);

    // Generate heart rate
    const hr = generateHeartRate(
      distanceCovered,
      totalSegmentDistance,
      config,
      points.length
    );

    points.push({ lat, lon, ele, hr, time: new Date(currentTime) });
  }

  // Add final point at exact end position
  const lastWp = waypoints[waypoints.length - 1];
  currentTime = new Date(startTime.getTime() + totalDuration * 1000);
  points.push({
    lat: lastWp.lat,
    lon: lastWp.lon,
    ele: generateElevation(totalSegmentDistance, totalSegmentDistance),
    hr: config.hrMin, // Cool down HR at end
    time: new Date(currentTime),
  });

  return points;
}

// ===================================
// Generate Elevation
// ===================================
function generateElevation(distance, totalDistance) {
  // Simple elevation profile with some variation
  const baseElevation = 25; // meters (typical for Karawang area)
  const maxVariation = 10;

  // Sinusoidal variation
  const progress = distance / totalDistance;
  const variation = Math.sin(progress * Math.PI * 4) * maxVariation;

  // Add small random noise
  const noise = (Math.random() - 0.5) * 2;

  return Math.round(baseElevation + variation + noise);
}

// ===================================
// Generate Heart Rate
// ===================================
function generateHeartRate(distance, totalDistance, config, pointIndex) {
  const { hrMin, hrMax, hrAvg } = config;
  const progress = distance / totalDistance;

  // Warm-up phase (first 10%) - HR gradually increases
  if (progress < 0.1) {
    const warmupProgress = progress / 0.1;
    const startHR = hrMin - 10;
    return Math.round(startHR + (hrAvg - startHR) * warmupProgress);
  }

  // Cool-down phase (last 10%) - HR gradually decreases
  if (progress > 0.9) {
    const cooldownProgress = (progress - 0.9) / 0.1;
    return Math.round(hrAvg - (hrAvg - hrMin) * cooldownProgress);
  }

  // Main activity phase - realistic variation
  // Use sine waves with different frequencies for natural variation
  const wave1 = Math.sin(progress * Math.PI * 8) * 5;
  const wave2 = Math.sin(progress * Math.PI * 15 + pointIndex * 0.1) * 3;
  const randomNoise = (Math.random() - 0.5) * 6;

  let hr = hrAvg + wave1 + wave2 + randomNoise;

  // Occasional spikes (simulating hills or effort bursts)
  if (Math.random() < 0.05) {
    hr += Math.random() * 10;
  }

  // Clamp to min/max range
  hr = Math.max(hrMin, Math.min(hrMax, hr));

  return Math.round(hr);
}

// ===================================
// Calculate Track Distance
// ===================================
function calculateTrackDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
  }
  return total * 1000; // return in meters
}

// ===================================
// Build GPX XML
// ===================================
function buildGPX(trackPoints, meta) {
  const activityNames = {
    walking: "Walking",
    running: "Running",
    cycling: "Cycling",
  };

  const formatTime = (date) => date.toISOString();

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${
      activityNames[meta.activity]
    } - ${meta.startTime.toLocaleDateString()}</name>
    <time>${formatTime(meta.startTime)}</time>
  </metadata>
  <trk>
    <name>${activityNames[meta.activity]}</name>
    <type>${meta.activity}</type>
    <trkseg>
`;

  for (const pt of trackPoints) {
    gpx += `      <trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lon.toFixed(7)}">
        <ele>${pt.ele}</ele>
        <time>${formatTime(pt.time)}</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>${pt.hr}</gpxtpx:hr>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
`;
  }

  gpx += `    </trkseg>
  </trk>
</gpx>`;

  return gpx;
}

// ===================================
// Download GPX
// ===================================
function downloadGPX() {
  if (!state.gpxData) {
    showToast("Generate GPX terlebih dahulu", "error");
    return;
  }

  const activity = elements.activityType.value;
  const date = elements.activityDate.value;
  const filename = `${activity}_${date}.gpx`;

  const blob = new Blob([state.gpxData], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`File ${filename} didownload`, "success");
}

// ===================================
// Save Route to LocalStorage
// ===================================
function saveRoute() {
  if (state.waypoints.length === 0) {
    showToast("Tidak ada waypoint untuk disimpan", "error");
    return;
  }

  const routeData = state.waypoints.map((wp) => ({
    lat: wp.lat,
    lon: wp.lon,
  }));

  localStorage.setItem("savedRoute", JSON.stringify(routeData));
  showToast(`Rute disimpan! (${routeData.length} waypoints)`, "success");
}

// ===================================
// Load Route from LocalStorage
// ===================================
function loadRoute() {
  const saved = localStorage.getItem("savedRoute");
  if (!saved) {
    showToast("Tidak ada rute tersimpan", "error");
    return;
  }

  // Clear existing waypoints first
  state.waypoints.forEach((wp) => state.map.removeLayer(wp.marker));
  state.waypoints = [];

  // Load saved waypoints
  const routeData = JSON.parse(saved);
  routeData.forEach((point) => {
    addWaypoint(point.lat, point.lon);
  });

  showToast(`Rute dimuat! (${routeData.length} waypoints)`, "success");
}

// ===================================
// Auto-load saved route on startup
// ===================================
function loadSavedRoute() {
  const saved = localStorage.getItem("savedRoute");
  if (saved) {
    try {
      const routeData = JSON.parse(saved);
      routeData.forEach((point) => {
        addWaypoint(point.lat, point.lon);
      });
      console.log(`Auto-loaded ${routeData.length} waypoints`);
    } catch (e) {
      console.log("Failed to auto-load route");
    }
  }
}

// ===================================
// Toast Notifications
// ===================================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add("show"), 10);

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===================================
// PWA Install Prompt
// ===================================
let deferredPrompt = null;

function initInstallPrompt() {
  const installBanner = document.getElementById("install-banner");
  const installBtn = document.getElementById("install-btn");
  const installDismiss = document.getElementById("install-dismiss");

  // Check if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true) {
    console.log('App already installed');
    return;
  }

  // Check if dismissed recently
  const dismissedTime = localStorage.getItem('installDismissed');
  if (dismissedTime) {
    const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
    if (hoursSinceDismissed < 24) {
      console.log('Install banner dismissed recently');
      return;
    }
  }

  // Listen for beforeinstallprompt (Chrome, Edge, Android)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install banner
    if (installBanner) {
      installBanner.style.display = 'flex';
    }
    
    console.log('Install prompt ready');
  });

  // Handle install button click
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        // Chrome/Android install prompt
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          showToast('Aplikasi berhasil diinstall! 🎉', 'success');
        }
        
        deferredPrompt = null;
        installBanner.style.display = 'none';
      } else if (isIOS()) {
        // Show iOS instructions
        showIOSInstallInstructions();
      }
    });
  }

  // Handle dismiss button
  if (installDismiss) {
    installDismiss.addEventListener('click', () => {
      installBanner.style.display = 'none';
      localStorage.setItem('installDismissed', Date.now().toString());
    });
  }

  // For iOS - show banner with instructions
  if (isIOS() && !window.navigator.standalone) {
    setTimeout(() => {
      if (installBanner) {
        installBanner.style.display = 'flex';
      }
    }, 2000);
  }

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    showToast('GPX Generator terinstall! 🎉', 'success');
    installBanner.style.display = 'none';
    deferredPrompt = null;
  });
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function showIOSInstallInstructions() {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'ios-install-modal';
  modal.innerHTML = `
    <div class="ios-install-content">
      <h3>📲 Install GPX Generator</h3>
      <div class="ios-install-steps">
        <div class="ios-step">
          <span class="ios-step-icon">1️⃣</span>
          <span class="ios-step-text">Tap tombol <strong>Share</strong> di Safari (ikon kotak dengan panah)</span>
        </div>
        <div class="ios-step">
          <span class="ios-step-icon">2️⃣</span>
          <span class="ios-step-text">Scroll ke bawah dan tap <strong>"Add to Home Screen"</strong></span>
        </div>
        <div class="ios-step">
          <span class="ios-step-icon">3️⃣</span>
          <span class="ios-step-text">Tap <strong>"Add"</strong> di pojok kanan atas</span>
        </div>
      </div>
      <button class="ios-close-btn">Mengerti</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Close modal
  modal.querySelector('.ios-close-btn').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ===================================
// Initialize on DOM Ready
// ===================================
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  initInstallPrompt();
});

// Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
