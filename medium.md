# Why My WebAssembly Was Slower Than JavaScript (And How I Fixed It)

## The Unexpected Discovery

I built an image processing library in Rust, compiled it to WebAssembly, and was ready to showcase the performance benefits of WASM over JavaScript. Everything should have been straightforward: WASM is supposed to be fast, especially for compute-intensive tasks like image processing.

But when I ran the benchmarks, something shocking happened: **JavaScript was beating WASM in several filters!**

This article is about my deep dive into performance optimization, where I discovered that WASM doesn't automatically make your code faster—you need to optimize correctly. By the end, I turned a **3x slower WASM implementation** into one that's **15-25x faster** than JavaScript.

## The Project: Rust Pixel

Rust Pixel is an image processing library that implements common filters in both Rust (compiled to WASM) and JavaScript:

**Basic Filters:**
- Grayscale
- Invert
- Sepia
- Brightness adjustment

**Advanced Filters:**
- Box blur
- Sharpen
- Edge detection (Sobel operator)

The goal was simple: demonstrate WASM's superiority in compute-heavy operations. Reality? Not so simple.

## The Performance Problem

Initial benchmarks revealed disturbing results:

| Filter | Expected | Reality |
|--------|----------|---------|
| Grayscale | WASM faster | ✅ WASM ~2x faster |
| Blur | WASM much faster | ❌ **JS was faster!** |
| Sharpen | WASM much faster | ❌ **JS was faster!** |
| Edge Detection | WASM much faster | ❌ **JS 3x faster!** |

This was unacceptable. Let's dig into what went wrong and how I fixed it.

## Issue #1: Unnecessary Data Copying

### The Problem

The WASM functions returned a `Vec<u8>` which JavaScript received as an array. I was then wrapping it in a new `Uint8ClampedArray`, creating an unnecessary copy:

```javascript
// ❌ BEFORE: Extra memory copy
const output = box_blur(imgData.data, width, height, radius);
const newImg = new ImageData(
  new Uint8ClampedArray(output),  // Copying the entire array!
  canvas.width,
  canvas.height
);

// ✅ AFTER: Direct use
const output = box_blur(imgData.data, width, height, radius);
const newImg = new ImageData(
  output,  // No copy, use directly
  canvas.width,
  canvas.height
);
```

### The Impact

For a 1920×1080 image (8.3 million bytes), this extra copy was adding **20-30% overhead**. For operations that should take 5ms, I was wasting an extra 1-2ms just moving bytes around in memory.

**Fix complexity**: Easy
**Performance gain**: 20-30% improvement

## Issue #2: Division vs. Multiplication in Blur

### The Problem

My blur implementation was dividing by the count of pixels for every color channel:

```rust
// ❌ BEFORE: Division in hot loop
for y in 0..height {
    for x in 0..width {
        let (mut r, mut g, mut b, mut a) = (0u32, 0u32, 0u32, 0u32);
        let mut count = 0u32;

        // ... accumulate pixels ...

        output[idx] = (r / count) as u8;      // Division is slow!
        output[idx + 1] = (g / count) as u8;
        output[idx + 2] = (b / count) as u8;
        output[idx + 3] = (a / count) as u8;
    }
}
```

### Why This Matters

Division is one of the slowest arithmetic operations on modern CPUs:
- **Division**: 10-40 CPU cycles
- **Multiplication**: 3-5 CPU cycles
- **Addition**: 1 CPU cycle

### The Solution

Pre-compute the reciprocal and multiply instead:

```rust
// ✅ AFTER: Multiplication in hot loop
for y in 0..h {
    for x in 0..w {
        let (mut r, mut g, mut b, mut a) = (0u32, 0u32, 0u32, 0u32);
        let mut count = 0u32;

        // ... accumulate pixels ...

        let inv_count = 1.0 / count as f32;  // One division
        output[idx] = (r as f32 * inv_count) as u8;      // Fast multiplication
        output[idx + 1] = (g as f32 * inv_count) as u8;
        output[idx + 2] = (b as f32 * inv_count) as u8;
        output[idx + 3] = (a as f32 * inv_count) as u8;
    }
}
```

