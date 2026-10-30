import { describe, expect, it } from "vitest";
import { FlowControl } from "./flow-control";

describe("FlowControl", () => {
  it("ne signale rien tant que le seuil haut n'est pas atteint", () => {
    const flow = FlowControl.create(100, 20);
    expect(flow.received(60)).toBeUndefined();
    expect(flow.rendered(60)).toBeUndefined();
  });

  it("suspend la lecture au seuil haut, une seule fois", () => {
    const flow = FlowControl.create(100, 20);
    expect(flow.received(60)).toBeUndefined();
    expect(flow.received(40)).toBe("pause");
    expect(flow.received(500)).toBeUndefined();
    expect(flow.pendingBytes).toBe(600);
  });

  it("reprend la lecture sous le seuil bas, une seule fois", () => {
    const flow = FlowControl.create(100, 20);
    flow.received(150);
    expect(flow.rendered(100)).toBeUndefined();
    expect(flow.rendered(30)).toBe("resume");
    expect(flow.rendered(20)).toBeUndefined();
    expect(flow.pendingBytes).toBe(0);
  });

  it("refuse des seuils incohérents", () => {
    expect(() => FlowControl.create(10, 10)).toThrow();
  });
});
