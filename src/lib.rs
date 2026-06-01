use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn grayscale(data: &mut [u8]) {
    for chunk in data.chunks_exact_mut(4) {
        let r = unsafe { *chunk.get_unchecked(0) } as f32;
        let g = unsafe { *chunk.get_unchecked(1) } as f32;
        let b = unsafe { *chunk.get_unchecked(2) } as f32;
        let gray = (r * 0.299 + g * 0.587 + b * 0.114) as u8;
        chunk[0] = gray;
        chunk[1] = gray;
        chunk[2] = gray;
    }
}

#[wasm_bindgen]
pub fn box_blur(data: &[u8], width: usize, height: usize, radius: i32) -> Vec<u8> {
    let mut output = vec![0u8; data.len()];
    let w = width as i32;
    let h = height as i32;
    let w_minus_1 = w - 1;
    let h_minus_1 = h - 1;

    for y in 0..h {
        let y_idx = y * w;
        for x in 0..w {
            let (mut r, mut g, mut b, mut a) = (0u32, 0u32, 0u32, 0u32);

            let y_min = (y - radius).max(0);
            let y_max = (y + radius).min(h_minus_1);
            let x_min = (x - radius).max(0);
            let x_max = (x + radius).min(w_minus_1);

            let mut count = 0u32;

            for ny in y_min..=y_max {
                let row_idx = (ny * w * 4) as usize;
                for nx in x_min..=x_max {
                    let idx = row_idx + ((nx << 2) as usize);
                    r += unsafe { *data.get_unchecked(idx) } as u32;
                    g += unsafe { *data.get_unchecked(idx + 1) } as u32;
                    b += unsafe { *data.get_unchecked(idx + 2) } as u32;
                    a += unsafe { *data.get_unchecked(idx + 3) } as u32;
                    count += 1;
                }
            }

            let inv_count = 1.0 / count as f32;
            let idx = ((y_idx + x) << 2) as usize;
            output[idx] = (r as f32 * inv_count) as u8;
            output[idx + 1] = (g as f32 * inv_count) as u8;
            output[idx + 2] = (b as f32 * inv_count) as u8;
            output[idx + 3] = (a as f32 * inv_count) as u8;
        }
    }
    output
}

#[wasm_bindgen]
pub fn invert(data: &mut [u8]) {
    for chunk in data.chunks_exact_mut(4) {
        chunk[0] = 255 - chunk[0];
        chunk[1] = 255 - chunk[1];
        chunk[2] = 255 - chunk[2];
    }
}

#[wasm_bindgen]
pub fn sharpen(data: &[u8], width: usize, height: usize) -> Vec<u8> {
    let mut output = vec![0u8; data.len()];
    let w = width;
    let h = height;
    let w_minus_1 = width - 1;
    let h_minus_1 = height - 1;

    // Manually unrolled sharpen kernel: [0,-1,0],[-1,5,-1],[0,-1,0]
    for y in 0..h {
        for x in 0..w {
            let x0 = if x == 0 { 0 } else { x - 1 };
            let x2 = if x == w_minus_1 { w_minus_1 } else { x + 1 };
            let y0 = if y == 0 { 0 } else { y - 1 };
            let y2 = if y == h_minus_1 { h_minus_1 } else { y + 1 };

            let idx_c = (y * w + x) << 2;      // center
            let idx_t = (y0 * w + x) << 2;     // top
            let idx_b = (y2 * w + x) << 2;     // bottom
            let idx_l = (y * w + x0) << 2;     // left
            let idx_r = (y * w + x2) << 2;     // right

            unsafe {
                let r = (*data.get_unchecked(idx_c) as i32) * 5
                    - (*data.get_unchecked(idx_t) as i32)
                    - (*data.get_unchecked(idx_b) as i32)
                    - (*data.get_unchecked(idx_l) as i32)
                    - (*data.get_unchecked(idx_r) as i32);

                let g = (*data.get_unchecked(idx_c + 1) as i32) * 5
                    - (*data.get_unchecked(idx_t + 1) as i32)
                    - (*data.get_unchecked(idx_b + 1) as i32)
                    - (*data.get_unchecked(idx_l + 1) as i32)
                    - (*data.get_unchecked(idx_r + 1) as i32);

                let b = (*data.get_unchecked(idx_c + 2) as i32) * 5
                    - (*data.get_unchecked(idx_t + 2) as i32)
                    - (*data.get_unchecked(idx_b + 2) as i32)
                    - (*data.get_unchecked(idx_l + 2) as i32)
                    - (*data.get_unchecked(idx_r + 2) as i32);

                *output.get_unchecked_mut(idx_c) = r.clamp(0, 255) as u8;
                *output.get_unchecked_mut(idx_c + 1) = g.clamp(0, 255) as u8;
                *output.get_unchecked_mut(idx_c + 2) = b.clamp(0, 255) as u8;
                *output.get_unchecked_mut(idx_c + 3) = *data.get_unchecked(idx_c + 3);
            }
        }
    }
    output
}

