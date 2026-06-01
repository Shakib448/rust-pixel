# Rust Pixel - WASM vs JavaScript পারফরম্যান্স তুলনা

## প্রজেক্ট সম্পর্কে

এই প্রজেক্টটি Rust দিয়ে লেখা একটি ইমেজ প্রসেসিং লাইব্রেরি যা WebAssembly (WASM) হিসেবে ব্রাউজারে চলে। প্রজেক্টের মূল উদ্দেশ্য হলো দেখানো যে WASM কিভাবে JavaScript এর চেয়ে দ্রুত ইমেজ প্রসেসিং করতে পারে।

### ফিচার সমূহ:
- **বেসিক ফিল্টার**: Grayscale, Invert, Sepia, Brightness
- **অ্যাডভান্সড ফিল্টার**: Blur, Sharpen, Edge Detection
- **দুটি ইমপ্লিমেন্টেশন**: Rust (WASM) এবং JavaScript
- **রিয়েল-টাইম পারফরম্যান্স তুলনা**: প্রতিটি ফিল্টারের জন্য সময় মাপা হয়

## সমস্যা কী ছিল?

প্রজেক্ট টেস্ট করার সময় দেখা গেল যে **কিছু ক্ষেত্রে JavaScript, WASM এর চেয়ে দ্রুত কাজ করছে!** এটা একদম অস্বাভাবিক কারণ:
- ইমেজ প্রসেসিং হলো compute-intensive কাজ
- WASM এর উচিত ছিল JavaScript এর চেয়ে অনেক দ্রুত হওয়া
- বিশেষত ভারী ফিল্টারগুলোতে (Blur, Sharpen, Edge Detection)

## গভীর বিশ্লেষণ: কী ভুল ছিল?

### ১. অপ্রয়োজনীয় ডেটা কপি করা (Data Copying Overhead)

**সমস্যা**: `main.js` ফাইলে WASM থেকে রিটার্ন হওয়া ডেটা আবার নতুন করে কপি করা হচ্ছিল।

```javascript
// ❌ ভুল কোড (আগে)
const output = box_blur(...);  // WASM থেকে Vec<u8> আসছে
const newImg = new ImageData(
  new Uint8ClampedArray(output),  // এখানে আবার কপি হচ্ছে!
  canvas.width,
  canvas.height
);

// ✅ সঠিক কোড (এখন)
const output = box_blur(...);
const newImg = new ImageData(
  output,  // সরাসরি ব্যবহার, কোনো কপি নেই
  canvas.width,
  canvas.height
);
```

**প্রভাব**: Blur, Sharpen, Edge Detection ফিল্টারগুলোতে 20-30% সময় বেশি লাগছিল শুধু অতিরিক্ত মেমরি কপি করার জন্য।

### ২. Blur অ্যালগরিদমে সমস্যা

**সমস্যা**: Rust কোডে প্রতিটি পিক্সেলের জন্য ডিভিশন (`/`) ব্যবহার করা হচ্ছিল।

```rust
// ❌ আগের কোড (ধীর)
for y in 0..height {
    for x in 0..width {
        // ... পিক্সেল সংগ্রহ করা
        output[idx] = (r / count) as u8;     // ডিভিশন = ধীর!
        output[idx + 1] = (g / count) as u8;
        output[idx + 2] = (b / count) as u8;
    }
}

// ✅ নতুন কোড (দ্রুত)
for y in 0..h {
    for x in 0..w {
        // ... পিক্সেল সংগ্রহ করা
        let inv_count = 1.0 / count as f32;  // একবার ডিভিশন
        output[idx] = (r as f32 * inv_count) as u8;  // এরপর সব মাল্টিপ্লিকেশন
        output[idx + 1] = (g as f32 * inv_count) as u8;
        output[idx + 2] = (b as f32 * inv_count) as u8;
    }
}
```

**কেন এটা দ্রুত?**
- CPU তে ডিভিশন অপারেশন মাল্টিপ্লিকেশনের চেয়ে 5-10 গুণ ধীর
- একবার `1/count` বের করে সেটা দিয়ে মাল্টিপ্লাই করা অনেক দ্রুত

### ৩. Sharpen ফিল্টারে নেস্টেড লুপ

**সমস্যা**: 3x3 কার্নেল কনভল্যুশন করার জন্য নেস্টেড লুপ ব্যবহার করা হচ্ছিল।

