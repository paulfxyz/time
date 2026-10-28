import { clamp, geoVector, sunPosition } from './solar.js?v=2.0.0';

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const vertexSource = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;
const fragmentSource = `
precision highp float;
uniform vec2 uResolution;
uniform float uRadius;
uniform float uYaw;
uniform float uPitch;
uniform vec3 uSun;
uniform vec3 uAccent;
uniform float uStyle;
uniform float uGrid;
uniform float uLights;
uniform float uLightMode;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uSpecular;
uniform sampler2D uClouds;
const float PI = 3.141592653589793;
vec3 toWorld(vec3 p) {
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 q = vec3(-p.x, cp*p.y+sp*p.z, -sp*p.y+cp*p.z);
  float cy = cos(uYaw), sy = sin(uYaw);
  return vec3(cy*q.x+sy*q.z, q.y, -sy*q.x+cy*q.z);
}
float gridLine(float value, float stepSize, float thickness) {
  float d = abs(fract(value / stepSize + 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, thickness, d);
}
void main() {
  vec2 p = (gl_FragCoord.xy - uResolution * 0.5) / uRadius;
  float r2 = dot(p,p);
  if(r2 > 1.12) { gl_FragColor = vec4(0.0); return; }
  if(r2 > 1.0) {
    float r = sqrt(r2);
    vec3 rimNormal = toWorld(vec3(normalize(p), 0.0));
    float daylight = smoothstep(-0.15, 0.45, dot(rimNormal,uSun));
    float glow = exp(-(r-1.0)*75.0) * (0.045 + 0.28*daylight);
    vec3 atmosphere = mix(vec3(0.25,0.49,0.76), uAccent, step(0.5,uStyle)*0.7);
    gl_FragColor = vec4(atmosphere, glow * (1.0-uLightMode*0.45));
    return;
  }
  float z = sqrt(max(0.0,1.0-r2));
  vec3 n = toWorld(vec3(p,z));
  vec2 uv = vec2(atan(n.z,n.x)/(2.0*PI)+0.5, asin(clamp(n.y,-1.0,1.0))/PI+0.5);
  vec3 day = texture2D(uDay,uv).rgb;
  vec3 night = vec3(1.0,0.80,0.55) * max(0.0,texture2D(uNight,uv).r-0.12) * 1.4;
  float ocean = texture2D(uSpecular,uv).r;
  float clouds = texture2D(uClouds,uv).r;
  float sunDot = dot(n,uSun);
  float sunlight = smoothstep(-0.045,0.065,sunDot);
  float illumination = 0.34 + 0.72*pow(max(0.0,sunDot),0.55);
  float luminance = dot(day,vec3(0.2126,0.7152,0.0722));
  float land = 1.0 - smoothstep(0.25,0.8,ocean);
  vec3 color;
  if(uStyle < 0.5) {
    vec3 dayColor = mix(vec3(luminance),day,0.88) * illumination * 1.16;
    dayColor = mix(dayColor,vec3(0.86,0.9,0.94)*illumination,clouds*0.58);
    vec3 nightColor = day*0.065 + vec3(0.012,0.019,0.028);
    nightColor += night * vec3(1.65,1.30,0.94) * uLights;
    color = mix(nightColor,dayColor,sunlight);
    vec3 halfVector = normalize(uSun + toWorld(vec3(0.0,0.0,1.0)));
    float reflection = pow(max(0.0,dot(n,halfVector)),80.0) * ocean * max(sunDot,0.0) * 0.22;
    color += reflection * vec3(0.65,0.78,0.91);
  } else if(uStyle < 1.5) {
    vec3 waterColor = uAccent*0.16 + vec3(0.025,0.045,0.055);
    vec3 landColor = uAccent*0.7 + vec3(luminance*0.3);
    vec3 atlas = mix(waterColor,landColor,land);
    color = atlas * mix(0.16,illumination,sunlight);
    color += night * uLights * (1.0-sunlight) * 0.8;
  } else if(uStyle < 2.5) {
    vec3 porcelain = mix(vec3(0.55,0.59,0.60),vec3(0.88,0.88,0.83),land);
    porcelain = mix(porcelain,porcelain*uAccent,0.14);
    color = porcelain * mix(0.14,illumination,sunlight);
    color += night * uLights * (1.0-sunlight) * 0.35;
  } else if(uStyle < 3.5) {
    vec3 mono = vec3(luminance*0.9+land*0.09);
    color = mono * mix(0.10,illumination,sunlight);
    color += vec3(dot(night,vec3(0.333))) * uLights * (1.0-sunlight);
  } else if(uStyle < 4.5) {
    vec2 texel = vec2(1.0/1024.0,1.0/512.0);
    float a = texture2D(uSpecular,uv+vec2(texel.x,0.0)).r;
    float b = texture2D(uSpecular,uv-vec2(texel.x,0.0)).r;
    float c = texture2D(uSpecular,uv+vec2(0.0,texel.y)).r;
    float d = texture2D(uSpecular,uv-vec2(0.0,texel.y)).r;
    float coast = clamp(length(vec2(a-b,c-d))*2.0,0.0,1.0);
    color = uAccent*(0.045 + 0.10*land + coast*0.8) * mix(0.25,1.0,sunlight);
  } else {
    vec2 tile = fract(uv*vec2(210.0,105.0))-0.5;
    float dots = 1.0-smoothstep(0.18,0.37,length(tile));
    color = uAccent * (0.025 + land * dots * mix(0.2,0.94,sunlight));
  }
  float grid = max(gridLine(uv.x,1.0/24.0,0.028),gridLine(uv.y,1.0/12.0,0.028));
  float gridAmount = max(uGrid,step(3.5,uStyle)*(1.0-step(4.5,uStyle)));
  color += uAccent * grid * 0.17 * gridAmount * (0.4+sunlight*0.6);
  float rim = pow(1.0-z,4.0);
  vec3 airColor = mix(vec3(0.13,0.34,0.58),uAccent*0.35,step(0.5,uStyle));
  color += airColor * rim * (0.12+sunlight*0.6);
  float edgeAlpha = smoothstep(0.0,2.0/uRadius,1.0-sqrt(r2));
  gl_FragColor = vec4(clamp(color,0.0,1.0),edgeAlpha);
}
`;

