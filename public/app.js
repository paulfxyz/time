import { THEMES, PATTERNS, FINISHES, CITIES } from './themes.js';
import { sunPosition, solarElevation, solarPhase, sunTimes, zonedParts, clamp } from './solar.js';
import { Earth } from './earth.js';
import { renderIcons, setIcon } from './icons.js';
import { PICTURE_DEFAULTS, PICTURE_LIMITS, PICTURE_PRESETS, normalizePicture, pictureFilter, matchingPicturePreset } from './picture.js';
import { SCENES, SCENE_CATEGORIES, getScene, sceneMatches, sceneSettings } from './scenes.js';
import { Ambient } from './ambient.js';

const $ = selector => document.querySelector(selector);
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const systemMode = matchMedia('(prefers-color-scheme: dark)');
let deviceZone = 'Europe/Lisbon';
try { deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || deviceZone; } catch {}
const deviceCity = CITIES.find(c => c.zone === deviceZone && c.id !== 'utc') || {
  id: 'device', name: deviceZone === 'UTC' ? 'UTC' : deviceZone.split('/').pop().replaceAll('_', ' '),
  country: 'Device time zone', zone: deviceZone, lat: null, lon: null,
};
const defaults = {
  theme: 'observatory', mode: systemMode.matches ? 'dark' : 'light', pattern: 'stars',
  finish: 0, city: deviceCity.id, timezone: deviceCity.zone, rotation: reducedMotion.matches ? 0 : 240,
  format: '24', seconds: true, labels: true, lights: true, grid: false, world: true,
  layout: 'auto', accent: null, scene: 'observatory', effects: true,
  ...PICTURE_DEFAULTS,
};
let state = loadState();
let selectedCity = resolveCity(state.city, state.timezone);
let lastPeriod = state.rotation || 240;
let quiet = false;
let fallbackFullscreen = false;
let installPrompt = null;
let pictureSaveTimer;
let noticeTimeout;
let wakeLock = null;
let awakeRequested = false;
let solarCache = null;
let lastSecond = '';
let lastModeManual = Boolean(new URLSearchParams(location.hash.slice(1) || storedSetup()).get('mode'));
let sceneCategory = 'All';
let nativeFullscreen = false;
const isNative = Boolean(window.timescreenNative?.available);
const postNative = (command, value) => {
  if (!isNative) return false;
  try { window.webkit.messageHandlers.timescreen.postMessage({ command, value }); return true; }
  catch { return false; }
};
const formatterCache = new Map();

function resolveCity(id, zone) {
  const found = CITIES.find(c => c.id === id);
  if (found) return found;
  if (id === 'device' && validZone(zone)) {
    return { id: 'device', name: zone === 'UTC' ? 'UTC' : zone.split('/').pop().replaceAll('_', ' '), country: 'Device time zone', zone, lat: null, lon: null };
  }
  return deviceCity;
}

function validZone(zone) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; } catch { return false; }
}