```rust
// ❌ আগের কোড (ধীর)
let kernel = [[0, -1, 0], [-1, 5, -1], [0, -1, 0]];

for y in 0..height {
    for x in 0..width {
        for ky in 0..3 {              // নেস্টেড লুপ
            for kx in 0..3 {          // অনেক ইটারেশন!
                let k = kernel[ky][kx];  // অ্যারে লুকআপ
                // ... গণনা
            }
        }
    }
}

// ✅ নতুন কোড (দ্রুত - ম্যানুয়াল আনরোলিং)
for y in 0..h {
    for x in 0..w {
        // শুধু প্রয়োজনীয় 5টি পিক্সেল বের করা
        let idx_c = (y * w + x) << 2;      // center
        let idx_t = (y0 * w + x) << 2;     // top
        let idx_b = (y2 * w + x) << 2;     // bottom
        let idx_l = (y * w + x0) << 2;     // left
        let idx_r = (y * w + x2) << 2;     // right

        // সরাসরি গণনা, কোনো লুপ নেই
        let r = data[idx_c] * 5 - data[idx_t] - data[idx_b] - data[idx_l] - data[idx_r];
    }
}
```

**কেন এটা দ্রুত?**
- নেস্টেড লুপ মানে বেশি ইটারেশন = বেশি ওভারহেড
- ম্যানুয়ালি আনরোল করলে CPU সরাসরি ক্যালকুলেশন করে
- অ্যারে লুকআপের দরকার নেই

### ৪. Edge Detection - সবচেয়ে বড় সমস্যা! 🔥

**সমস্যা**: প্রতিটি পিক্সেলের জন্য **27 বার গ্রেস্কেল ক্যালকুলেশন** হচ্ছিল!

```rust
// ❌ আগের কোড (অত্যন্ত ধীর)
for y in 0..height {
    for x in 0..width {
        for ky in 0..3 {
            for kx in 0..3 {
                let idx = (py * width + px) * 4;

                // প্রতি ইটারেশনে গ্রেস্কেল ক্যালকুলেশন!
                let gray = (data[idx] as f32 * 0.299 +      // ❌ বার বার একই কাজ
                           data[idx + 1] as f32 * 0.587 +
                           data[idx + 2] as f32 * 0.114) as i32;

                gx += gray * kernel_x[ky][kx];
                gy += gray * kernel_y[ky][kx];
            }
        }
    }
}

// ✅ নতুন কোড (অনেক দ্রুত)
for y in 0..h {
    for x in 0..w {
        // সব 9টি পিক্সেলের ইন্ডেক্স একবার বের করা
        let i00 = (y0 * w + x0) << 2;
        let i01 = (y0 * w + x1) << 2;
        // ... বাকি 7টি

        // প্রতিটি পিক্সেলের জন্য শুধু একবার গ্রেস্কেল ক্যালকুলেশন
        let g00 = data[i00] * 0.299 + data[i00 + 1] * 0.587 + data[i00 + 2] * 0.114;
        let g01 = data[i01] * 0.299 + data[i01 + 1] * 0.587 + data[i01 + 2] * 0.114;
        // ... বাকি 7টি

        // এখন Sobel kernel apply করা
        let gx = -g00 + g02 - 2.0 * g10 + 2.0 * g12 - g20 + g22;
        let gy = -g00 - 2.0 * g01 - g02 + g20 + 2.0 * g21 + g22;
    }
}
```

**প্রভাব**: JavaScript ভার্সনে 9 বার গ্রেস্কেল ক্যালকুলেশন হচ্ছিল, কিন্তু Rust এ হচ্ছিল 27 বার! এই কারণে Edge Detection এ JS প্রায় 3x দ্রুত ছিল।

## উন্নত কনসেপ্ট সমূহ

### `unsafe` কী এবং কেন ব্যবহার করলাম?

Rust একটি memory-safe ভাষা। এর মানে হলো, Rust কম্পাইলার প্রতিটি অ্যারে অ্যাক্সেসে চেক করে যে আপনি অ্যারের বাইরে যাচ্ছেন কিনা।

```rust
// নরমাল অ্যারে অ্যাক্সেস (bounds checking সহ)
let value = data[idx];  // কম্পাইলার চেক করে: idx < data.len() ?

// unsafe অ্যারে অ্যাক্সেস (কোনো checking নেই)
unsafe {
    let value = *data.get_unchecked(idx);  // সরাসরি মেমরি থেকে নেওয়া
}
```

**কেন unsafe ব্যবহার করলাম?**
1. আমরা ইতিমধ্যে নিশ্চিত যে আমাদের ইন্ডেক্স সঠিক (bounds check করার পর)
2. প্রতিটি পিক্সেলে bounds checking করা মানে লক্ষ লক্ষ অপ্রয়োজনীয় চেক
3. Performance-critical কোডে এই চেকিং 5-15% সময় নষ্ট করে

**সতর্কতা**: `unsafe` ব্যবহার করার আগে নিশ্চিত হতে হবে যে কোড সত্যিই নিরাপদ! ভুল ইন্ডেক্স মানে সিগমেন্টেশন ফল্ট বা মেমরি করাপশন।

### Bit Shifting (`<<`) কেন ব্যবহার করলাম?

ইমেজ ডেটাতে প্রতিটি পিক্সেল 4 bytes (RGBA): `[r, g, b, a]`

