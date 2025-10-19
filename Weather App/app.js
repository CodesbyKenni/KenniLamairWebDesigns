// ------- Element refs --------
const els = {
q: document.getElementById('q'),
form: document.getElementById('searchForm'),
geo: document.getElementById('geoBtn'),
uC: document.getElementById('uC'),
uF: document.getElementById('uF'),
loading: document.getElementById('loading'),
place: document.getElementById('place'),
temp: document.getElementById('temp'),
feels: document.getElementById('feels'),
hum: document.getElementById('hum'),
wind: document.getElementById('wind'),
pp: document.getElementById('pp'),
updated: document.getElementById('updated'),
summary: document.getElementById('summary'),
forecast: document.getElementById('forecast'),
};

let units = localStorage.getItem('units') || 'c'; // 'c' or 'f'

const WX = {
codeToDesc(code){
const map = {
0:['☀️','Clear sky'], 1:['🌤️','Mainly clear'], 2:['⛅','Partly cloudy'], 3:['☁️','Overcast'],
45:['🌫️','Fog'], 48:['🌫️','Depositing rime fog'],
51:['🌦️','Light drizzle'], 53:['🌦️','Drizzle'], 55:['🌧️','Dense drizzle'],
56:['🌧️','Freezing drizzle'], 57:['🌧️','Dense freezing drizzle'],
61:['🌦️','Light rain'], 63:['🌧️','Rain'], 65:['🌧️','Heavy rain'],
66:['🌧️','Freezing rain'], 67:['🌧️','Heavy freezing rain'],
71:['🌨️','Light snow'], 73:['🌨️','Snow'], 75:['❄️','Heavy snow'],
77:['🌨️','Snow grains'],
80:['🌦️','Rain showers'], 81:['🌧️','Rain showers'], 82:['🌧️','Violent rain showers'],
85:['🌨️','Snow showers'], 86:['❄️','Heavy snow showers'],
95:['⛈️','Thunderstorm'], 96:['⛈️','Thunderstorm w/ hail'], 99:['⛈️','Thunderstorm w/ heavy hail'],
};
return map[code] || ['🌡️','Weather'];
},
fmtTemp: t => (t == null ? '—' : `${Math.round(t)}°`),
fmtPct: p => (p == null ? '—' : `${Math.round(p)}%`),
fmtWind: w => (w == null ? '—' : `${Math.round(w)} ${units==='f'?'mph':'km/h'}`),
fmtTime(s){ try{ return new Date(s).toLocaleString([], {hour:'2-digit', minute:'2-digit'});}catch{ return '—'; } },
fmtDate(s){ try{ return new Date(s + 'T00:00:00').toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});}catch{ return '—'; } },
};

function setUnits(u){
units = u;
localStorage.setItem('units', u);
els.uC.setAttribute('aria-pressed', u==='c');
els.uF.setAttribute('aria-pressed', u==='f');
}

function showLoading(on){
els.loading.classList.toggle('show', !!on);
els.loading.setAttribute('aria-hidden', on? 'false':'true');
}

// ------- API Calls --------
async function geocodeCity(name){
const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
const r = await fetch(url);
if(!r.ok) throw new Error('Geocoding failed');
const data = await r.json();
if(!data.results || !data.results.length) throw new Error('No matching city found');
const g = data.results[0];
return {
name: `${g.name}${g.admin1 ? ', ' + g.admin1 : ''}${g.country ? ', ' + g.country : ''}`,
lat: g.latitude, lon: g.longitude, tz: g.timezone
};
}

async function forecast(lat, lon, tz){
const tempUnit = units === 'f' ? 'fahrenheit' : 'celsius';
const windUnit = units === 'f' ? 'mph' : 'kmh';
const url = new URL('https://api.open-meteo.com/v1/forecast');
url.search = new URLSearchParams({
latitude: lat, longitude: lon, timezone: tz || 'auto',
current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
temperature_unit: tempUnit, wind_speed_unit: windUnit
}).toString();
const r = await fetch(url.toString());
if(!r.ok) throw new Error('Forecast failed');
return r.json();
}

