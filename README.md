# Rust Pixel - WASM vs JavaScript Performance Benchmark

A real-time performance comparison tool demonstrating the speed advantages of Rust + WebAssembly over vanilla JavaScript for image processing operations.

## Overview

This project implements various image filter algorithms in both Rust (compiled to WebAssembly) and JavaScript, allowing you to directly compare their execution times on the same image. The results typically show significant performance improvements when using WASM, especially for computationally intensive filters.

## Features

### Basic Effects
- **Grayscale** - Convert images to black and white
- **Invert** - Invert all colors
- **Sepia** - Apply a vintage sepia tone
- **Brightness** - Increase image brightness (1.3x factor)

### Advanced Filters
- **Blur** - Box blur with configurable radius (5px default)
- **Sharpen** - Enhance image edges and details
- **Edge Detection** - Sobel operator for edge detection

Each filter is implemented in both:
- **Rust** - Compiled to WebAssembly for near-native performance
- **JavaScript** - Native browser implementation for comparison

## Performance Benefits

WebAssembly typically provides:
- **2-10x faster** execution for simple pixel operations (grayscale, invert, sepia)
- **10-50x faster** execution for computationally intensive filters (blur, sharpen, edge detection)
- More consistent performance across different browsers
- Better utilization of CPU resources

## Installation & Setup

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) (latest stable version)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
- A modern web browser with WASM support

### Install wasm-pack
```bash
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

### Build the Project
1. Clone the repository
```bash
git clone <your-repo-url>
cd rust_pixel
```

2. Compile Rust to WebAssembly
```bash
wasm-pack build --target web --out-dir pkg
```

3. Serve the application
```bash
python3 -m http.server 8000
# Or use any other static file server
```

4. Open your browser
```
http://localhost:8000
```

## Project Structure

```
rust_pixel/
├── src/
│   └── lib.rs              # Rust implementations of all filters
├── js-filter.js            # JavaScript implementations
├── main.js                 # UI logic and event handlers
├── index.html              # Main interface
├── Cargo.toml              # Rust dependencies
├── pkg/                    # Generated WASM files (after build)
└── README.md
```

## Usage

### Manual Testing (index.html)
1. **Upload an Image** - Click the file input and select any image
2. **Choose a Filter** - Click any button to apply a filter
3. **Compare Performance** - Try both WASM (red) and JS (green) versions
4. **Reset** - Click the reset button to restore the original image

### Automated Benchmarking (benchmark.html)
For comprehensive performance testing:
1. Open `benchmark.html` in your browser
2. Upload an image
3. Click "Run Full Benchmark" (5 iterations) or choose:
   - "Quick Test" - 3 iterations, faster results
   - "Thorough Test" - 10 iterations, more accurate
4. View detailed results including:
   - Median execution times for each filter
   - Speedup calculations (WASM vs JS)
   - Statistics on WASM wins vs JS wins
   - Average speedup across all filters

## Technical Details

### Rust Implementation
The Rust code uses `wasm-bindgen` to expose functions to JavaScript:
```rust
#[wasm_bindgen]
pub fn grayscale(data: &mut [u8]) {
    // Direct memory manipulation for maximum speed
}
```

### JavaScript Implementation
Standard Canvas API operations:
```javascript
export function grayscaleJS(data) {
    // Pixel-by-pixel processing
}
```

### Performance Optimizations

#### Rust/WASM Optimizations
- **LTO (Link Time Optimization)**: Enabled for cross-function optimizations
- **Single codegen unit**: Maximum optimization at compile time
- **Bulk memory operations**: Faster memory operations (fill, copy)
- **Non-trapping float-to-int**: Hardware-level float conversions
- **chunks_exact iterator**: SIMD-friendly memory access patterns
- **Unsafe optimizations**: Removed bounds checks in hot loops where safe
- **Zero-copy data sharing**: Direct memory access between JS and WASM
- **No panic unwinding**: Smaller binary size with `panic = "abort"`

#### JavaScript Optimizations
- **Typed arrays**: Using Uint8ClampedArray for better performance
- **Minimal allocations**: Reusing buffers where possible
- **Hot loop optimization**: Simple, JIT-friendly code patterns
- **Cache array length**: Store `data.length` in local variable to avoid repeated property access
- **Bitwise operations**: Use `| 0` for fast float-to-int conversion (faster than Math.floor)
- **Ternary over Math.min/max**: `x > 255 ? 255 : x` is faster than `Math.min(255, x)`
- **Bit shifting for multiply by 4**: `x << 2` instead of `x * 4`
- **Loop unrolling**: Manually unrolled kernel operations in sharpen/edge detect
- **Pre-computed bounds**: Calculate min/max once instead of per-pixel
- **Inverse multiplication**: `x * invCount` faster than `x / count` (one division vs many)
- **Local variable caching**: Reduce property lookups in hot loops
- **Flattened array access**: Direct index calculation instead of nested lookups

#### Compiler Flags
```toml
[profile.release]
opt-level = 3              # Maximum optimization
lto = true                 # Link-time optimization
codegen-units = 1          # Single unit for better optimization
panic = "abort"            # No unwinding overhead
strip = true               # Remove debug symbols

[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-O3", "--enable-bulk-memory", "--enable-nontrapping-float-to-int"]
```

## Development

### Modify Filters
1. Edit `src/lib.rs` for Rust implementations
2. Edit `js-filter.js` for JavaScript implementations
3. Rebuild WASM: `wasm-pack build --target web --out-dir pkg`
4. Refresh browser

### Add New Filters
1. Implement in `src/lib.rs` with `#[wasm_bindgen]`
2. Implement JS version in `js-filter.js`
3. Add buttons in `index.html`
4. Wire up event handlers in `main.js`
5. Rebuild WASM

## Browser Compatibility

- Chrome/Edge 57+
- Firefox 52+
- Safari 11+
- Any modern browser with WebAssembly support

## Performance Tips

- **Use larger images** (1000x1000+) for more noticeable performance differences
- **Advanced filters** (blur, edge detection) show the most dramatic improvements (10-50x)
- **Simple filters** (grayscale, invert) still show 2-5x speedup
- **Warmup runs**: First execution may be slower due to JIT compilation
- **Use benchmark.html**: For accurate, statistical measurements with median times
- Results may vary based on:
  - Image size and complexity
  - Browser engine (V8, SpiderMonkey, JavaScriptCore)
  - CPU architecture and capabilities
  - Available memory

## Common Issues

### WASM seems slower than expected?
1. Make sure you're using a **release build**: `wasm-pack build --release`
2. Test with **larger images** - overhead dominates on small images
3. Use the **benchmark page** for accurate median measurements
4. Check browser console for WASM compilation errors
5. Ensure bulk memory is supported by your browser

### Why is the first run slower?
- WASM modules require compilation on first load
- Browser JIT warmup for JavaScript code
- Use the benchmark tool which includes warmup iterations

## License

MIT

## Contributing

Contributions are welcome! Feel free to:
- Add new image filters
- Optimize existing implementations
- Improve the UI/UX
- Add benchmarking features
- Write tests

## Acknowledgments

- Built with [Rust](https://www.rust-lang.org/) and [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen)
- Inspired by the need to demonstrate WASM's real-world performance benefits

---

**Made with Rust + WebAssembly**
