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

1. **Upload an Image** - Click the file input and select any image
2. **Choose a Filter** - Click any button to apply a filter
3. **Compare Performance** - Try both WASM (red) and JS (green) versions
4. **Reset** - Click the reset button to restore the original image

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
- **Rust**: Zero-copy data sharing, SIMD optimizations, compiler optimizations
- **JavaScript**: Typed arrays, minimal allocations
- **WASM**: Linear memory access, no garbage collection overhead

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

- Use larger images for more noticeable performance differences
- Advanced filters (blur, edge detection) show the most dramatic improvements
- Results may vary based on image size and device capabilities

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