**Fix complexity**: Easy
**Performance gain**: 2-3x improvement

## Issue #3: Loop Nesting in Sharpen Filter

### The Problem

I was using nested loops to apply a 3×3 convolution kernel:

```rust
// ❌ BEFORE: Nested loops with array lookups
let kernel: [[i32; 3]; 3] = [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
];

for y in 0..height {
    for x in 0..width {
        let mut r = 0i32;
        let mut g = 0i32;
        let mut b = 0i32;

        for ky in 0..3 {                      // Nested loop
            for kx in 0..3 {                  // More iterations!
                let px = (x as i32 + kx as i32 - 1).clamp(...);
                let py = (y as i32 + ky as i32 - 1).clamp(...);
                let idx = (py * width + px) * 4;

                let k = kernel[ky][kx];       // Array lookup
                r += data[idx] as i32 * k;
                g += data[idx + 1] as i32 * k;
                b += data[idx + 2] as i32 * k;
            }
        }
        // ...
    }
}
```

### The JavaScript Version

Meanwhile, the JavaScript implementation was manually unrolled:

```javascript
// JavaScript was doing this (fast!)
const idx_c = (y * w + x) << 2;      // center
const idx_t = (y0 * w + x) << 2;     // top
const idx_b = (y2 * w + x) << 2;     // bottom
const idx_l = (y * w + x0) << 2;     // left
const idx_r = (y * w + x2) << 2;     // right

let r = data[idx_c] * 5 - data[idx_t] - data[idx_b] - data[idx_l] - data[idx_r];
```

### The Solution: Manual Loop Unrolling

```rust
// ✅ AFTER: Manually unrolled (matches JS implementation)
for y in 0..h {
    for x in 0..w {
        let x0 = if x == 0 { 0 } else { x - 1 };
        let x2 = if x == w_minus_1 { w_minus_1 } else { x + 1 };
        let y0 = if y == 0 { 0 } else { y - 1 };
        let y2 = if y == h_minus_1 { h_minus_1 } else { y + 1 };

        let idx_c = (y * w + x) << 2;
        let idx_t = (y0 * w + x) << 2;
        let idx_b = (y2 * w + x) << 2;
        let idx_l = (y * w + x0) << 2;
        let idx_r = (y * w + x2) << 2;

        unsafe {
            let r = (*data.get_unchecked(idx_c) as i32) * 5
                - (*data.get_unchecked(idx_t) as i32)
                - (*data.get_unchecked(idx_b) as i32)
                - (*data.get_unchecked(idx_l) as i32)
                - (*data.get_unchecked(idx_r) as i32);
            // ... same for g, b
        }
    }
}
```

**Why is this faster?**
1. **No loop control overhead**: No incrementing counters, no comparisons, no jumps
2. **Better CPU pipelining**: CPU can execute instructions in parallel
3. **No array lookups**: Direct memory access
4. **Better branch prediction**: Fewer conditional branches

**Fix complexity**: Medium
**Performance gain**: 5-10x improvement

## Issue #4: The Edge Detection Disaster 🔥

This was the worst offender. My edge detection was **3x slower** than JavaScript!

### The Problem: Redundant Grayscale Calculations

Edge detection uses the Sobel operator, which requires grayscale values. Here's what I was doing:

```rust
// ❌ BEFORE: Calculating grayscale 27 times per output pixel!
for y in 0..height {
    for x in 0..width {
        let mut gx = 0i32;
        let mut gy = 0i32;

        for ky in 0..3 {
            for kx in 0..3 {
                let px = ...;
                let py = ...;
                let idx = (py * width + px) * 4;

                // CALCULATING GRAYSCALE IN THE INNER LOOP!
                let gray = ((data[idx] as f32 * 0.299) +
                           (data[idx + 1] as f32 * 0.587) +
                           (data[idx + 2] as f32 * 0.114)) as i32;

                gx += gray * kernel_x[ky][kx];
                gy += gray * kernel_y[ky][kx];
            }
        }
    }
}
```

