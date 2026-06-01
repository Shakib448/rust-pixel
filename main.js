import {
  boxBlurJS,
  grayscaleJS,
  invertJS,
  brightnessJS,
  sepiaJS,
  sharpenJS,
  edgeDetectJS,
} from "./js-filter.js";
import init, {
  box_blur,
  grayscale,
  invert,
  brightness,
  sepia,
  sharpen,
  edge_detect,
} from "./pkg/rust_pixel.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const result = document.getElementById("result");
const BLUR_RADIUS = 5;
const BRIGHTNESS_FACTOR = 1.3;

let originalImageData = null;

await init();

document.getElementById("upload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    result.textContent = "Image loaded — Try the filters!";
  };
  img.src = URL.createObjectURL(file);
});

function restore() {
  if (originalImageData) ctx.putImageData(originalImageData, 0, 0);
}

function getData() {
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Grayscale
document.getElementById("grayscale-wasm").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  grayscale(imgData.data);
  const time = performance.now() - start;
  ctx.putImageData(imgData, 0, 0);
  result.innerHTML = `Grayscale <span class="fast">WASM: ${time.toFixed(2)}ms</span>`;
});

document.getElementById("grayscale-js").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  grayscaleJS(imgData.data);
  const time = performance.now() - start;
  ctx.putImageData(imgData, 0, 0);
  result.innerHTML = `Grayscale <b>JS: ${time.toFixed(2)}ms</b>`;
});

// Blur
document.getElementById("blur-wasm").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  const output = box_blur(
    imgData.data,
    canvas.width,
    canvas.height,
    BLUR_RADIUS,
  );
  const time = performance.now() - start;
  const newImg = new ImageData(
    new Uint8ClampedArray(output),
    canvas.width,
    canvas.height,
  );
  ctx.putImageData(newImg, 0, 0);
  result.innerHTML = `Blur <span class="fast">WASM: ${time.toFixed(2)}ms</span>`;
});

document.getElementById("blur-js").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  const output = boxBlurJS(
    imgData.data,
    canvas.width,
    canvas.height,
    BLUR_RADIUS,
  );
  const time = performance.now() - start;
  const newImg = new ImageData(output, canvas.width, canvas.height);
  ctx.putImageData(newImg, 0, 0);
  result.innerHTML = `Blur <b>JS: ${time.toFixed(2)}ms</b>`;
});

// Invert
document.getElementById("invert-wasm").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  invert(imgData.data);
  const time = performance.now() - start;
  ctx.putImageData(imgData, 0, 0);
  result.innerHTML = `Invert <span class="fast">WASM: ${time.toFixed(2)}ms</span>`;
});

document.getElementById("invert-js").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  invertJS(imgData.data);
  const time = performance.now() - start;
  ctx.putImageData(imgData, 0, 0);
  result.innerHTML = `Invert <b>JS: ${time.toFixed(2)}ms</b>`;
});

// Brightness
document.getElementById("brightness-wasm").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  brightness(imgData.data, BRIGHTNESS_FACTOR);
  const time = performance.now() - start;
  ctx.putImageData(imgData, 0, 0);
  result.innerHTML = `Brightness <span class="fast">WASM: ${time.toFixed(2)}ms</span>`;
});

document.getElementById("brightness-js").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  brightnessJS(imgData.data, BRIGHTNESS_FACTOR);
  const time = performance.now() - start;
  ctx.putImageData(imgData, 0, 0);
  result.innerHTML = `Brightness <b>JS: ${time.toFixed(2)}ms</b>`;
});

// Sepia
document.getElementById("sepia-wasm").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  sepia(imgData.data);
  const time = performance.now() - start;
  ctx.putImageData(imgData, 0, 0);
  result.innerHTML = `Sepia <span class="fast">WASM: ${time.toFixed(2)}ms</span>`;
});

document.getElementById("sepia-js").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  sepiaJS(imgData.data);
  const time = performance.now() - start;
  ctx.putImageData(imgData, 0, 0);
  result.innerHTML = `Sepia <b>JS: ${time.toFixed(2)}ms</b>`;
});

// Sharpen
document.getElementById("sharpen-wasm").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  const output = sharpen(imgData.data, canvas.width, canvas.height);
  const time = performance.now() - start;
  const newImg = new ImageData(
    new Uint8ClampedArray(output),
    canvas.width,
    canvas.height,
  );
  ctx.putImageData(newImg, 0, 0);
  result.innerHTML = `Sharpen <span class="fast">WASM: ${time.toFixed(2)}ms</span>`;
});

document.getElementById("sharpen-js").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  const output = sharpenJS(imgData.data, canvas.width, canvas.height);
  const time = performance.now() - start;
  const newImg = new ImageData(output, canvas.width, canvas.height);
  ctx.putImageData(newImg, 0, 0);
  result.innerHTML = `Sharpen <b>JS: ${time.toFixed(2)}ms</b>`;
});

// Edge Detection
document.getElementById("edge-wasm").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  const output = edge_detect(imgData.data, canvas.width, canvas.height);
  const time = performance.now() - start;
  const newImg = new ImageData(
    new Uint8ClampedArray(output),
    canvas.width,
    canvas.height,
  );
  ctx.putImageData(newImg, 0, 0);
  result.innerHTML = `Edge Detect <span class="fast">WASM: ${time.toFixed(2)}ms</span>`;
});

document.getElementById("edge-js").addEventListener("click", () => {
  restore();
  const imgData = getData();
  const start = performance.now();
  const output = edgeDetectJS(imgData.data, canvas.width, canvas.height);
  const time = performance.now() - start;
  const newImg = new ImageData(output, canvas.width, canvas.height);
  ctx.putImageData(newImg, 0, 0);
  result.innerHTML = `Edge Detect <b>JS: ${time.toFixed(2)}ms</b>`;
});

document.getElementById("reset").addEventListener("click", restore);
