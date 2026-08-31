// Test FFT autocorrelation in JS matching scipy.signal.correlate

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function fft(real: Float32Array, imag: Float32Array, inverse: boolean = false) {
  const n = real.length;
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr;
      const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (inverse ? 2 : -2) * Math.PI / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < half; k++) {
        const u = i + k;
        const v = u + half;
        const vr = real[v] * wR - imag[v] * wI;
        const vi = real[v] * wI + imag[v] * wR;

        real[v] = real[u] - vr;
        imag[v] = imag[u] - vi;
        real[u] += vr;
        imag[u] += vi;

        const nextWR = wR * wStepR - wI * wStepI;
        wI = wR * wStepI + wI * wStepR;
        wR = nextWR;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

export function correlateFFT(signal: Float32Array): Float32Array {
  const n = signal.length;
  const fftSize = nextPowerOf2(2 * n);

  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  for (let i = 0; i < n; i++) {
    real[i] = signal[i];
  }

  fft(real, imag, false);

  // Power spectral density (multiply by complex conjugate: (a+bi)(a-bi) = a^2 + b^2)
  for (let i = 0; i < fftSize; i++) {
    real[i] = real[i] * real[i] + imag[i] * imag[i];
    imag[i] = 0;
  }

  // Inverse FFT
  fft(real, imag, true);

  // The non-negative lag autocorrelation is in real[0 ... n-1]
  return real.subarray(0, n);
}