function storedSetup() {
  try { return localStorage.getItem('timescreen:setup:v2') || ''; } catch { return ''; }
}
function loadState(query = location.hash.slice(1) || storedSetup()) {
  const params = new URLSearchParams(query);
  const value = { ...defaults };
  if (SCENES.some(s => s.id === params.get('scene'))) {
    Object.assign(value, sceneSettings(params.get('scene')));
    const sceneTheme = THEMES.find(t => t.id === value.theme);
    value.pattern = sceneTheme.pattern; value.finish = sceneTheme.style;
  }
  const theme = THEMES.find(t => t.id === params.get('theme'));
  if (theme) { value.theme = theme.id; value.pattern = theme.pattern; value.finish = theme.style; }
  if (['light', 'dark'].includes(params.get('mode'))) value.mode = params.get('mode');
  if (PATTERNS.some(p => p[0] === params.get('pattern'))) value.pattern = params.get('pattern');
  if (FINISHES.some(f => f[0] === params.get('finish'))) value.finish = Number(params.get('finish'));
  if (['0', '60', '120', '240', '600'].includes(params.get('rotation'))) value.rotation = Number(params.get('rotation'));
  if (['12', '24'].includes(params.get('format'))) value.format = params.get('format');
  if (['auto', 'wide', 'vertical'].includes(params.get('layout'))) value.layout = params.get('layout');
  for (const key of ['seconds','labels','lights','grid','world','effects']) {
    if (params.has(key)) value[key] = params.get(key) !== '0';
  }
  if (CITIES.some(c => c.id === params.get('city'))) {
    value.city = params.get('city');
    value.timezone = CITIES.find(c => c.id === value.city).zone;
  } else if (params.get('city') === 'device' && validZone(params.get('zone'))) {
    value.city = 'device';
    value.timezone = params.get('zone');
  }
  if (/^#[0-9a-f]{6}$/i.test(params.get('accent') || '')) value.accent = params.get('accent');
  Object.assign(value, normalizePicture(Object.fromEntries(
    Object.keys(PICTURE_LIMITS).map(key => [key, params.get(key)]))));
  return value;
}

function serializeState() {
  const p = new URLSearchParams();
  for (const key of ['scene','theme','mode','pattern','finish','rotation','format','layout','city']) p.set(key, String(state[key]));
  for (const key of ['seconds','labels','lights','grid','world','effects']) p.set(key, state[key] ? '1' : '0');
  if (state.city === 'device') p.set('zone', state.timezone);
  if (state.accent) p.set('accent', state.accent);
  for (const key of Object.keys(PICTURE_LIMITS)) p.set(key, String(state[key]));
  return p.toString();
}

function saveState() {
  try { history.replaceState(null, '', `#${serializeState()}`); } catch {}
  try { localStorage.setItem('timescreen:setup:v2', serializeState()); } catch {}
  postNative('saveSetup', serializeState());
}

function notice(message) {
  clearTimeout(noticeTimeout);
  $('#notice').textContent = message;
  $('#notice').classList.add('visible');
  noticeTimeout = setTimeout(() => $('#notice').classList.remove('visible'), 6500);
}

function colorRGB(hex) {
  return [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16));
}
function colorHex(rgb) { return `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`; }
function luminance(hex) {
  const c = colorRGB(hex).map(v => {
    const s = v / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  });
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function readableColor(color, background, minimum = 4.5) {
  const bg = luminance(background);
  let current = color;
  for (let i = 0; i < 18; i++) {
    const fg = luminance(current);
    if ((Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05) >= minimum) return current;
    const target = bg > .5 ? 0 : 255;
    current = colorHex(colorRGB(current).map(v => v + (target - v) * .09));
  }
  return current;
}

const earth = new Earth($('#earth-canvas'), $('#earth-viewport'), notice);
const ambient = new Ambient($('#ambient-canvas'));

function applyAppearance() {
  const theme = THEMES.find(t => t.id === state.theme) || THEMES[0];
  const palette = theme[state.mode];
  const [background, foreground, rawMuted, rawAccent, surface] = palette;
  const accent = state.accent || rawAccent;
  const effectiveAccent = readableColor(accent, background);
  const scene = getScene(state.scene);
  root.dataset.scene = scene.id;
  root.dataset.composition = scene.composition;
  root.dataset.clock = scene.clock;
  root.dataset.effects = String(state.effects);
  root.dataset.theme = state.mode;
  root.style.setProperty('--color-bg', background);
  root.style.setProperty('--color-text', foreground);
  root.style.setProperty('--color-muted', readableColor(rawMuted, background));
  root.style.setProperty('--color-primary', effectiveAccent);
  root.style.setProperty('--color-surface', surface);
  $('meta[name="theme-color"]').content = background;
  $('#app').dataset.layout = state.layout;
  document.body.classList.toggle('no-world', !state.world);
  document.body.classList.toggle('no-seconds', !state.seconds);
  $('#clock-seconds').hidden = !state.seconds;
  $('#clock-period').hidden = state.format === '24';
  $('#clock-seconds').parentElement.hidden = !state.seconds && state.format === '24';
  setIcon($('#light-button [data-icon]'), state.mode === 'dark' ? 'moon' : 'sun');
  $('#active-theme-name').textContent = theme.name;
  $('#accent-color').value = accent;
  $('#accent-value').textContent = accent.toUpperCase();
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  document.querySelectorAll('.theme-card').forEach(button => {
    const item = THEMES.find(t => t.id === button.dataset.theme);
    const colors = item[state.mode];
    button.style.setProperty('--preview-bg', colors[0]);
    button.style.setProperty('--preview-fg', colors[1]);
    button.style.setProperty('--preview-accent', colors[3]);
    button.setAttribute('aria-pressed', String(item.id === state.theme));
  });
  document.querySelectorAll('.pattern-button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pattern === state.pattern)));
  $('#globe-finish').value = String(state.finish);
  $('#rotation-speed').value = String(state.rotation);
  $('#clock-format').value = state.format;
  $('#layout-select').value = state.layout;
  $('#show-labels').checked = state.labels;
  $('#show-lights').checked = state.lights;
  $('#show-grid').checked = state.grid;
  $('#show-seconds').checked = state.seconds;
  $('#show-world').checked = state.world;
  $('#show-effects').checked = state.effects;
  $('#scene-caption').textContent = scene.label;
  $('#current-scene-name').textContent = scene.name;
  document.querySelectorAll('.scene-card').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.scene === scene.id)));
  updateRotationControl();
  earth.update({
    style: state.finish, accent, lightMode: state.mode === 'light',
    period: state.rotation, grid: state.grid, lights: state.lights,
  });
  drawBackground();
  ambient.update(scene.effect, state.effects, effectiveAccent, state.mode === 'light');
  applyPicture();
  updateLabels();
  lastSecond = '';
  tick();
}