// ------- Render --------
function renderCurrent(placeLabel, data){
const cur = data.current;
const daily = data.daily;
const [emoji, desc] = WX.codeToDesc(cur.weather_code);
els.place.textContent = placeLabel;
els.temp.textContent = `${emoji} ${WX.fmtTemp(cur.temperature_2m)}`;
els.summary.textContent = desc;
els.feels.textContent = WX.fmtTemp(cur.apparent_temperature);
els.hum.textContent = WX.fmtPct(cur.relative_humidity_2m);
els.wind.textContent = WX.fmtWind(cur.wind_speed_10m);

const todayPP = daily?.precipitation_probability_max?.[0];
els.pp.textContent = WX.fmtPct(todayPP);

els.updated.textContent = new Date().toLocaleString();
}

function renderForecast(data){
const dts = data.daily.time;
const wxc = data.daily.weather_code;
const hi = data.daily.temperature_2m_max;
const lo = data.daily.temperature_2m_min;

els.forecast.innerHTML = dts.map((d,i)=>{
const [emoji, desc] = WX.codeToDesc(wxc[i]);
return `
<article class="day" aria-label="${desc} on ${WX.fmtDate(d)}">
<div class="dt">${WX.fmtDate(d)}</div>
<div class="wx" title="${desc}">${emoji}</div>
<div><span class="hi">${WX.fmtTemp(hi[i])}</span> <span class="lo">/ ${WX.fmtTemp(lo[i])}</span></div>
<div class="note">${desc}</div>
</article>
`;
}).join('');
}

async function loadByCity(name){
showLoading(true);
try{
const g = await geocodeCity(name);
const data = await forecast(g.lat, g.lon, g.tz);
renderCurrent(g.name, data);
renderForecast(data);
localStorage.setItem('lastPlace', JSON.stringify(g));
}catch(err){
console.error(err);
alert('Sorry—could not find weather for that location.');
}finally{
showLoading(false);
}
}

async function loadByCoords(lat, lon){
showLoading(true);
try{
const data = await forecast(lat, lon, 'auto');
const label = `Your location · ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
renderCurrent(label, data);
renderForecast(data);
localStorage.setItem('lastPlace', JSON.stringify({name:label, lat, lon, tz:'auto'}));
}catch(err){
console.error(err);
alert('Unable to fetch location weather.');
}finally{
showLoading(false);
}
}

els.form.addEventListener('submit', (e)=>{
e.preventDefault();
const v = els.q.value.trim();
if(v) loadByCity(v);
});

els.geo.addEventListener('click', ()=>{
if(!navigator.geolocation){ alert('Geolocation not supported.'); return; }
navigator.geolocation.getCurrentPosition(
pos => loadByCoords(pos.coords.latitude, pos.coords.longitude),
() => alert('Permission denied for location.')
);
});

els.uC.addEventListener('click', ()=>{ if(units!=='c'){ setUnits('c'); restoreOrRefresh(); }});
els.uF.addEventListener('click', ()=>{ if(units!=='f'){ setUnits('f'); restoreOrRefresh(); }});

function restoreOrRefresh(){
const saved = localStorage.getItem('lastPlace');
if(saved){
const g = JSON.parse(saved);
forecast(g.lat, g.lon, g.tz).then(data=>{
renderCurrent(g.name, data);
renderForecast(data);
}).catch(()=>{});
}
}

// Init
(function init(){
setUnits(units);
const saved = localStorage.getItem('lastPlace');
if(saved){
const g = JSON.parse(saved);
forecast(g.lat, g.lon, g.tz).then(data=>{
renderCurrent(g.name, data);
renderForecast(data);
}).catch(()=> loadByCity('Baltimore'));
}else{
if(navigator.geolocation){
navigator.geolocation.getCurrentPosition(
pos => loadByCoords(pos.coords.latitude, pos.coords.longitude),
() => loadByCity('Baltimore')
);
}else{
loadByCity('Baltimore');
}
}
})();