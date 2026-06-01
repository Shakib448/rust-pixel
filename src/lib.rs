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

    for y in 0..height as i32 {
        for x in 0..width as i32 {
            let (mut r, mut g, mut b, mut a) = (0u32, 0u32, 0u32, 0u32);
            let mut count = 0u32;

            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    let nx = x + dx;
                    let ny = y + dy;
                    if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                        let idx = ((ny as usize * width + nx as usize) * 4) as usize;
                        r += data[idx] as u32;
                        g += data[idx + 1] as u32;
                        b += data[idx + 2] as u32;
                        a += data[idx + 3] as u32;
                        count += 1;
                    }
                }
            }

            let idx = ((y as usize * width + x as usize) * 4) as usize;
            output[idx] = (r / count) as u8;
            output[idx + 1] = (g / count) as u8;
            output[idx + 2] = (b / count) as u8;
            output[idx + 3] = (a / count) as u8;
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
pub fn brightness(data: &mut [u8], factor: f32) {
    for chunk in data.chunks_exact_mut(4) {
        chunk[0] = ((chunk[0] as f32 * factor).min(255.0)) as u8;
        chunk[1] = ((chunk[1] as f32 * factor).min(255.0)) as u8;
        chunk[2] = ((chunk[2] as f32 * factor).min(255.0)) as u8;
    }
}

#[wasm_bindgen]
pub fn sepia(data: &mut [u8]) {
    for chunk in data.chunks_exact_mut(4) {
        let r = chunk[0] as f32;
        let g = chunk[1] as f32;
        let b = chunk[2] as f32;

        chunk[0] = ((r * 0.393) + (g * 0.769) + (b * 0.189)).min(255.0) as u8;
        chunk[1] = ((r * 0.349) + (g * 0.686) + (b * 0.168)).min(255.0) as u8;
        chunk[2] = ((r * 0.272) + (g * 0.534) + (b * 0.131)).min(255.0) as u8;
    }
}

#[wasm_bindgen]
pub fn sharpen(data: &[u8], width: usize, height: usize) -> Vec<u8> {
    let mut output = vec![0u8; data.len()];

    // Sharpen kernel
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

            for ky in 0..3 {
                for kx in 0..3 {
                    let px = (x as i32 + kx as i32 - 1).clamp(0, width as i32 - 1) as usize;
                    let py = (y as i32 + ky as i32 - 1).clamp(0, height as i32 - 1) as usize;
                    let idx = (py * width + px) * 4;

                    let k = kernel[ky][kx];
                    r += data[idx] as i32 * k;
                    g += data[idx + 1] as i32 * k;
                    b += data[idx + 2] as i32 * k;
                }
            }

            let idx = (y * width + x) * 4;
            output[idx] = r.clamp(0, 255) as u8;
            output[idx + 1] = g.clamp(0, 255) as u8;
            output[idx + 2] = b.clamp(0, 255) as u8;
            output[idx + 3] = data[idx + 3];
        }
    }
    output
}

#[wasm_bindgen]
pub fn edge_detect(data: &[u8], width: usize, height: usize) -> Vec<u8> {
    let mut output = vec![0u8; data.len()];

    // Sobel operator
    let kernel_x: [[i32; 3]; 3] = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1],
    ];

    let kernel_y: [[i32; 3]; 3] = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1],
    ];

    for y in 0..height {
        for x in 0..width {
            let mut gx = 0i32;
            let mut gy = 0i32;

            for ky in 0..3 {
                for kx in 0..3 {
                    let px = (x as i32 + kx as i32 - 1).clamp(0, width as i32 - 1) as usize;
                    let py = (y as i32 + ky as i32 - 1).clamp(0, height as i32 - 1) as usize;
                    let idx = (py * width + px) * 4;

                    // Use grayscale value for edge detection
                    let gray = ((data[idx] as f32 * 0.299) +
                               (data[idx + 1] as f32 * 0.587) +
                               (data[idx + 2] as f32 * 0.114)) as i32;

                    gx += gray * kernel_x[ky][kx];
                    gy += gray * kernel_y[ky][kx];
                }
            }

            let magnitude = ((gx * gx + gy * gy) as f32).sqrt().min(255.0) as u8;
            let idx = (y * width + x) * 4;
            output[idx] = magnitude;
            output[idx + 1] = magnitude;
            output[idx + 2] = magnitude;
            output[idx + 3] = 255;
        }
    }
    output
}