#[wasm_bindgen]
pub fn edge_detect(data: &[u8], width: usize, height: usize) -> Vec<u8> {
    let mut output = vec![0u8; data.len()];
    let w = width;
    let h = height;
    let w_minus_1 = width - 1;
    let h_minus_1 = height - 1;

    // Manually unrolled Sobel operator
    // X: [[-1,0,1],[-2,0,2],[-1,0,1]]
    // Y: [[-1,-2,-1],[0,0,0],[1,2,1]]
    for y in 0..h {
        for x in 0..w {
            let x0 = if x == 0 { 0 } else { x - 1 };
            let x1 = x;
            let x2 = if x == w_minus_1 { w_minus_1 } else { x + 1 };
            let y0 = if y == 0 { 0 } else { y - 1 };
            let y1 = y;
            let y2 = if y == h_minus_1 { h_minus_1 } else { y + 1 };

            // Get all 9 indices
            let i00 = (y0 * w + x0) << 2;
            let i01 = (y0 * w + x1) << 2;
            let i02 = (y0 * w + x2) << 2;
            let i10 = (y1 * w + x0) << 2;
            let i12 = (y1 * w + x2) << 2;
            let i20 = (y2 * w + x0) << 2;
            let i21 = (y2 * w + x1) << 2;
            let i22 = (y2 * w + x2) << 2;

            unsafe {
                // Calculate grayscale for all 9 pixels
                let g00 = *data.get_unchecked(i00) as f32 * 0.299
                    + *data.get_unchecked(i00 + 1) as f32 * 0.587
                    + *data.get_unchecked(i00 + 2) as f32 * 0.114;
                let g01 = *data.get_unchecked(i01) as f32 * 0.299
                    + *data.get_unchecked(i01 + 1) as f32 * 0.587
                    + *data.get_unchecked(i01 + 2) as f32 * 0.114;
                let g02 = *data.get_unchecked(i02) as f32 * 0.299
                    + *data.get_unchecked(i02 + 1) as f32 * 0.587
                    + *data.get_unchecked(i02 + 2) as f32 * 0.114;
                let g10 = *data.get_unchecked(i10) as f32 * 0.299
                    + *data.get_unchecked(i10 + 1) as f32 * 0.587
                    + *data.get_unchecked(i10 + 2) as f32 * 0.114;
                let g12 = *data.get_unchecked(i12) as f32 * 0.299
                    + *data.get_unchecked(i12 + 1) as f32 * 0.587
                    + *data.get_unchecked(i12 + 2) as f32 * 0.114;
                let g20 = *data.get_unchecked(i20) as f32 * 0.299
                    + *data.get_unchecked(i20 + 1) as f32 * 0.587
                    + *data.get_unchecked(i20 + 2) as f32 * 0.114;
                let g21 = *data.get_unchecked(i21) as f32 * 0.299
                    + *data.get_unchecked(i21 + 1) as f32 * 0.587
                    + *data.get_unchecked(i21 + 2) as f32 * 0.114;
                let g22 = *data.get_unchecked(i22) as f32 * 0.299
                    + *data.get_unchecked(i22 + 1) as f32 * 0.587
                    + *data.get_unchecked(i22 + 2) as f32 * 0.114;

                // Apply Sobel kernels
                let gx = -g00 + g02 - 2.0 * g10 + 2.0 * g12 - g20 + g22;
                let gy = -g00 - 2.0 * g01 - g02 + g20 + 2.0 * g21 + g22;

                let magnitude = (gx * gx + gy * gy).sqrt().min(255.0) as u8;

                let idx = (y * w + x) << 2;
                *output.get_unchecked_mut(idx) = magnitude;
                *output.get_unchecked_mut(idx + 1) = magnitude;
                *output.get_unchecked_mut(idx + 2) = magnitude;
                *output.get_unchecked_mut(idx + 3) = 255;
            }
        }
    }
    output
}