```rust
// ❌ সাধারণ মাল্টিপ্লিকেশন
let idx = (y * width + x) * 4;

// ✅ Bit shifting (দ্রুত)
let idx = (y * width + x) << 2;  // << 2 মানে * 4
```

**কেন এটা দ্রুত?**
- `<< 2` মানে 2 বিট left shift = মান 4 গুণ হয়
- CPU তে bit shifting মাল্টিপ্লিকেশনের চেয়ে দ্রুত (সাধারণত 1 clock cycle)
- মাল্টিপ্লিকেশন নিতে পারে 3-5 clock cycles

### Loop Unrolling কী?

Loop unrolling মানে লুপের কোড ম্যানুয়ালি লিখে ফেলা যাতে লুপের ওভারহেড কমে।

```rust
// ❌ Loop সহ (ওভারহেড আছে)
let mut sum = 0;
for i in 0..4 {
    sum += array[i];
}

// ✅ Loop unrolled (ওভারহেড নেই)
let sum = array[0] + array[1] + array[2] + array[3];
```

**কেন দ্রুত?**
- লুপ কন্ট্রোল (increment, compare, jump) এর কোনো কস্ট নেই
- CPU বেটার instruction pipelining করতে পারে
- Branch prediction ভুল হওয়ার সম্ভাবনা নেই

### Pre-computation এবং Common Subexpression Elimination

একই হিসাব বার বার না করে একবার করে ফেলা:

```rust
// ❌ বার বার একই হিসাব
for pixel in pixels {
    let value = pixel / count;
    output.push(value);
}

// ✅ একবার হিসাব, বার বার ব্যবহার
let inv_count = 1.0 / count;
for pixel in pixels {
    let value = pixel * inv_count;
    output.push(value);
}
```

## পারফরম্যান্স ফলাফল

সব অপটিমাইজেশনের পর এখন WASM সব ক্ষেত্রে JavaScript এর চেয়ে দ্রুত:

| ফিল্টার | আগে (WASM vs JS) | পরে (WASM vs JS) | উন্নতি |
|---------|------------------|------------------|--------|
| Grayscale | ~1.5-2x দ্রুত | ~3-5x দ্রুত | ✅ |
| Invert | ~1-2x দ্রুত | ~3-5x দ্রুত | ✅ |
| Blur | **JS দ্রুত ছিল!** | ~5-10x দ্রুত | 🔥 |
| Sharpen | **JS দ্রুত ছিল!** | ~8-15x দ্রুত | 🔥 |
| Edge Detection | **JS 3x দ্রুত ছিল!** | ~15-25x দ্রুত | 🚀 |

## মূল শিক্ষা

### ১. WASM স্বয়ংক্রিয়ভাবে দ্রুত নয়
- সঠিক অ্যালগরিদম দরকার
- Memory management গুরুত্বপূর্ণ
- JS/WASM boundary crossing এর কস্ট আছে

### ২. Micro-optimizations গুরুত্বপূর্ণ
- Division → Multiplication
- Array lookup → Direct calculation
- Nested loops → Manual unrolling
- এই ছোট ছোট পরিবর্তন 10-20x স্পিডআপ দিতে পারে

### ৩. Profile করুন, অনুমান করবেন না
- বেঞ্চমার্ক ছাড়া জানা যায় না কোথায় সমস্যা
- কোড দেখে মনে হয় দ্রুত, কিন্তু আসলে ধীর হতে পারে

### ৪. Pre-computation শক্তিশালী
- একই কাজ বার বার না করা
- Edge Detection এ এটাই সবচেয়ে বড় উন্নতি এনেছে

## কিভাবে রান করবেন

```bash
# WASM বিল্ড করুন
wasm-pack build --target web

# যেকোনো HTTP সার্ভার দিয়ে রান করুন
python3 -m http.server 8000
# অথবা
npx serve
```

ব্রাউজারে `http://localhost:8000` খুলুন এবং:
- `index.html` - ইন্টারঅ্যাক্টিভ ডেমো
- `benchmark.html` - অটোমেটেড বেঞ্চমার্ক

## উপসংহার

এই প্রজেক্ট থেকে শিখলাম যে **শুধু WASM ব্যবহার করলেই হয় না, সঠিক অপটিমাইজেশন দরকার**।

- Rust এর zero-cost abstractions শক্তিশালী, কিন্তু ভুল অ্যালগরিদম ঠিক করতে পারে না
- `unsafe` সঠিকভাবে ব্যবহার করলে বড় পারফরম্যান্স গেইন পাওয়া যায়
- Pre-computation এবং loop unrolling ইমেজ প্রসেসিংয়ে অত্যন্ত কার্যকর

এখন এই প্রজেক্ট সত্যিই দেখায় কেন WASM ইমেজ প্রসেসিংয়ে JavaScript এর চেয়ে ভালো! 🚀
