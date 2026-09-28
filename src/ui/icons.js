/**
 * 图标入口：优先用像素点阵图（src/ui/pixel.js），没有点阵的回退到几何 path。
 * 全部内联 SVG，不引入外部图片。
 */
import { pixelIcon, hasPixel, PART_ICON } from './pixel.js';

const PATHS = {
  tv: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 10h4"/>',
  washer: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.5"/><path d="M7 6.5h4"/>',
  microwave: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3 10h9v8H3z"/>',
  radio: '<rect x="3" y="8" width="18" height="10" rx="1.5"/><circle cx="8.5" cy="13" r="2.5"/>',
  bike: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-7h4l4 7"/>',
  pc: '<rect x="4" y="4" width="16" height="13" rx="1.5"/><path d="M8 21h8"/>',
  ac: '<rect x="3" y="5" width="18" height="9" rx="1.5"/><path d="M6 8.5h12"/>',
  cooker: '<rect x="4" y="9" width="16" height="10" rx="2"/><path d="M3 9h18"/>',
  printer: '<path d="M6 9V4h12v5"/><rect x="3" y="9" width="18" height="7" rx="1.5"/>',
  stereo: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><circle cx="9" cy="12" r="3.5"/>',
  laptop: '<rect x="4" y="5" width="16" height="10" rx="1"/><path d="M2 18h20l-2-3H4z"/>',
  fan: '<circle cx="12" cy="10" r="5"/><path d="M10 15h4l1 6H9z"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 5h4"/>',
  router: '<rect x="3" y="9" width="18" height="9" rx="1.5"/><circle cx="7" cy="18" r="1.3"/><circle cx="11" cy="18" r="1.3"/>',
  camera: '<rect x="4" y="6" width="16" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.6"/><path d="M8 6l1.5-2h5L16 6"/>',
  kettle: '<path d="M5 9h11v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M16 11l3-2v7l-3-2"/>',
  iron: '<path d="M3 17h15l-2-8H5z"/><path d="M18 17v-4"/>',
  vacuum: '<rect x="6" y="3" width="12" height="9" rx="2"/><path d="M10 12h4v5h-4z"/><path d="M12 17v3"/>',
  sewing: '<rect x="6" y="4" width="12" height="7" rx="1.5"/><path d="M6 11h12v6H6z"/><path d="M12 4v3"/><circle cx="15" cy="7.5" r="1.2"/>',
  fridge: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 9h14"/><path d="M9 6h2"/><path d="M9 12h6v4H9z"/>',
  vcr: '<rect x="3" y="6" width="18" height="11" rx="1.5"/><rect x="10" y="8" width="7" height="7"/><circle cx="6.5" cy="11.5" r="1.3"/><path d="M4 15h6"/>',
  heater: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h6"/>',
  landline: '<rect x="6" y="10" width="12" height="8" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/><circle cx="9" cy="13" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>',
  typewriter: '<rect x="3" y="8" width="18" height="9" rx="1.5"/><path d="M7 6h10v2H7z"/><circle cx="6" cy="12" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  safe: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5v1M12 14.5v1M8.5 12h1M14.5 12h1"/>',
  vending: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><rect x="7" y="6" width="10" height="7"/><path d="M9 16h6"/><path d="M7 20h10"/>',
  guest: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  brand: '<path d="M4 8h13l3 4-3 4H4z"/><circle cx="7.5" cy="18.5" r="2"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10"/>',
  crate: '<rect x="3" y="7" width="18" height="13" rx="1"/><path d="M3 11h18"/>',
  wrench: '<path d="M14.5 3.5a5 5 0 0 0 6 6l-11 11-3-3 11-11z"/>',
  scale: '<path d="M12 4v16"/><path d="M6 8h12"/>',
  spark: '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>'
};

export function icon(name) {
  const key = PART_ICON[name] || name;
  if (hasPixel(key)) return pixelIcon(key);
  const d = PATHS[name] || PATHS.crate;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

export function hasIcon(name) {
  return hasPixel(PART_ICON[name] || name) || Object.prototype.hasOwnProperty.call(PATHS, name);
}

export { pixelIcon, PART_ICON };

export default icon;