function applyPicture() {
  Object.assign(state, normalizePicture(state));
  root.style.setProperty('--picture-filter',
    state.brightness === 100 && state.contrast === 100 && state.saturation === 100
      ? 'none' : pictureFilter(state));
  root.style.setProperty('--temperature-colour', state.temperature >= 0 ? '#ffbd7b' : '#80b9ff');
  root.style.setProperty('--temperature-strength', String(Math.abs(state.temperature) / 180));
  for (const key of Object.keys(PICTURE_LIMITS)) {
    $(`#picture-${key}`).value = state[key];
    const label = key === 'temperature'
      ? state[key] === 0 ? 'Neutral' : `${Math.abs(state[key])} ${state[key] > 0 ? 'warm' : 'cool'}`
      : `${state[key]}%`;
    $(`#value-${key}`).textContent = label;
    $(`#picture-${key}`).setAttribute('aria-valuetext', label);
  }
  const preset = matchingPicturePreset(state);
  $('#picture-mode-name').textContent = PICTURE_PRESETS[preset]?.label || 'Custom';
  document.querySelectorAll('[data-picture]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.picture === preset)));
}

function toggleColourMode() {
  state.mode = state.mode === 'dark' ? 'light' : 'dark';
  lastModeManual = true;
  applyAppearance();
  saveState();
}

function updateRotationControl() {
  const running = state.rotation > 0;
  setIcon($('#rotation-button [data-icon]'), running ? 'pause' : 'play');
  $('#rotation-button').setAttribute('aria-label', running ? 'Pause rotation' : 'Resume rotation');
  $('#rotation-button').title = running ? 'Pause rotation (Space)' : 'Resume rotation (Space)';
  $('#rotation-label').textContent = !running ? 'Orbit paused' : state.rotation >= 600 ? 'Glacial orbit' : state.rotation >= 240 ? 'Slow orbit' : state.rotation >= 120 ? 'Drifting' : 'Exploring';
}

function toggleRotation() {
  if (state.rotation) { lastPeriod = state.rotation; state.rotation = 0; }
  else state.rotation = lastPeriod;
  earth.update({ period: state.rotation });
  $('#rotation-speed').value = String(state.rotation);
  updateRotationControl();
  saveState();
}

function buildSettings() {
  $('#theme-count').textContent = THEMES.length;
  $('#theme-match-count').textContent = THEMES.length;
  THEMES.forEach(theme => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-card';
    button.dataset.theme = theme.id;
    button.dataset.style = String(theme.style);
    button.dataset.testid = `theme-${theme.id}`;
    button.setAttribute('aria-label', `${theme.name} theme`);
    button.innerHTML = `<span class="theme-preview" aria-hidden="true"></span><span class="theme-name">${theme.name}</span>`;
    button.addEventListener('click', () => {
      state.theme = theme.id;
      state.pattern = theme.pattern;
      state.finish = theme.style;
      state.accent = null;
      applyAppearance();
      saveState();
    });
    $('#theme-grid').append(button);
  });
  PATTERNS.forEach(([id, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pattern-button';
    button.dataset.pattern = id;
    button.dataset.testid = `pattern-${id}`;
    button.textContent = label;
    button.addEventListener('click', () => {
      state.pattern = id;
      applyAppearance();
      saveState();
    });
    $('#pattern-grid').append(button);
  });
  FINISHES.forEach(([id, name]) => $('#globe-finish').add(new Option(name, id)));
  $('#scene-count').textContent = SCENES.length;
  for (const scene of SCENES) {
    const palette = THEMES.find(t => t.id === scene.theme)[scene.mode];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scene-card';
    button.dataset.scene = scene.id;
    button.dataset.testid = `scene-${scene.id}`;
    button.setAttribute('aria-label', `${scene.name} style`);
    button.style.setProperty('--scene-bg', palette[0]);
    button.style.setProperty('--scene-fg', palette[1]);
    button.style.setProperty('--scene-accent', palette[3]);
    const preview = document.createElement('span');
    preview.className = 'scene-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.dataset.clock = scene.clock;
    preview.innerHTML = '<span class="mini-clock"><span>10</span><b>:</b><span>08</span></span><span class="mini-earth"></span>';
    const name = document.createElement('span');
    name.className = 'scene-name';
    name.textContent = scene.name;
    const description = document.createElement('span');
    description.className = 'scene-description';
    description.textContent = scene.description;
    button.append(preview, name, description);
    button.addEventListener('click', () => selectScene(scene.id));
    $('#scene-grid').append(button);
  }
  for (const category of SCENE_CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = category;
    button.dataset.category = category;
    button.dataset.testid = `category-${category.toLowerCase()}`;
    button.setAttribute('aria-pressed', String(category === 'All'));
    button.addEventListener('click', () => { sceneCategory = category; filterScenes(); });
    $('#scene-categories').append(button);
  }
}

function filterScenes() {
  let count = 0;
  const query = $('#scene-search').value;
  document.querySelectorAll('.scene-card').forEach(button => {
    button.hidden = !sceneMatches(getScene(button.dataset.scene), query, sceneCategory);
    if (!button.hidden) count++;
  });
  document.querySelectorAll('[data-category]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.category === sceneCategory)));
  $('#scene-match-count').textContent = count;
  $('#scene-empty').hidden = count > 0;
}

function selectScene(id) {
  Object.assign(state, sceneSettings(id));
  const theme = THEMES.find(t => t.id === state.theme);
  state.pattern = theme.pattern;
  state.finish = theme.style;
  lastModeManual = true;
  applyAppearance();
  saveState();
}

function nextScene(direction = 1) {
  const index = SCENES.findIndex(s => s.id === state.scene);
  selectScene(SCENES[(index + direction + SCENES.length) % SCENES.length].id);
  notice(getScene(state.scene).name);
}

function formatter(timezone, type = 'time') {
  const key = `${timezone}-${type}-${state.format}`;
  if (formatterCache.has(key)) return formatterCache.get(key);
  const options = type === 'date'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : type === 'offset'
      ? { timeZoneName: 'shortOffset' }
      : { hour: '2-digit', minute: '2-digit', hourCycle: state.format === '12' ? 'h12' : 'h23' };
  const result = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, ...options });
  formatterCache.set(key, result);
  return result;
}

