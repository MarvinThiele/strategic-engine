/**
 * Deterministic Random Number Generator
 * Ported from backend/engine/rng.py
 *
 * Uses a seeded PRNG for deterministic gameplay
 */

/**
 * Simple LCG (Linear Congruential Generator) for deterministic RNG
 * This matches the behavior of the Python numpy PCG64 generator closely enough
 * for game purposes.
 */
export class DRNG {
  private state: number;
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private readonly m = 2 ** 32;

  constructor(seed: number) {
    this.state = seed >>> 0; // Ensure unsigned 32-bit integer
  }

  /**
   * Generate next random number in [0, 1)
   */
  private next(): number {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state / this.m;
  }

  /**
   * Return true with probability p
   */
  bernoulli(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Return a random float in [a, b)
   */
  uniform(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  /**
   * Return a normally distributed random number
   * Uses Box-Muller transform
   * @param mean - mean of the distribution (default 0)
   * @param stdDev - standard deviation (default 1)
   */
  normal(mean: number = 0, stdDev: number = 1): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}
