export class FontSize {
  static readonly DEFAULT = 16;
  static readonly MIN = 8;
  static readonly MAX = 40;

  private constructor(readonly value: number) {}

  static create(value: number = FontSize.DEFAULT): FontSize {
    return new FontSize(Math.min(FontSize.MAX, Math.max(FontSize.MIN, Math.round(value))));
  }

  increase(): FontSize {
    return FontSize.create(this.value + 1);
  }

  decrease(): FontSize {
    return FontSize.create(this.value - 1);
  }

  reset(): FontSize {
    return FontSize.create();
  }
}