function timeString(date, zone, period = true) {
  return formatter(zone).format(date).replace(/\s(am|pm)$/i, (_, p) => period ? ` ${p.toUpperCase()}` : '');
}
function offsetString(date, zone) {
  const part = formatter(zone, 'offset').formatToParts(date).find(p => p.type === 'timeZoneName')?.value || 'GMT';
  return part.replace('GMT', 'UTC').replace('−', '-');
}
function dayKey(date, zone) {
  const p = zonedParts(date, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

function tick() {
  const date = new Date();
  const second = Math.floor(date.getTime() / 1000);
  if (second === lastSecond) return;
  lastSecond = second;
  const parts = zonedParts(date, selectedCity.zone);
  const hour = Number(parts.hour);
  $('#clock-hours').textContent = state.format === '12' ? String(hour % 12 || 12).padStart(2, '0') : parts.hour;
  $('#clock-minutes').textContent = parts.minute;
  $('#clock-seconds').textContent = parts.second;
  $('#clock-period').textContent = state.format === '12' ? hour >= 12 ? 'PM' : 'AM' : '';
  $('.clock').setAttribute('aria-label', `${timeString(date, selectedCity.zone)}, ${parts.second} seconds, ${selectedCity.name}`);
  $('#clock-date').textContent = formatter(selectedCity.zone, 'date').format(date);
  $('#utc-offset').textContent = offsetString(date, selectedCity.zone);
  $('#city-name').textContent = selectedCity.name;
  $('#clock-eyebrow').textContent = selectedCity.zone === deviceZone ? 'YOUR LOCAL TIME' : 'A MOMENT IN';
  document.title = `${timeString(date, selectedCity.zone)} · ${selectedCity.name} · Time`;
  const sun = sunPosition(date);
  $('#solar-coordinates').textContent = `${Math.abs(sun.latitude).toFixed(1)}°${sun.latitude < 0 ? 'S' : 'N'}  ${Math.abs(sun.longitude).toFixed(1)}°${sun.longitude < 0 ? 'W' : 'E'}`;
  updateSunlight(date, parts, sun);
  updateWorldClocks(date, sun);
  markerItems.forEach(item => { item.time.textContent = timeString(date, item.city.zone, false); });
  if ($('#city-dialog').open) updateCityTimes(date);
}

function updateSunlight(date, parts, sun) {
  const valid = selectedCity.lat !== null;
  $('#sunlight-panel').hidden = !valid;
  if (!valid) return;
  const elevation = solarElevation(selectedCity.lat, selectedCity.lon, sun);
  const phase = solarPhase(elevation);
  $('#solar-phase').textContent = phase;
  $('#solar-phase').title = `Estimated solar elevation: ${elevation.toFixed(1)}°`;
  const icon = phase === 'Daylight' ? 'sun' : phase === 'Twilight' ? 'sunrise' : 'moon';
  if ($('#solar-icon').dataset.icon !== icon) setIcon($('#solar-icon'), icon);
  const cacheKey = `${selectedCity.id}-${parts.year}-${parts.month}-${parts.day}-${state.format}`;
  if (solarCache?.key !== cacheKey) {
    solarCache = { key: cacheKey, ...sunTimes(date, selectedCity.lat, selectedCity.lon, selectedCity.zone) };
    const { sunrise, sunset, daylight, polar } = solarCache;
    $('#sunrise-time').textContent = sunrise ? timeString(sunrise, selectedCity.zone) : 'No rise';
    $('#sunset-time').textContent = sunset ? timeString(sunset, selectedCity.zone) : 'No set';
    $('#sunrise-time').title = 'Estimated sunrise';
    $('#sunset-time').title = 'Estimated sunset';
    $('#daylight-duration').textContent = polar ? (polar === 'day' ? '24h daylight' : 'Polar night') : `${Math.floor(daylight)}h ${Math.round((daylight % 1) * 60)}m of light`;
    let start = 0;
    let end = polar === 'day' ? 100 : 0;
    if (sunrise && sunset) {
      const rise = zonedParts(sunrise, selectedCity.zone);
      const set = zonedParts(sunset, selectedCity.zone);
      start = (Number(rise.hour) * 60 + Number(rise.minute)) / 14.4;
      end = (Number(set.hour) * 60 + Number(set.minute)) / 14.4;
    }
    $('#daylight-window').style.left = `${start}%`;
    $('#daylight-window').style.width = `${Math.max(0, end - start)}%`;
    $('#day-track').setAttribute('aria-label', `Estimated daylight: ${$('#sunrise-time').textContent} to ${$('#sunset-time').textContent}`);
  }
  const progress = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) / 864;
  $('#day-track-now').style.left = `${progress}%`;
}

const worldCities = ['new-york','london','tokyo','sydney'].map(id => CITIES.find(c => c.id === id));
const worldItems = worldCities.map(city => {
  const button = document.createElement('button');
  button.className = 'world-city';
  button.dataset.testid = `world-${city.id}`;
  button.setAttribute('aria-label', `Show ${city.name} on the main clock`);
  button.innerHTML = `<span class="world-name"><span data-icon="sun"></span>${city.name}</span><span class="world-time"></span><span class="world-meta"></span>`;
  button.addEventListener('click', () => selectCity(city));
  $('#world-strip').append(button);
  return { city, element: button, time: button.querySelector('.world-time'), meta: button.querySelector('.world-meta'), icon: button.querySelector('[data-icon]') };
});

function updateWorldClocks(date, sun) {
  const localDate = dayKey(date, selectedCity.zone);
  worldItems.forEach(item => {
    const cityDate = dayKey(date, item.city.zone);
    const asDay = value => { const [y,m,d] = value.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    const difference = (asDay(cityDate) - asDay(localDate)) / 86400000;
    const relation = difference > 0 ? 'Tomorrow' : difference < 0 ? 'Yesterday' : 'Today';
    item.time.textContent = timeString(date, item.city.zone);
    item.meta.textContent = `${relation} · ${offsetString(date, item.city.zone)}`;
    const elev = solarElevation(item.city.lat, item.city.lon, sun);
    const icon = elev >= -0.833 ? 'sun' : elev >= -6 ? 'sunrise' : 'moon';
    if (item.icon.dataset.icon !== icon) setIcon(item.icon, icon);
    item.element.title = `${item.city.name}: ${solarPhase(elev)}. Click to use this city.`;
  });
}

const markerCities = ['lisbon','new-york','los-angeles','sao-paulo','cape-town','dubai','mumbai','singapore','tokyo','sydney','auckland'];
function createMarker(city) {
  const button = document.createElement('button');
  button.className = 'globe-label';
  button.dataset.testid = `globe-${city.id}`;
  button.setAttribute('aria-label', `Show ${city.name} time`);
  button.innerHTML = `<span>${city.name}</span><small></small>`;
  button.addEventListener('click', () => selectCity(city));
  $('#globe-labels').append(button);
  return { city, button, time: button.querySelector('small') };
}
const markerItems = markerCities.map(id => createMarker(CITIES.find(c => c.id === id)));
if (selectedCity.lat !== null && !markerItems.some(item => item.city.id === selectedCity.id)) markerItems.push(createMarker(selectedCity));

function updateLabels() {
  const bounds = [];
  let count = 0;
  const max = earth.width < 350 ? 2 : 4;
  const ordered = [...markerItems].sort((a, b) => Number(b.city.id === selectedCity.id) - Number(a.city.id === selectedCity.id));
  for (const item of ordered) {
    const point = earth.project(item.city.lat, item.city.lon);
    const selected = item.city.id === selectedCity.id;
    item.button.classList.toggle('selected', selected);
    let visible = state.labels && earth.ready && point.depth > 0.35 && count < max;
    const width = item.button.offsetWidth || 125;
    const leftSide = point.x > earth.width * 0.58;
    const x = leftSide ? point.x - width + 10 : point.x;
    const y = point.y;
    const rect = { left: x - 8, right: x + width + 6, top: y - 18, bottom: y + 26 };
    if (visible && (rect.left < 0 || rect.right > earth.width || rect.top < 0 || rect.bottom > earth.height)) visible = false;
    if (visible && bounds.some(b => rect.left < b.right && rect.right > b.left && rect.top < b.bottom && rect.bottom > b.top)) visible = false;
    item.button.classList.toggle('label-left', leftSide);
    item.button.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    item.button.style.opacity = visible ? String(clamp((point.depth - .30) / .15, 0, 1)) : '0';
    item.button.style.pointerEvents = visible ? 'auto' : 'none';
    item.button.tabIndex = visible ? 0 : -1;
    item.button.setAttribute('aria-hidden', String(!visible));
    if (visible) { bounds.push(rect); count++; }
  }
}
earth.onFrame = updateLabels;

function selectCity(city) {
  selectedCity = city;
  state.city = city.id;
  state.timezone = city.zone;
  if (city.lat !== null && !markerItems.some(item => item.city.id === city.id)) markerItems.push(createMarker(city));
  solarCache = null;
  lastSecond = '';
  tick();
  if (city.lat !== null) earth.recenter(city, reducedMotion.matches);
  $('#city-dialog').close();
  document.querySelectorAll('.city-option').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.city === city.id)));
  saveState();
}

