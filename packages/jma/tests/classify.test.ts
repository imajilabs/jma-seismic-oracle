import { describe, expect, test } from "bun:test";
import { classifyTitle } from "../src/classify.ts";

describe("classifyTitle", () => {
  test("classifies the Control/Title canonical name for VXSE53", () => {
    expect(classifyTitle("震源・震度に関する情報")).toBe("VXSE53");
  });

  test("classifies the Head/Title display variant for VXSE53", () => {
    // VXSE53's Head/Title is the abbreviated form
    expect(classifyTitle("震源・震度情報")).toBe("VXSE53");
  });

  test("VXSE53 takes precedence over VXSE52 (substring containment)", () => {
    // Critical: "震源・震度に関する情報" contains "震源に関する情報" — wrong order
    // would classify VXSE53 as VXSE52.
    expect(classifyTitle("震源・震度に関する情報")).toBe("VXSE53");
  });

  test("classifies VXSE52 standalone", () => {
    expect(classifyTitle("震源に関する情報")).toBe("VXSE52");
  });

  test("classifies VXSE51 / 震度速報", () => {
    expect(classifyTitle("震度速報")).toBe("VXSE51");
  });

  test("classifies VXSE54 / 推計震度分布図", () => {
    expect(classifyTitle("推計震度分布図")).toBe("VXSE54");
  });

  test("classifies VXSE61 / 顕著な地震", () => {
    expect(classifyTitle("顕著な地震の震源要素更新のお知らせ")).toBe("VXSE61");
  });

  test("classifies VXSE62 / 長周期地震動", () => {
    expect(classifyTitle("長周期地震動に関する観測情報")).toBe("VXSE62");
  });

  test("classifies tsunami warning vs information separately", () => {
    expect(classifyTitle("津波警報・注意報・予報a")).toBe("VTSE41");
    expect(classifyTitle("津波情報a")).toBe("VTSE51");
  });

  test("falls back to OTHER for unrelated titles", () => {
    expect(classifyTitle("降灰予報（定時）")).toBe("OTHER");
    expect(classifyTitle("火山の状況に関する解説情報")).toBe("OTHER");
    expect(classifyTitle("")).toBe("OTHER");
  });
});
