import type { ReportKind } from "./types.ts";

// Match against Control/Title (canonical type name); Head/Title (display
// variant) is a fallback. Order matters: VXSE53 must come before VXSE52
// since VXSE53's title contains VXSE52's substring.
const TITLE_TO_KIND: Array<readonly [RegExp, ReportKind]> = [
  [/震源・震度に関する情報|震源・震度情報/, "VXSE53"],
  [/推計震度分布図/, "VXSE54"],
  [/震度速報/, "VXSE51"],
  [/震源に関する情報/, "VXSE52"],
  [/顕著な地震の震源要素更新/, "VXSE61"],
  [/長周期地震動に関する観測情報/, "VXSE62"],
  [/津波警報|津波注意報|津波予報/, "VTSE41"],
  [/津波情報/, "VTSE51"],
];

export function classifyTitle(title: string): ReportKind {
  for (const [re, kind] of TITLE_TO_KIND) {
    if (re.test(title)) return kind;
  }
  return "OTHER";
}