function buildCityList() {
  CITIES.forEach(city => {
    const button = document.createElement('button');
    button.className = 'city-option';
    button.dataset.city = city.id;
    button.dataset.testid = `city-${city.id}`;
    button.dataset.search = normalized(`${city.name} ${city.country} ${city.zone}`);
    button.innerHTML = `<span>${city.name}</span><small>${city.country}</small><time></time>`;
    button.setAttribute('aria-pressed', String(city.id === selectedCity.id));
    button.addEventListener('click', () => selectCity(city));
    $('#city-list').append(button);
  });
  $('#device-zone-label').textContent = deviceZone.replaceAll('_', ' ');
}
function updateCityTimes(date) {
  document.querySelectorAll('.city-option').forEach(button => {
    if (!button.hidden) button.querySelector('time').textContent = timeString(date, CITIES.find(c => c.id === button.dataset.city).zone);
  });
}
function normalized(text) { return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function openDialog(id) {
  const dialog = $(`#${id}`);
  if (!dialog.open) dialog.showModal();
  if (id === 'city-dialog') {
    $('#city-search').value = '';
    $('#city-search').dispatchEvent(new Event('input'));
    updateCityTimes(new Date());
    $('#city-search').focus();
  }
}

function setQuiet(value) {
  quiet = value;
  document.body.classList.toggle('quiet', quiet);
  document.querySelectorAll('.chrome').forEach(element => { element.inert = quiet; });
  if (quiet) $('#restore-button').focus({ preventScroll: true });
  else $('#fullscreen-button').focus({ preventScroll: true });
}

async function toggleFullscreen() {
  if (postNative('fullscreen')) return;
  const native = nativeFullscreenElement();
  if (native) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    try { if (exit) await exit.call(document); } catch { notice('Use your browser’s fullscreen exit command.'); }
    fallbackFullscreen = false;
    setQuiet(false);
    syncFullscreenControl();
    return;
  }
  if (fallbackFullscreen) {
    fallbackFullscreen = false;
    setQuiet(false);
    syncFullscreenControl();
    return;
  }
  if (isStandalone()) {
    fallbackFullscreen = true;
    syncFullscreenControl();
    notice('This window already runs in a standalone or fullscreen display. Use H or Quiet mode to hide page controls.');
    return;
  }
  const element = document.documentElement;
  const request = element.requestFullscreen || element.webkitRequestFullscreen;
  const permitted = element.requestFullscreen
    ? document.fullscreenEnabled !== false
    : document.webkitFullscreenEnabled !== false;
  if (request && permitted) {
    try {
      // Kept inside the original click gesture for mobile permission policies.
      const result = element.requestFullscreen
        ? element.requestFullscreen({ navigationUI: 'hide' })
        : element.webkitRequestFullscreen();
      if (result?.then) await result;
      syncFullscreenControl();
      return;
    } catch {}
  }
  fallbackFullscreen = true;
  syncFullscreenControl();
  showFullscreenHelp(true);
}

function nativeFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches
    || (matchMedia('(display-mode: fullscreen)').matches && !nativeFullscreenElement())
    || navigator.standalone === true;
}
function syncFullscreenControl() {
  const active = nativeFullscreen || Boolean(nativeFullscreenElement()) || fallbackFullscreen;
  document.body.classList.toggle('display-active', active);
  setIcon($('#fullscreen-button [data-icon]'), active ? 'minimize' : 'maximize');
  const label = active ? 'Exit full screen' : 'Enter full screen';
  $('#fullscreen-label').textContent = label;
  $('#fullscreen-button').setAttribute('aria-label', label);
  $('#fullscreen-button').title = `${label} (F)`;
  $('#fullscreen-button').setAttribute('aria-pressed', String(active));
}
function showFullscreenHelp(blocked = false) {
  $('#appearance-dialog').close();
  $('#light-dialog').close();
  $('#fullscreen-status').textContent = isStandalone()
    ? 'You are already running as a home-screen app, without browser controls.'
    : blocked
      ? 'This browser does not allow native fullscreen here. The display still fills the page; use a home-screen app to remove browser controls.'
      : 'Use native fullscreen when available, or install Time as a home-screen app.';
  $('#install-button').hidden = !installPrompt;
  openDialog('fullscreen-dialog');
}

async function manageWakeLock() {
  if (isNative) {
    postNative('keepAwake', awakeRequested);
    return;
  }
  if (!awakeRequested) {
    if (wakeLock) await wakeLock.release().catch(() => {});
    wakeLock = null;
    $('#awake-status').textContent = '';
    return;
  }
  if (document.hidden) return;
  $('#awake-status').textContent = 'Requesting screen wake lock…';
  try {
    if (!navigator.wakeLock?.request) throw new Error('Unsupported');
    wakeLock = await navigator.wakeLock.request('screen');
    $('#awake-status').textContent = 'Screen wake lock is active while this page is visible.';
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
      if (awakeRequested) $('#awake-status').textContent = 'Wake lock was released. It will be requested again when this page is visible.';
    });
  } catch {
    awakeRequested = false;
    $('#keep-awake').checked = false;
    $('#awake-status').textContent = 'Screen wake lock is unavailable here. For a permanent display, adjust your device’s sleep settings.';
  }
}