export class Earth {
  constructor(canvas, container, onNotice) {
    this.canvas = canvas;
    this.container = container;
    this.onNotice = onNotice;
    this.sun = sunPosition();
    this.longitude = this.sun.longitude - 65;
    this.latitude = 16;
    this.zoom = 1;
    this.period = 240;
    this.lastPeriod = 240;
    this.style = 0;
    this.accent = [0.867, 0.659, 0.463];
    this.grid = false;
    this.lights = true;
    this.lightMode = false;
    this.dragging = false;
    this.lastInteraction = 0;
    this.ready = false;
    this.images = {};
    this.frameCount = 0;
    this.target = null;
    this.lastLabelFrame = 0;
    this.onFrame = () => {};
    this.initialize();
  }

  async initialize() {
    try {
      const forceCanvas = new URLSearchParams(location.search).get('renderer') === 'canvas';
      this.gl = !forceCanvas && this.canvas.getContext('webgl', {
        alpha: true, antialias: false, depth: false, premultipliedAlpha: false,
        powerPreference: 'low-power', preserveDrawingBuffer: false,
      });
      if (!this.gl) throw new Error('WebGL unavailable');
      this.setupGL();
      this.renderer = 'webgl';
    } catch (error) {
      if (this.gl) {
        const replacement = this.canvas.cloneNode(true);
        this.canvas.replaceWith(replacement);
        this.canvas = replacement;
      }
      this.gl = null;
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.renderer = 'canvas';
      this.bufferCanvas = document.createElement('canvas');
      this.bufferCanvas.width = this.bufferCanvas.height = 240;
      this.bufferContext = this.bufferCanvas.getContext('2d');
      this.bufferImage = this.bufferContext.createImageData(240, 240);
    }
    this.canvas.dataset.renderer = this.renderer;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.bindInteractions();
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.contextLost = true;
      this.onNotice('The graphics context paused. Clocks are still live; the globe will resume when graphics recover.');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.setupGL();
      Object.entries(this.images).forEach(([key, img]) => this.uploadTexture(key, img));
      this.resize();
    });

    const assets = [
      ['day', './assets/earth-day.webp'],
      ['night', './assets/earth-night.webp'],
      ['specular', './assets/earth-specular.webp'],
      ['clouds', './assets/earth-clouds.webp'],
    ];
    await Promise.all(assets.map(async ([key, src]) => {
      try {
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = src;
        });
        this.images[key] = img;
        if (this.gl) this.uploadTexture(key, img);
        if (this.renderer === 'canvas') this.readImagePixels(key, img);
      } catch (error) {
        if (key === 'day') this.onNotice('The Earth texture could not load. Sunlight and clocks are still live. Reload to try again.');
      }
    }));
    this.ready = true;
    this.canvas.dataset.ready = 'true';
    const loader = document.getElementById('earth-loading');
    loader.classList.add('loaded');
    setTimeout(() => { loader.hidden = true; }, 750);
    if (this.renderer === 'canvas') this.onNotice('Using the lightweight 2D globe because WebGL is unavailable.');
    this.previousFrame = performance.now();
    this.animate(this.previousFrame);
  }

  setupGL() {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    this.program = gl.createProgram();
    gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = {};
    ['Resolution','Radius','Yaw','Pitch','Sun','Accent','Style','Grid','Lights','LightMode'].forEach(key => {
      this.uniforms[key] = gl.getUniformLocation(this.program, `u${key}`);
    });
    this.textures = {};
    ['day','night','specular','clouds'].forEach((key, index) => {
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array(key === 'day' ? [28,58,79,255] : [0,0,0,255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(this.program, `u${key[0].toUpperCase()}${key.slice(1)}`), index);
      this.textures[key] = { texture, index };
    });
  }

  uploadTexture(key, image) {
    const gl = this.gl;
    const { texture, index } = this.textures[key];
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  readImagePixels(key, img) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 512, 256);
    try {
      this.pixels ??= {};
      this.pixels[key] = ctx.getImageData(0, 0, 512, 256).data;
    } catch (error) {
      this.onNotice('Your browser blocked texture readback. Showing a simplified sunlit globe.');
    }
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.max(1, Math.round(this.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * this.dpr));
    this.radius = Math.min(this.width, this.height) * 0.392 * this.zoom;
    this.container.style.setProperty('--orbit-size', `${this.radius * 2 + 24}px`);
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  bindInteractions() {
    let previousX = 0;
    let previousY = 0;
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      this.dragging = true;
      this.target = null;
      this.canvas.setPointerCapture(event.pointerId);
      previousX = event.clientX;
      previousY = event.clientY;
      this.lastInteraction = performance.now();
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.dragging) return;
      this.longitude -= (event.clientX - previousX) * 90 / Math.max(this.radius, 60);
      this.latitude = clamp(this.latitude + (event.clientY - previousY) * 60 / Math.max(this.radius, 60), -75, 75);
      previousX = event.clientX;
      previousY = event.clientY;
      this.lastInteraction = performance.now();
    });
    const release = () => { this.dragging = false; this.lastInteraction = performance.now(); };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('lostpointercapture', release);
    this.container.addEventListener('wheel', event => {
      event.preventDefault();
      this.zoom = clamp(this.zoom - event.deltaY * 0.0008, 0.72, 1.08);
      this.resize();
    }, { passive: false });
    this.canvas.addEventListener('keydown', event => {
      const key = event.key;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(key)) {
        event.preventDefault();
        this.target = null;
        if (key === 'ArrowLeft') this.longitude -= 8;
        if (key === 'ArrowRight') this.longitude += 8;
        if (key === 'ArrowUp') this.latitude = clamp(this.latitude + 6, -75, 75);
        if (key === 'ArrowDown') this.latitude = clamp(this.latitude - 6, -75, 75);
        if (key === '+' || key === '=') this.zoom = clamp(this.zoom + 0.06, 0.72, 1.08);
        if (key === '-') this.zoom = clamp(this.zoom - 0.06, 0.72, 1.08);
        if (key === '0') this.recenter();
        this.lastInteraction = performance.now();
        this.resize();
      }
    });
  }

  update(settings) {
    if (settings.period !== undefined) this.period = Number(settings.period);
    if (settings.style !== undefined) this.style = Number(settings.style);
    if (settings.accent) this.accent = hexToRGB(settings.accent);
    if (settings.grid !== undefined) this.grid = settings.grid;
    if (settings.lights !== undefined) this.lights = settings.lights;
    if (settings.lightMode !== undefined) this.lightMode = settings.lightMode;
  }

  recenter(city = null, reducedMotion = false) {
    const longitude = city && city.lon !== null ? city.lon : this.sun.longitude - 65;
    const latitude = city && city.lat !== null ? clamp(city.lat * 0.65, -50, 50) : 16;
    const delta = ((longitude - this.longitude + 540) % 360 + 360) % 360 - 180;
    this.target = { longitude: this.longitude + delta, latitude };
    if (reducedMotion) {
      this.longitude = this.target.longitude;
      this.latitude = latitude;
      this.target = null;
    }
    this.zoom = 1;
    this.lastInteraction = performance.now() + 1000;
    this.resize();
  }

  project(latitude, longitude) {
    const n = geoVector(latitude, longitude);
    const yaw = (90 - this.longitude) * RAD;
    const pitch = this.latitude * RAD;
    const x = Math.cos(yaw) * n[0] - Math.sin(yaw) * n[2];
    const z = Math.sin(yaw) * n[0] + Math.cos(yaw) * n[2];
    const y = Math.cos(pitch) * n[1] - Math.sin(pitch) * z;
    const depth = Math.sin(pitch) * n[1] + Math.cos(pitch) * z;
    return { x: this.width / 2 - x * this.radius, y: this.height / 2 - y * this.radius, depth };
  }

  animate(now) {
    requestAnimationFrame(next => this.animate(next));
    // 30fps is ample for a slow clock globe, and avoids burning GPU cycles on
    // high-refresh displays. Idle/reduced-motion scenes use a 12fps ceiling.
    this.reducedMotion ||= matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = this.reducedMotion.matches;
    const interval = this.dragging || this.target || (this.period && !reduced) ? 1000 / 30 : 1000 / 12;
    if (now - (this.lastRenderFrame || 0) < interval) return;
    this.lastRenderFrame = now;
    const elapsed = Math.min((now - this.previousFrame) / 1000, 0.05);
    this.previousFrame = now;
    if (document.hidden || this.contextLost || !this.width || !this.height) return;
    if (this.target) {
      const ease = 1 - Math.exp(-elapsed * 4);
      this.longitude += (this.target.longitude - this.longitude) * ease;
      this.latitude += (this.target.latitude - this.latitude) * ease;
      if (Math.abs(this.target.longitude - this.longitude) < 0.04 && Math.abs(this.target.latitude - this.latitude) < 0.04) this.target = null;
    } else if (this.period && !reduced && !this.dragging && now > this.lastInteraction + 1800) {
      const ramp = clamp((now - this.lastInteraction - 1800) / 1200, 0, 1);
      this.longitude += elapsed * (360 / this.period) * ramp;
    }
    // Keep GPU angles small during multi-day screensaver sessions.
    if (!this.target) this.longitude = ((this.longitude + 180) % 360 + 360) % 360 - 180;
    if (now - (this.lastSunFrame || 0) > 1000) {
      this.sun = sunPosition();
      this.lastSunFrame = now;
      this.canvas.dataset.longitude = this.longitude.toFixed(3);
    }
    if (this.renderer === 'webgl') this.renderGL();
    else if (now - (this.last2DFrame || 0) > 85) {
      this.render2D();
      this.last2DFrame = now;
    }
    this.frameCount++;
    if (now - this.lastLabelFrame > 40) {
      this.onFrame(this);
      this.lastLabelFrame = now;
    }
  }

  renderGL() {
    const gl = this.gl;
    const u = this.uniforms;
    gl.uniform2f(u.Resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.Radius, this.radius * this.dpr);
    gl.uniform1f(u.Yaw, (90 - this.longitude) * RAD);
    gl.uniform1f(u.Pitch, this.latitude * RAD);
    gl.uniform3fv(u.Sun, this.sun.vector);
    gl.uniform3fv(u.Accent, this.accent);
    gl.uniform1f(u.Style, this.style);
    gl.uniform1f(u.Grid, this.grid ? 1 : 0);
    gl.uniform1f(u.Lights, this.lights ? 1 : 0);
    gl.uniform1f(u.LightMode, this.lightMode ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  render2D() {
    const size = 240;
    const data = this.bufferImage.data;
    const yaw = (90 - this.longitude) * RAD;
    const pitch = this.latitude * RAD;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const sun = this.sun.vector;
    const map = this.pixels?.day;
    const night = this.pixels?.night;
    const spec = this.pixels?.specular;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4;
        const nx = (x - size / 2) / (size / 2 - 1);
        const ny = -(y - size / 2) / (size / 2 - 1);
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) { data[index + 3] = 0; continue; }
        const nz = Math.sqrt(1 - r2);
        const py = cp * ny + sp * nz;
        const pz = -sp * ny + cp * nz;
        const wx = -cy * nx + sy * pz, wz = sy * nx + cy * pz;
        const lon = Math.atan2(wz, wx);
        const lat = Math.asin(clamp(py, -1, 1));
        const tx = clamp(Math.floor((lon / TAU + 0.5) * 512), 0, 511);
        const ty = clamp(Math.floor((0.5 - lat / Math.PI) * 256), 0, 255);
        const ti = (ty * 512 + tx) * 4;
        const dot = wx * sun[0] + py * sun[1] + wz * sun[2];
        const lit = clamp((dot + 0.045) / 0.11, 0, 1);
        const light = (0.34 + 0.72 * Math.pow(Math.max(0, dot), 0.55)) * lit + (1 - lit) * 0.08;
        const land = spec ? 1 - spec[ti] / 255 : 0.4;
        for (let channel = 0; channel < 3; channel++) {
          let value = map ? map[ti + channel] : [45,88,115][channel];
          if (this.style === 1) value = this.accent[channel] * 255 * (0.14 + land * 0.7);
          if (this.style === 2) value = 145 + land * 74;
          if (this.style === 3) value = map ? (map[ti] + map[ti+1] + map[ti+2]) / 3 : 120;
          if (this.style === 4) value = this.accent[channel] * 255 * (0.12 + land * 0.55);
          if (this.style === 5) value = this.accent[channel] * 255 * (0.06 + land * ((tx % 4 < 2 && ty % 4 < 2) ? 1 : 0.06));
          const cityGlow = night && this.lights ? Math.max(0, night[ti] - 30.6) * 1.4 * [1,.8,.55][channel] * (1 - lit) : 0;
          data[index + channel] = clamp(value * light + cityGlow, 0, 255);
        }
        if ((this.grid || this.style === 4) && (tx % 22 === 0 || ty % 22 === 0)) {
          for (let c = 0; c < 3; c++) data[index + c] = data[index + c] * 0.75 + this.accent[c] * 255 * 0.25;
        }
        data[index + 3] = clamp((1 - Math.sqrt(r2)) * size, 0, 1) * 255;
      }
    }
    this.bufferContext.putImageData(this.bufferImage, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const r = this.radius * this.dpr;
    this.ctx.drawImage(this.bufferCanvas, this.canvas.width / 2 - r, this.canvas.height / 2 - r, r * 2, r * 2);
  }
}

export function hexToRGB(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
}
