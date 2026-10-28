import {
  createElement, Sun, Moon, SlidersHorizontal, Maximize, Minimize, ChevronDown,
  Sunrise, Sunset, Pause, Play, LocateFixed, Scan, X, Search, RotateCcw, Link, Copy, Download, Shuffle, ArrowUpRight,
} from 'lucide';

const icons = {
  sun: Sun, moon: Moon, 'sliders-horizontal': SlidersHorizontal, maximize: Maximize,
  minimize: Minimize, 'chevron-down': ChevronDown, sunrise: Sunrise, sunset: Sunset,
  pause: Pause, play: Play, 'locate-fixed': LocateFixed, scan: Scan, x: X,
  search: Search, 'rotate-ccw': RotateCcw, link: Link, copy: Copy, download: Download,
  shuffle: Shuffle, 'arrow-up-right': ArrowUpRight,
};
export function setIcon(element, name) {
  if (!element || !icons[name]) return;
  const icon = createElement(icons[name]);
  icon.setAttribute('aria-hidden', 'true');
  element.replaceChildren(icon);
  element.dataset.icon = name;
}
export function renderIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => setIcon(el, el.dataset.icon));
}
