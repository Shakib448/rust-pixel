export function grayscaleJS(data) {
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

export function boxBlurJS(data, width, height, radius) {
  const output = new Uint8ClampedArray(data.length);
  const w = width;
  const h = height;
  const wMinus1 = width - 1;
  const hMinus1 = height - 1;

  for (let y = 0; y < h; y++) {
    const yIdx = y * w;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;

      const yMin = Math.max(0, y - radius);
      const yMax = Math.min(hMinus1, y + radius);
      const xMin = Math.max(0, x - radius);
      const xMax = Math.min(wMinus1, x + radius);

      for (let ny = yMin; ny <= yMax; ny++) {
        const rowIdx = ny * w * 4;
        for (let nx = xMin; nx <= xMax; nx++) {
          const idx = rowIdx + (nx << 2);
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          a += data[idx + 3];
          count++;
        }
      }

      const invCount = 1 / count;
      const idx = (yIdx + x) << 2;
      output[idx] = (r * invCount) | 0;
      output[idx + 1] = (g * invCount) | 0;
      output[idx + 2] = (b * invCount) | 0;
      output[idx + 3] = (a * invCount) | 0;
    }
  }
  return output;
}

export function invertJS(data) {
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

export function sharpenJS(data, width, height) {
  const output = new Uint8ClampedArray(data.length);
  const w = width;
  const h = height;
  const wMinus1 = width - 1;
  const hMinus1 = height - 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Manually unrolled 3x3 sharpen kernel: [0,-1,0],[-1,5,-1],[0,-1,0]
      const x0 = x === 0 ? 0 : x - 1;
      const x2 = x === wMinus1 ? wMinus1 : x + 1;
      const y0 = y === 0 ? 0 : y - 1;
      const y2 = y === hMinus1 ? hMinus1 : y + 1;

      const idx_c = (y * w + x) << 2;      // center
      const idx_t = (y0 * w + x) << 2;     // top
      const idx_b = (y2 * w + x) << 2;     // bottom
      const idx_l = (y * w + x0) << 2;     // left
      const idx_r = (y * w + x2) << 2;     // right

      let r = data[idx_c] * 5 - data[idx_t] - data[idx_b] - data[idx_l] - data[idx_r];
      let g = data[idx_c + 1] * 5 - data[idx_t + 1] - data[idx_b + 1] - data[idx_l + 1] - data[idx_r + 1];
      let b = data[idx_c + 2] * 5 - data[idx_t + 2] - data[idx_b + 2] - data[idx_l + 2] - data[idx_r + 2];

      output[idx_c] = r < 0 ? 0 : r > 255 ? 255 : r | 0;
      output[idx_c + 1] = g < 0 ? 0 : g > 255 ? 255 : g | 0;
      output[idx_c + 2] = b < 0 ? 0 : b > 255 ? 255 : b | 0;
      output[idx_c + 3] = data[idx_c + 3];
    }
  }
  return output;
}

export function edgeDetectJS(data, width, height) {
  const output = new Uint8ClampedArray(data.length);
  const w = width;
  const h = height;
  const wMinus1 = width - 1;
  const hMinus1 = height - 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Calculate 9 pixel positions with bounds checking
      const x0 = x === 0 ? 0 : x - 1;
      const x1 = x;
      const x2 = x === wMinus1 ? wMinus1 : x + 1;
      const y0 = y === 0 ? 0 : y - 1;
      const y1 = y;
      const y2 = y === hMinus1 ? hMinus1 : y + 1;

      // Get all 9 indices
      const i00 = (y0 * w + x0) << 2;
      const i01 = (y0 * w + x1) << 2;
      const i02 = (y0 * w + x2) << 2;
      const i10 = (y1 * w + x0) << 2;
      const i12 = (y1 * w + x2) << 2;
      const i20 = (y2 * w + x0) << 2;
      const i21 = (y2 * w + x1) << 2;
      const i22 = (y2 * w + x2) << 2;

      // Calculate grayscale for all 9 pixels
      const g00 = (data[i00] * 0.299 + data[i00 + 1] * 0.587 + data[i00 + 2] * 0.114);
      const g01 = (data[i01] * 0.299 + data[i01 + 1] * 0.587 + data[i01 + 2] * 0.114);
      const g02 = (data[i02] * 0.299 + data[i02 + 1] * 0.587 + data[i02 + 2] * 0.114);
      const g10 = (data[i10] * 0.299 + data[i10 + 1] * 0.587 + data[i10 + 2] * 0.114);
      const g12 = (data[i12] * 0.299 + data[i12 + 1] * 0.587 + data[i12 + 2] * 0.114);
      const g20 = (data[i20] * 0.299 + data[i20 + 1] * 0.587 + data[i20 + 2] * 0.114);
      const g21 = (data[i21] * 0.299 + data[i21 + 1] * 0.587 + data[i21 + 2] * 0.114);
      const g22 = (data[i22] * 0.299 + data[i22 + 1] * 0.587 + data[i22 + 2] * 0.114);

      // Sobel kernels unrolled
      // X: [[-1,0,1],[-2,0,2],[-1,0,1]]
      const gx = -g00 + g02 - 2 * g10 + 2 * g12 - g20 + g22;
      // Y: [[-1,-2,-1],[0,0,0],[1,2,1]]
      const gy = -g00 - 2 * g01 - g02 + g20 + 2 * g21 + g22;

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const mag = magnitude > 255 ? 255 : magnitude | 0;

      const idx = (y * w + x) << 2;
      output[idx] = mag;
      output[idx + 1] = mag;
      output[idx + 2] = mag;
      output[idx + 3] = 255;
    }
  }
  return output;
}