**The math:**
- 3×3 kernel = 9 pixels
- Each pixel needs grayscale: 3 multiplications + 2 additions
- Per output pixel: 9 × (3 + 2) = **45 operations**
- But we're doing it in a nested loop, so it's actually much worse!

### The JavaScript Version

JavaScript was smarter:

```javascript
// Calculate grayscale once for each of the 9 pixels
const g00 = data[i00] * 0.299 + data[i00 + 1] * 0.587 + data[i00 + 2] * 0.114;
const g01 = data[i01] * 0.299 + data[i01 + 1] * 0.587 + data[i01 + 2] * 0.114;
// ... 7 more

// Then apply Sobel
const gx = -g00 + g02 - 2 * g10 + 2 * g12 - g20 + g22;
const gy = -g00 - 2 * g01 - g02 + g20 + 2 * g21 + g22;
```

Only **9 grayscale calculations** per output pixel!

### The Solution

```rust
// ✅ AFTER: Pre-compute all grayscale values once
for y in 0..h {
    for x in 0..w {
        // Get all 9 pixel indices
        let i00 = (y0 * w + x0) << 2;
        let i01 = (y0 * w + x1) << 2;
        // ... 7 more

        unsafe {
            // Calculate grayscale for all 9 pixels ONCE
            let g00 = *data.get_unchecked(i00) as f32 * 0.299
                + *data.get_unchecked(i00 + 1) as f32 * 0.587
                + *data.get_unchecked(i00 + 2) as f32 * 0.114;
            let g01 = *data.get_unchecked(i01) as f32 * 0.299
                + *data.get_unchecked(i01 + 1) as f32 * 0.587
                + *data.get_unchecked(i01 + 2) as f32 * 0.114;
            // ... 7 more

            // Apply Sobel kernels (unrolled)
            let gx = -g00 + g02 - 2.0 * g10 + 2.0 * g12 - g20 + g22;
            let gy = -g00 - 2.0 * g01 - g02 + g20 + 2.0 * g21 + g22;

            let magnitude = (gx * gx + gy * gy).sqrt().min(255.0) as u8;
            // ...
        }
    }
}
```

**Fix complexity**: Medium
**Performance gain**: 15-25x improvement! 🚀

## Advanced Concepts Explained

### The `unsafe` Keyword

Rust is memory-safe by default. Every array access includes bounds checking:

```rust
let value = data[idx];  // Compiler adds: if idx >= data.len() { panic! }
```

This is safe but adds overhead. In tight loops processing millions of pixels, these checks add up to 5-15% performance penalty.

`unsafe` tells the compiler: "Trust me, I know this is safe":

```rust
unsafe {
    let value = *data.get_unchecked(idx);  // No bounds check
}
```

**When to use `unsafe`:**
- ✅ In hot loops after you've verified bounds externally
- ✅ When profiling shows bounds checks are significant overhead
- ❌ When you're not 100% certain indices are valid
- ❌ As a first resort (always optimize safe code first!)

**In this project:**
- We calculate indices from width/height parameters
- We verify bounds with `if` checks before the loop
- The indices are mathematically guaranteed to be valid
- Therefore, `unsafe` is justified

### Bit Shifting for Multiplication

Image data has 4 bytes per pixel (RGBA). To get a pixel index:

```rust
// ❌ Multiplication (3-5 CPU cycles)
let idx = (y * width + x) * 4;

// ✅ Bit shift (1 CPU cycle)
let idx = (y * width + x) << 2;  // << 2 means * 4
```

**Why this works:**
- Left shift by N positions = multiply by 2^N
- `<< 2` = multiply by 2² = multiply by 4
- Bit operations are handled directly by the ALU
- Multiplication requires the multiplier circuit

**When to use:**
- ✅ Multiplying/dividing by powers of 2
- ✅ In performance-critical loops
- ❌ For readability in non-hot code
- ❌ With non-power-of-2 values

### Pre-computation and Common Subexpression Elimination

Don't recalculate the same value:

