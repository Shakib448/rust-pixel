import {
    boxBlurJS,
    edgeDetectJS,
    grayscaleJS,
    invertJS,
    sharpenJS,
} from "./js-filter.js";
import init, {
    box_blur,
    edge_detect,
    grayscale,
    invert,
    sharpen,
} from "./pkg/rust_pixel.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultsBody = document.getElementById("results-body");
const resultsTable = document.getElementById("results");
const progress = document.getElementById("progress");
const progressText = document.getElementById("progress-text");
const statsDiv = document.getElementById("stats");

let originalImageData = null;
let iterations = 5;

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
    document.getElementById("run-benchmark").disabled = false;
    document.getElementById("run-quick").disabled = false;
    document.getElementById("run-thorough").disabled = false;
  };
  img.src = URL.createObjectURL(file);
});

const benchmarks = [
  {
    name: "Grayscale",
    wasm: (data) => grayscale(data),
    js: (data) => grayscaleJS(data),
    mutates: true,
  },
  {
    name: "Invert",
    wasm: (data) => invert(data),
    js: (data) => invertJS(data),
    mutates: true,
  },
  {
    name: "Blur",
    wasm: (data, w, h) => box_blur(data, w, h, 5),
    js: (data, w, h) => boxBlurJS(data, w, h, 5),
    mutates: false,
  },
  {
    name: "Sharpen",
    wasm: (data, w, h) => sharpen(data, w, h),
    js: (data, w, h) => sharpenJS(data, w, h),
    mutates: false,
  },
  {
    name: "Edge Detection",
    wasm: (data, w, h) => edge_detect(data, w, h),
    js: (data, w, h) => edgeDetectJS(data, w, h),
    mutates: false,
  },
];

async function runBenchmark(test, iterations) {
  const wasmTimes = [];
  const jsTimes = [];
  const width = canvas.width;
  const height = canvas.height;

  // Warmup
  for (let i = 0; i < 2; i++) {
    const data = new Uint8ClampedArray(originalImageData.data);
    test.wasm(data, width, height);
    test.js(data, width, height);
  }

  // Run WASM tests
  for (let i = 0; i < iterations; i++) {
    const data = new Uint8ClampedArray(originalImageData.data);
    const start = performance.now();
    test.wasm(data, width, height);
    const time = performance.now() - start;
    wasmTimes.push(time);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Run JS tests
  for (let i = 0; i < iterations; i++) {
    const data = new Uint8ClampedArray(originalImageData.data);
    const start = performance.now();
    test.js(data, width, height);
    const time = performance.now() - start;
    jsTimes.push(time);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Calculate median times (more robust than average)
  const wasmMedian = median(wasmTimes);
  const jsMedian = median(jsTimes);

  return {
    wasmTime: wasmMedian,
    jsTime: jsMedian,
    speedup: jsMedian / wasmMedian,
  };
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

async function runAllBenchmarks(iters) {
  if (!originalImageData) {
    alert("Please upload an image first!");
    return;
  }

  iterations = iters;
  resultsBody.innerHTML = "";
  progress.classList.add("active");
  resultsTable.style.display = "none";
  statsDiv.style.display = "none";

  const results = [];

  for (let i = 0; i < benchmarks.length; i++) {
    const test = benchmarks[i];
    progressText.textContent = `Testing ${test.name} (${i + 1}/${benchmarks.length})...`;

    const result = await runBenchmark(test, iterations);
    results.push({ name: test.name, ...result });

    const row = document.createElement("tr");
    const speedupClass = result.speedup >= 1 ? "faster" : "slower";
    const winner = result.speedup >= 1 ? "WASM" : "JavaScript";

    row.innerHTML = `
      <td><strong>${test.name}</strong></td>
      <td class="wasm-time">${result.wasmTime.toFixed(2)}ms</td>
      <td class="js-time">${result.jsTime.toFixed(2)}ms</td>
      <td class="speedup ${speedupClass}">${result.speedup.toFixed(2)}x</td>
      <td><strong>${winner}</strong></td>
    `;
    resultsBody.appendChild(row);
  }

  // Calculate statistics
  const wasmWins = results.filter((r) => r.speedup >= 1).length;
  const jsWins = results.filter((r) => r.speedup < 1).length;
  const avgSpeedup =
    results.reduce((sum, r) => sum + r.speedup, 0) / results.length;

  document.getElementById("total-tests").textContent = results.length;
  document.getElementById("wasm-wins").textContent = wasmWins;
  document.getElementById("js-wins").textContent = jsWins;
  document.getElementById("avg-speedup").textContent =
    `${avgSpeedup.toFixed(2)}x`;

  progress.classList.remove("active");
  resultsTable.style.display = "table";
  statsDiv.style.display = "grid";
  progressText.textContent = "Benchmark complete!";
}

document.getElementById("run-benchmark").addEventListener("click", () => {
  runAllBenchmarks(5);
});

document.getElementById("run-quick").addEventListener("click", () => {
  runAllBenchmarks(3);
});

document.getElementById("run-thorough").addEventListener("click", () => {
  runAllBenchmarks(10);
});

document.getElementById("run-benchmark").disabled = true;
document.getElementById("run-quick").disabled = true;
document.getElementById("run-thorough").disabled = true;
