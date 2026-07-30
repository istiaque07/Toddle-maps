if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(function() { console.log('Service Worker Registered'); })
        .catch(function(err) { console.error('Service Worker Failed:', err); });
}

var map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'osm-tiles': {
                type: 'raster',
                tiles: [
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
        },
        layers: [
            {
                id: 'osm-raster',
                type: 'raster',
                source: 'osm-tiles',
                minzoom: 0,
                maxzoom: 19
            }
        ]
    },
    center: [90.4125, 23.8103],
    zoom: 7,
    maxZoom: 19
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

map.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserLocation: true
}), 'bottom-right');

var searchBox = document.getElementById('search-box');
var searchBtn = document.getElementById('search-btn');
var searchResults = document.getElementById('search-results');
var searchTimeout;
var lastResults = [];

searchBox.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    lastResults = [];
    var query = searchBox.value.trim();
    if (!query || query.length < 3) {
        searchResults.innerHTML = '';
        return;
    }
    searchTimeout = setTimeout(function() {
        searchPlaces(query);
    }, 500);
});

function selectFirstResult() {
    var query = searchBox.value.trim();
    if (!query || query.length < 3) return;
    clearTimeout(searchTimeout);
    if (lastResults.length > 0) {
        flyToResult(lastResults[0]);
    } else {
        searchPlaces(query);
    }
}

searchBox.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        selectFirstResult();
    }
});

searchBtn.addEventListener('click', function() {
    selectFirstResult();
});

searchBox.addEventListener('blur', function() {
    setTimeout(function() {
        searchResults.innerHTML = '';
        searchBox.value = '';
    }, 300);
});

function flyToResult(item) {
    var coords = [parseFloat(item.lon), parseFloat(item.lat)];
    map.flyTo({ center: coords, zoom: 15 });
    searchResults.innerHTML = '';
    lastResults = [];
    searchBox.value = '';
}

function searchPlaces(query) {
    var status = document.getElementById('status');
    status.textContent = 'Searching...';
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(query);
    fetch(url, {
        headers: { 'User-Agent': 'OfflineMapApp/1.0' }
    })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            status.textContent = 'Map loaded — zoom and pan to cache tiles for offline use.';
            if (!data || data.length === 0) {
                lastResults = [];
                searchResults.innerHTML = '<div style="color:#999">No results found</div>';
                return;
            }
            lastResults = data;
            searchResults.innerHTML = '';
            data.forEach(function(item) {
                var div = document.createElement('div');
                div.textContent = item.display_name;
                div.addEventListener('click', function() {
                    flyToResult(item);
                });
                searchResults.appendChild(div);
            });
        })
        .catch(function(err) {
            status.textContent = 'Search failed — check your connection.';
            lastResults = [];
            searchResults.innerHTML = '<div style="color:#c00">Search error</div>';
        });
}

var markers = [];
var markMode = false;
var MARKERS_KEY = 'map-markers';

var markBtn = document.getElementById('mark-btn');
var saveBtn = document.getElementById('save-btn');
var clearBtn = document.getElementById('clear-btn');

markBtn.addEventListener('click', function() {
    markMode = !markMode;
    markBtn.classList.toggle('active', markMode);
    markBtn.textContent = markMode ? 'Cancel' : 'Mark';
});

saveBtn.addEventListener('click', downloadMarkersJSON);

clearBtn.addEventListener('click', clearAllMarkers);

map.on('click', function(e) {
    if (!markMode) return;
    createMarker(e.lngLat.lng, e.lngLat.lat);
    saveMarkersToStorage();
    updateInfo();
});

function createMarker(lng, lat, name, createdAt) {
    var markerData = {
        lng: lng,
        lat: lat,
        name: name || ('Marker ' + (markers.length + 1)),
        createdAt: createdAt || new Date().toISOString()
    };
    var popup = new maplibregl.Popup().setText(
        markerData.name + '\n(' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ')'
    );
    var marker = new maplibregl.Marker({ color: '#e74c3c' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);
    markerData.marker = marker;
    markers.push(markerData);
}

function saveMarkersToStorage() {
    var data = markers.map(function(m) {
        return { lng: m.lng, lat: m.lat, name: m.name, createdAt: m.createdAt };
    });
    localStorage.setItem(MARKERS_KEY, JSON.stringify(data));
}

function loadMarkersFromStorage() {
    var data = localStorage.getItem(MARKERS_KEY);
    if (!data) return;
    try {
        var saved = JSON.parse(data);
        saved.forEach(function(item) {
            createMarker(item.lng, item.lat, item.name, item.createdAt);
        });
    } catch(e) {
        console.error('Failed to load markers:', e);
    }
}

function downloadMarkersJSON() {
    var data = markers.map(function(m) {
        return { lng: m.lng, lat: m.lat, name: m.name, createdAt: m.createdAt };
    });
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'map-markers.json';
    a.click();
    URL.revokeObjectURL(url);
}

function clearAllMarkers() {
    markers.forEach(function(m) {
        if (m.marker) m.marker.remove();
    });
    markers = [];
    localStorage.removeItem(MARKERS_KEY);
    updateInfo();
}

function updateInfo() {
    var info = document.getElementById('info');
    info.textContent = markers.length > 0
        ? markers.length + ' marker(s) saved. Click "Save" to export as JSON.'
        : 'Zoom in on an area while online to cache tiles for offline use. Search requires an internet connection.';
}

map.on('load', function() {
    var status = document.getElementById('status');
    status.textContent = 'Map loaded — zoom and pan to cache tiles for offline use.';
    loadMarkersFromStorage();
    updateInfo();
});

map.on('tileload', function() {
    var status = document.getElementById('status');
    status.textContent = 'Tiles loaded — map is ready.';
});

map.on('tileerror', function(e) {
    var status = document.getElementById('status');
    status.textContent = 'Tile load error — offline if no internet, or tile not cached.';
});