function drawBackground() {
  const canvas = $('#background-canvas');
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const width = innerWidth;
  const height = innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const color = getComputedStyle(root).getPropertyValue('--color-primary').trim();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  let seed = 81731;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pattern = state.pattern;
  if (pattern === 'stars') {
    const count = Math.min(360, width * height / 7500);
    for (let i = 0; i < count; i++) {
      const x = random() * width;
      const y = random() * height;
      const radius = random() > .94 ? 1.15 : .45 + random() * .3;
      ctx.globalAlpha = .1 + random() * .25;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
  } else if (pattern === 'dots') {
    ctx.globalAlpha = .13;
    for (let x = 16; x < width; x += 28) for (let y = 16; y < height; y += 28) {
      ctx.beginPath(); ctx.arc(x, y, .7, 0, Math.PI * 2); ctx.fill();
    }
  } else if (pattern === 'grid') {
    ctx.globalAlpha = .08; ctx.lineWidth = .7;
    for (let x = 0; x <= width; x += 52) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  } else if (pattern === 'grain') {
    const count = Math.min(45000, width * height / 45);
    for (let i = 0; i < count; i++) { ctx.globalAlpha = random() * .12; ctx.fillRect(random() * width, random() * height, 1, 1); }
  } else if (pattern === 'linen') {
    ctx.globalAlpha = .04; ctx.lineWidth = .6;
    for (let x = 0; x < width; x += 5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 2, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y + 3); ctx.stroke(); }
  } else if (pattern === 'contours') {
    ctx.globalAlpha = .07; ctx.lineWidth = .7;
    for (let offset = -height; offset < height * 2; offset += 23) {
      ctx.beginPath();
      for (let x = -10; x < width + 10; x += 10) {
        const y = offset + Math.sin(x / 280 + offset / 380) * 70 + Math.cos(x / 170 + offset / 180) * 25 + x * .17;
        if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (pattern === 'horizon') {
    ctx.lineWidth = .6;
    for (let y = height * .44; y < height; y += 8 + (height - y) * .022) {
      ctx.globalAlpha = .04 + ((y - height * .44) / height) * .12;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }
}

buildSettings();
buildCityList();
renderIcons();
applyAppearance();

$('#light-button').addEventListener('click', () => openDialog('light-dialog'));
$('#scene-search').addEventListener('input', filterScenes);
$('#clear-scene-filters').addEventListener('click', () => {
  $('#scene-search').value = ''; sceneCategory = 'All'; filterScenes();
});
$('#shuffle-scene').addEventListener('click', () => {
  const candidates = SCENES.filter(s => s.id !== state.scene);
  selectScene(candidates[Math.floor(Math.random() * candidates.length)].id);
  $('#appearance-dialog').close();
  notice(getScene(state.scene).name);
});
$('#scene-current').addEventListener('click', () => { activateTab('styles'); openDialog('appearance-dialog'); });
document.querySelectorAll('[data-picture-setting]').forEach(input => input.addEventListener('input', () => {
  state[input.dataset.pictureSetting] = Number(input.value);
  applyPicture();
  clearTimeout(pictureSaveTimer);
  pictureSaveTimer = setTimeout(saveState, 500);
}));
document.querySelectorAll('[data-picture]').forEach(button => button.addEventListener('click', () => {
  Object.assign(state, normalizePicture(PICTURE_PRESETS[button.dataset.picture]));
  applyPicture(); saveState();
}));
$('#reset-picture').addEventListener('click', () => {
  Object.assign(state, PICTURE_DEFAULTS); applyPicture(); saveState();
});
$('#theme-search').addEventListener('input', () => {
  const query = normalized($('#theme-search').value.trim());
  let count = 0;
  document.querySelectorAll('.theme-card').forEach(button => {
    button.hidden = !normalized(`${button.textContent} ${button.dataset.theme}`).includes(query);
    if (!button.hidden) count++;
  });
  $('#theme-match-count').textContent = count;
  $('#theme-empty').hidden = count > 0;
});
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  state.mode = button.dataset.mode; lastModeManual = true; applyAppearance(); saveState();
}));
systemMode.addEventListener('change', () => {
  if (!lastModeManual) { state.mode = systemMode.matches ? 'dark' : 'light'; applyAppearance(); }
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) { state.rotation = 0; earth.update({ period: 0 }); updateRotationControl(); }
});
$('#appearance-button').addEventListener('click', () => openDialog('appearance-dialog'));
$('#city-button').addEventListener('click', () => openDialog('city-dialog'));
$('#device-time-button').addEventListener('click', () => selectCity(deviceCity));
$('#rotation-button').addEventListener('click', toggleRotation);
$('#recenter-button').addEventListener('click', () => earth.recenter(null, reducedMotion.matches));
$('#fullscreen-button').addEventListener('click', toggleFullscreen);
$('#fullscreen-help-button').addEventListener('click', () => showFullscreenHelp());
$('#focus-button').addEventListener('click', () => setQuiet(!quiet));
$('#restore-button').addEventListener('click', () => setQuiet(false));
for (const name of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(name, () => {
    fallbackFullscreen = false;
    syncFullscreenControl();
    if (!nativeFullscreenElement()) setQuiet(false);
  });
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  $('#install-button').hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  $('#install-button').hidden = true;
  $('#install-status').textContent = 'Installed. Open the Time icon for a dedicated display.';
});
$('#install-button').addEventListener('click', async () => {
  if (!installPrompt) return;
  try {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    $('#install-status').textContent = choice.outcome === 'accepted'
      ? 'Installation accepted. Open the Time icon when it appears.'
      : 'You can install later from your browser menu.';
    installPrompt = null;
    $('#install-button').hidden = true;
  } catch {
    $('#install-status').textContent = 'Use Install app or Add to Home Screen in your browser menu.';
  }
});
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
$('#city-search').addEventListener('input', () => {
  const query = normalized($('#city-search').value.trim());
  let found = 0;
  document.querySelectorAll('.city-option').forEach(button => {
    button.hidden = !button.dataset.search.includes(query);
    if (!button.hidden) found++;
  });
  $('#city-empty').hidden = found > 0;
  updateCityTimes(new Date());
});
function activateTab(name, focus = false) {
  for (const id of ['styles','themes','display']) {
    const selected = id === name;
    $(`#tab-${id}`).setAttribute('aria-selected', String(selected));
    $(`#tab-${id}`).tabIndex = selected ? 0 : -1;
    $(`#${id}-panel`).hidden = !selected;
  }
  $('.settings-scroll').scrollTop = 0;
  if (focus) $(`#tab-${name}`).focus();
}
for (const id of ['styles','themes','display']) {
  $(`#tab-${id}`).addEventListener('click', () => activateTab(id));
  $(`#tab-${id}`).addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();
      const tabs = ['styles','themes','display'];
      const next = (tabs.indexOf(id) + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
      activateTab(event.key === 'Home' ? 'styles' : event.key === 'End' ? 'display' : tabs[next], true);
    }
  });
}
for (const [id, key] of [['show-labels','labels'],['show-lights','lights'],['show-grid','grid'],['show-seconds','seconds'],['show-world','world'],['show-effects','effects']]) {
  $(`#${id}`).addEventListener('change', event => { state[key] = event.target.checked; applyAppearance(); saveState(); });
}
for (const [id, key] of [['globe-finish','finish'],['rotation-speed','rotation'],['clock-format','format'],['layout-select','layout']]) {
  $(`#${id}`).addEventListener('change', event => {
    state[key] = ['finish','rotation'].includes(key) ? Number(event.target.value) : event.target.value;
    if (key === 'rotation' && state.rotation > 0) lastPeriod = state.rotation;
    applyAppearance(); saveState();
  });
}
$('#accent-color').addEventListener('input', event => { state.accent = event.target.value; applyAppearance(); saveState(); });
$('#keep-awake').addEventListener('change', event => { awakeRequested = event.target.checked; manageWakeLock(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { lastSecond = ''; tick(); if (awakeRequested && !wakeLock) manageWakeLock(); }
});
$('#reset-button').addEventListener('click', () => {
  state = { ...defaults };
  selectedCity = deviceCity;
  solarCache = null;
  lastModeManual = false;
  awakeRequested = false;
  $('#keep-awake').checked = false;
  manageWakeLock();
  $('#copy-fallback').hidden = true;
  $('#restore-form').hidden = true;
  applyAppearance(); saveState(); earth.recenter(null, reducedMotion.matches);
  notice('Back to the original atmosphere.');
});
$('#copy-button').addEventListener('click', async () => {
  const setupCode = `time:v2:${serializeState()}`;
  $('#restore-form').hidden = true;
  if (postNative('copySetup', setupCode)) {
    notice('Setup copied. Restore it on any screen.');
    return;
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(setupCode);
    $('#copy-fallback').hidden = true;
    const button = $('#copy-button');
    button.lastChild.textContent = 'Setup copied';
    setTimeout(() => { button.lastChild.textContent = 'Copy setup'; }, 2200);
  } catch {
    $('#copy-fallback').hidden = false;
    $('#setup-url').value = setupCode;
    $('#setup-url').focus();
    $('#setup-url').select();
  }
});
$('#restore-setup-button').addEventListener('click', () => {
  $('#copy-fallback').hidden = true;
  $('#restore-form').hidden = !$('#restore-form').hidden;
  $('#restore-status').textContent = '';
  if (!$('#restore-form').hidden) $('#setup-code').focus();
});
$('#restore-form').addEventListener('submit', event => {
  event.preventDefault();
  const code = $('#setup-code').value.trim();
  const prefix = code.startsWith('time:v2:') ? 'time:v2:' : 'solstice:v1:';
  const params = new URLSearchParams(code.slice(prefix.length));
  if (!code.startsWith(prefix) || !THEMES.some(theme => theme.id === params.get('theme'))) {
    $('#restore-status').textContent = 'That is not a valid Time setup code. Use Copy setup to create one.';
    return;
  }
  state = loadState(code.slice(prefix.length));
  selectedCity = resolveCity(state.city, state.timezone);
  solarCache = null;
  lastModeManual = true;
  if (state.rotation) lastPeriod = state.rotation;
  applyAppearance();
  saveState();
  earth.recenter(selectedCity.lat !== null ? selectedCity : null, reducedMotion.matches);
  $('#restore-status').textContent = 'Setup restored.';
});
document.addEventListener('keydown', event => {
  const tag = document.activeElement?.tagName;
  const inControl = ['INPUT','SELECT','TEXTAREA'].includes(tag);
  const dialogOpen = Boolean(document.querySelector('dialog[open]'));
  if (event.key === 'Escape') {
    if (!dialogOpen) {
      if (quiet) setQuiet(false);
      fallbackFullscreen = false;
      syncFullscreenControl();
    }
    return;
  }
  if (inControl || dialogOpen || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
  if (key === 'h') { event.preventDefault(); setQuiet(!quiet); }
  if (key === 't') { event.preventDefault(); openDialog('appearance-dialog'); }
  if (key === 'l') { event.preventDefault(); toggleColourMode(); }
  if (key === 'b') { event.preventDefault(); openDialog('light-dialog'); }
  if (key === '[') { event.preventDefault(); nextScene(-1); }
  if (key === ']') { event.preventDefault(); nextScene(1); }
  if (key === ' ' && !['BUTTON','A'].includes(tag)) { event.preventDefault(); toggleRotation(); }
});
let resizeScheduled = false;
window.addEventListener('resize', () => {
  if (resizeScheduled) return;
  resizeScheduled = true;
  requestAnimationFrame(() => { drawBackground(); resizeScheduled = false; });
});
window.addEventListener('hashchange', () => {
  // Anchor navigation must never reset a saved setup.
  if (!location.hash.includes('=')) return;
  state = loadState(location.hash.slice(1));
  selectedCity = resolveCity(state.city, state.timezone);
  solarCache = null; lastSecond = '';
  applyAppearance();
  tick();
  if (selectedCity.lat !== null) earth.recenter(selectedCity, reducedMotion.matches);
  saveState();
});
setInterval(tick, 200);
syncFullscreenControl();

if (!isNative && 'serviceWorker' in navigator && window.isSecureContext && window.self === window.top) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./sw.js', import.meta.url).href)
      .catch(() => {}); // A restricted preview must remain usable without offline caching.
  }, { once: true });
}