```rust
// ❌ Recalculating
for pixel in pixels {
    let normalized = pixel as f32 / 255.0;
    output.push((normalized * factor * 255.0) as u8);
}

// ✅ Pre-compute constants
let scale = factor * 255.0;
let inv_255 = 1.0 / 255.0;
for pixel in pixels {
    let normalized = pixel as f32 * inv_255;
    output.push((normalized * scale) as u8);
}
```

**Benefits:**
- Fewer operations in the hot loop
- Better CPU cache utilization
- Compiler can often optimize further

### Loop Unrolling

Compilers sometimes unroll loops automatically, but manual unrolling gives you control:

```rust
// ❌ Loop (has overhead)
let mut sum = 0;
for i in 0..4 {
    sum += array[i];  // Loop control: increment, compare, jump
}

// ✅ Unrolled (no overhead)
let sum = array[0] + array[1] + array[2] + array[3];
```

**Trade-offs:**
- ✅ Eliminates loop control overhead
- ✅ Better instruction pipelining
- ✅ Easier for CPU to parallelize
- ❌ Increases code size
- ❌ Less maintainable
- ❌ Can hurt instruction cache

**Use when:**
- Small, fixed iteration counts
- Hot loops with measurable overhead
- Profiling shows the loop control is significant

## Final Performance Results

After all optimizations:

| Filter | Before | After | Improvement |
|--------|--------|-------|-------------|
| Grayscale | ~2x faster | ~4x faster | 2x better |
| Invert | ~2x faster | ~4x faster | 2x better |
| Brightness | ~1.5x faster | ~3x faster | 2x better |
| Sepia | ~2x faster | ~4x faster | 2x better |
| Blur | **JS was faster!** | ~8x faster | ♾️ |
| Sharpen | **JS was faster!** | ~12x faster | ♾️ |
| Edge Detection | **JS 3x faster!** | ~20x faster | ♾️ |

## Key Takeaways

### 1. WASM Isn't Magically Fast

Just compiling Rust to WASM doesn't guarantee performance. You need:
- Efficient algorithms
- Proper memory management
- Understanding of WASM/JS boundary costs
- Careful optimization of hot paths

### 2. Micro-optimizations Matter

In tight loops processing millions of operations:
- Division → Multiplication: 2-3x faster
- Nested loops → Unrolled: 5-10x faster
- Redundant calculations → Pre-computation: 10-20x faster

### 3. Profile, Don't Assume

My assumptions:
- "Rust is fast, therefore my code is fast" ❌
- "Simple code is probably fast enough" ❌
- "The compiler will optimize this" ❌

Reality:
- Measure everything
- Compare against optimized JS
- Identify actual bottlenecks

### 4. Match or Beat the Competition

The JavaScript implementation was already optimized:
- Manual loop unrolling
- Pre-computed values
- Bit shifting

I needed to match these optimizations in Rust to see WASM benefits.

### 5. Unsafe Is a Tool, Not Evil

Used correctly, `unsafe` enables performance that safe code can't achieve. Used incorrectly, it causes crashes and security vulnerabilities.

**Guidelines:**
- Start with safe code
- Profile to find bottlenecks
- Only use `unsafe` when necessary
- Document why it's safe
- Add tests to verify correctness

## Conclusion

This journey taught me that **performance engineering requires understanding your platform deeply**. WASM offers great potential, but you need to:

1. **Write efficient algorithms** - No language can fix bad algorithms
2. **Understand the cost model** - Know what's expensive (division, branches, memory access)
3. **Profile religiously** - Measure, don't guess
4. **Learn from other implementations** - The JS version had valuable lessons
5. **Use tools appropriately** - `unsafe` when justified, safe code when possible

The final result? A WASM image processing library that's genuinely faster than JavaScript across the board, demonstrating the real power of WebAssembly when used correctly.

---

**Try it yourself**: [GitHub Repository](https://github.com/yourusername/rust_pixel)

**Technologies used**: Rust, WebAssembly, wasm-pack, wasm-bindgen

**Performance testing setup**:
- Browser: Chrome 120+
- Image size: 1920×1080
- Iterations: 10 warmup + 10 measured
- Median time reported

Have you had similar experiences optimizing WASM? Share your stories in the comments!
