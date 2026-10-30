export type FlowSignal = "pause" | "resume";

export class FlowControl {
  static readonly HIGH_WATERMARK = 512 * 1024;
  static readonly LOW_WATERMARK = 128 * 1024;

  private pending = 0;
  private paused = false;

  private constructor(
    private readonly high: number,
    private readonly low: number,
  ) {}

  static create(high: number = FlowControl.HIGH_WATERMARK, low: number = FlowControl.LOW_WATERMARK): FlowControl {
    if (low >= high) throw new Error("le seuil bas doit être inférieur au seuil haut");
    return new FlowControl(high, low);
  }

  get pendingBytes(): number {
    return this.pending;
  }

  received(bytes: number): FlowSignal | undefined {
    this.pending += bytes;
    if (this.paused || this.pending < this.high) return undefined;
    this.paused = true;
    return "pause";
  }

  rendered(bytes: number): FlowSignal | undefined {
    this.pending = Math.max(0, this.pending - bytes);
    if (!this.paused || this.pending > this.low) return undefined;
    this.paused = false;
    return "resume";
  }
}