// Read-only diagnostics for deterministic display QA.
window.solstice = Object.freeze({
  getState: () => ({ ...state, selectedCity: { ...selectedCity }, quiet, fullscreen: nativeFullscreen || Boolean(nativeFullscreenElement()) || fallbackFullscreen, renderer: earth.renderer, ready: earth.ready }),
  getView: () => ({ longitude: earth.longitude, latitude: earth.latitude, zoom: earth.zoom, frames: earth.frameCount, radius: earth.radius }),
  getSun: () => ({ ...sunPosition() }),
});
window.timescreen = Object.freeze({ version:'2.0.0', sceneCount:SCENES.length, getState:window.solstice.getState });
window.addEventListener('timescreen:native-state', event => {
  if (!isNative) return;
  nativeFullscreen = Boolean(event.detail?.fullscreen);
  awakeRequested = Boolean(event.detail?.keepAwake);
  $('#keep-awake').checked = awakeRequested;
  $('#awake-status').textContent = awakeRequested
    ? (event.detail?.awakeActive ? 'Your Mac display stays awake while this window is visible.' : 'Keep awake is selected. It resumes when the window is visible.')
    : '';
  syncFullscreenControl();
});
window.addEventListener('timescreen:command', event => {
  if (!isNative) return;
  const actions = {
    appearance: () => { activateTab('styles'); openDialog('appearance-dialog'); },
    picture: () => openDialog('light-dialog'),
    quiet: () => setQuiet(!quiet),
    next: () => nextScene(1), previous: () => nextScene(-1),
  };
  actions[event.detail]?.();
});
postNative('ready', { version:'2.0.0', setup:serializeState() });
