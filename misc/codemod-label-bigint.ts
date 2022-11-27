import jscodeshiftCore, { ASTPath } from "jscodeshift";
import type { JSCodeshift } from "jscodeshift";
import process from "node:process";
import fs from "node:fs";
import assert from "node:assert/strict";
import { detectBigint } from "./detect-bigint";
import { Printable } from "jscodeshift";

// cli usage:
//   node -r esbuild-register misc/codemod-label-bigint.ts src/bigdecimal.ts src/bigdecimal-label-bigint.ts

async function main() {
  const [inFile, outFile] = process.argv.slice(2);
  const jscodeshift = jscodeshiftCore.withParser("ts");

  // collect `bigint` type expressions via ts-morph/typescript compiler api
  const detections = detectBigint("./tsconfig.json", inFile);
  function isBigInt(node: Printable) {
    assert.ok(node.loc);
    const start = (node.loc.start as any).index;
    const end = (node.loc.end as any).index;
    assert.ok(typeof start === "number" && typeof end === "number");
    const found = detections.find(
      (d) => d.range[0] === start && d.range[1] === end
    );
    return Boolean(found);
  }

  const inSource = await fs.promises.readFile(inFile, "utf-8");
  const outSource = transform(inSource, jscodeshift, isBigInt);

  if (outFile == "--") {
    process.stdout.write(outSource);
  } else {
    fs.promises.writeFile(outFile, outSource);
  }
}

//
// transform
//

function transform(
  source: string,
  j: JSCodeshift,
  isBigInt: (node: Printable) => boolean
): string {
  const $j = j(source);

  // we process in two steps since `isBigInt` works only for original source

  // collect bigint expression paths
  let matches: ASTPath<any>[] = [];
  for (const p of $j.find(j.Expression).paths()) {
    // filter out invalid AST
    const parentValue = p.parent.value;
    if (
      // prettier-ignore
      (j.MemberExpression.check(parentValue) && parentValue.property === p.value) ||
      (j.VariableDeclarator.check(parentValue) && parentValue.id === p.value) ||
      (j.ClassProperty.check(parentValue) && parentValue.key === p.value) ||
      (j.AssignmentExpression.check(parentValue) && parentValue.left === p.value)
    ) {
      continue;
    }
    if (isBigInt(p.value)) {
      matches.push(p);
    }
  }

  // replace from inner expressions
  for (const p of [...matches].reverse()) {
    p.replace(j.callExpression(j.identifier("__BIGINT__"), [p.value as any]));
  }

  // inject labelling function
  const DECLARE = `declare function __BIGINT__(value: bigint): bigint;`;
  return DECLARE + "\n" + $j.toSource();
}

if (require.main === module) {
  main();
}
