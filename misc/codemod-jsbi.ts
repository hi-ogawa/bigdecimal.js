import jscodeshiftCore from "jscodeshift";
import type { JSCodeshift } from "jscodeshift";
import process from "node:process";
import fs from "node:fs";
import assert from "node:assert";

// cli usage:
//   node -r esbuild-register misc/codemod-jsbi.ts src/bigdecimal-label-bigint.ts src/bigdecimal-jsbi.ts

//
// TODO: these cases are not yet handled since they don't appear in bigdecimal.ts
// - replace literals:  1n  ⇒  JSBI.BigInt("1")
// - replace UnaryExpression (+, -, etc...)
//

async function main() {
  const [inFile, outFile] = process.argv.slice(2);

  const inSource = await fs.promises.readFile(inFile, "utf-8");
  const j = jscodeshiftCore.withParser("ts");
  const outSource = transform(inSource, j);

  if (outFile == "--") {
    process.stdout.write(outSource);
  } else {
    fs.promises.writeFile(outFile, outSource);
  }
}

//
// transform
//

function transform(source: string, j: JSCodeshift): string {
  // strip first line `declare function __BIGINT__(value: bigint): bigint;`
  source = source.slice(source.indexOf("\n") + 1);
  let $j = j(source);

  // syntactically detect bigint thanks to misc/codemod-label-bigint.ts
  function isBigInt(node: unknown) {
    return (
      j.CallExpression.check(node) &&
      j.Identifier.check(node.callee) &&
      node.callee.name === "__BIGINT__"
    );
  }

  const JSBI_ID = j.identifier("JSBI");
  const JSBI_BIGINT_EXPR = j.memberExpression(JSBI_ID, j.identifier("BigInt"));

  //
  // prepend
  //   import JSBI from "jsbi"
  //
  for (const p of $j.find(j.Program).paths()) {
    p.value.body.unshift(
      j.importDeclaration(
        [j.importDefaultSpecifier(JSBI_ID)],
        j.stringLiteral("jsbi")
      )
    );
  }

  //
  // replace primitive typing
  //
  //   bigint  ⇒  JSBI
  //
  for (const p of $j.find(j.TSBigIntKeyword).paths()) {
    p.replace(j.tsTypeReference(JSBI_ID));
  }

  //
  // replace constructor
  //
  //   BigInt  ⇒  JSBI.BigInt
  //
  for (const p of $j.find(j.Identifier).paths()) {
    if (p.value.name === "BigInt") {
      p.replace(JSBI_BIGINT_EXPR);
    }
  }

  //
  // replace AssignmentExpression
  //
  //    x += y  ⇒  x = __BIGINT__(x) + y
  //

  const ASSIGN_OP_MAPPING = {
    "+=": "+",
  };

  for (const p of $j.find(j.AssignmentExpression).paths()) {
    const { operator, left, right } = p.value;
    if (j.Identifier.check(left) && isBigInt(right)) {
      if (operator in ASSIGN_OP_MAPPING) {
        p.replace(
          j.assignmentExpression(
            "=",
            left,
            j.binaryExpression(
              ASSIGN_OP_MAPPING[operator],
              j.callExpression(JSBI_BIGINT_EXPR, [left]),
              right
            )
          )
        );
      }
    }
  }

  //
  // replace arithmetic
  //
  //   x + y
  //   x - y
  //   x * y
  //   x / y
  //   x % y
  //   -x
  //   +=
  //   -=
  //   *=
  //   /=
  //   %=
  //

  const BIN_OP_MAPPING = {
    "+": "add",
    "-": "subtract",
    "*": "multiply",
    "/": "divide",
    "%": "remainder",
    "**": "exponentiate",
    "<": "lessThan",
    "<=": "lessThanOrEqual",
    ">": "greaterThan",
    ">=": "greaterThanOrEqual",
  };

  for (const p of reverse($j.find(j.BinaryExpression).paths())) {
    const { operator, left, right } = p.value;
    if (isBigInt(left) && isBigInt(right)) {
      if (operator in BIN_OP_MAPPING) {
        p.replace(
          j.callExpression(
            j.memberExpression(JSBI_ID, j.identifier(BIN_OP_MAPPING[operator])),
            [left, right]
          )
        );
      }
    } else if (isBigInt(right)) {
      if (operator in BIN_OP_MAPPING) {
        p.replace(
          j.callExpression(
            j.memberExpression(JSBI_ID, j.identifier(BIN_OP_MAPPING[operator])),
            [j.callExpression(JSBI_BIGINT_EXPR, [left]), right]
          )
        );
      }
    } else if (isBigInt(left)) {
      if (operator in BIN_OP_MAPPING) {
        p.replace(
          j.callExpression(
            j.memberExpression(
              j.identifier("JSBI"),
              j.identifier(BIN_OP_MAPPING[operator])
            ),
            [left, j.callExpression(JSBI_BIGINT_EXPR, [right])]
          )
        );
      }
    }
  }

  //
  // replace type assertion
  //
  //   typeof value === 'bigint'  ⇒  value instanceof JSBI
  //
  for (const p of $j.find(j.BinaryExpression).paths()) {
    const { operator, left, right } = p.value;
    if (
      j.UnaryExpression.check(left) &&
      left.operator === "typeof" &&
      operator === "===" &&
      j.StringLiteral.check(right) &&
      right.value === "bigint"
    ) {
      p.replace(
        j.binaryExpression("instanceof", left.argument, j.identifier("JSBI"))
      );
    }
  }

  //
  // fix unsupported JSBI.valueOf
  //
  //   x.valueOf()  ⇒  x
  //   Number(x)    ⇒  x.toNumber()
  //
  for (const p of $j.find(j.CallExpression).paths()) {
    const { callee, arguments: args } = p.value;
    if (
      j.MemberExpression.check(callee) &&
      j.Identifier.check(callee.property) &&
      callee.property.name === "valueOf" &&
      args.length === 0
    ) {
      if (isBigInt(callee.object)) {
        p.replace(callee.object);
      }
    }
  }
  for (const p of $j.find(j.CallExpression).paths()) {
    const { callee, arguments: args } = p.value;
    if (j.Identifier.check(callee) && callee.name === "Number") {
      if (args.length === 1 && isBigInt(args[0])) {
        p.replace(
          j.callExpression(
            j.memberExpression(JSBI_ID, j.identifier("toNumber")),
            args
          )
        );
      }
    }
  }

  //
  // workaround non null assertion (essentially typing bugs in bigdecimal.ts)
  //
  //   x!  ⇒  x ?? JSBI.BigInt(0)
  //
  for (const p of $j.find(j.TSNonNullExpression).paths()) {
    if (isBigInt(p.parent.value)) {
      const { expression } = p.value;
      p.replace(
        j.logicalExpression(
          "??",
          expression,
          j.callExpression(JSBI_BIGINT_EXPR, [j.numericLiteral(0)])
        )
      );
    }
  }

  //
  // remove __BIGINT__ calls
  //
  for (const p of reverse($j.find(j.CallExpression).paths())) {
    const { callee, arguments: args } = p.value;
    if (j.Identifier.check(callee) && callee.name === "__BIGINT__") {
      assert.ok(args.length === 1);
      p.replace(args[0]);
    }
  }

  return $j.toSource();
}

// traverse in reverse order so that inner expressions will be processed/replaced first e.g. for `(x + y) + z`
function reverse<T>(it: Iterable<T>): T[] {
  return [...it].reverse();
}

if (require.main === module) {
  main();
}
