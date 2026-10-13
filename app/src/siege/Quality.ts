// Presentation only: simulation frequency, targeting, damage and wave data never
// depend on the tier. Pauses/loading don't contribute to the measured window.
export class Quality {
  tier = 0
  enabled = true
  fps = 60
  private elapsed = 0
  private frames = 0
  private healthy = 0
  update(ms: number, active: boolean): boolean {
    if (!this.enabled || !active || ms > 1000) { this.elapsed = 0; this.frames = 0; this.healthy = 0; return false }
    this.elapsed += ms; this.frames++
    if (this.elapsed < 2000) return false
    this.fps = this.frames * 1000 / this.elapsed
    this.healthy = this.fps > 58 ? this.healthy + this.elapsed : 0
    const before = this.tier
    if (this.fps < 55 && this.tier < 3) { this.tier++; this.healthy = 0 }
    else if (this.healthy >= 10000 && this.tier > 0) { this.tier--; this.healthy = 0 }
    this.elapsed = 0; this.frames = 0
    return before !== this.tier
  }
}
