import assert from "node:assert";
import { Transform } from "jscodeshift";

// usage:
//   npx jscodeshift --parser ts --transform misc/codemod-jsbi-test.ts $(git grep -l . 'test/*.js')

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  let $j = j(file.source);

  let found = false;

  const JSBI_BIGINT = j.memberExpression(
    j.identifier("JSBI"),
    j.identifier("BigInt")
  );

  //
  // replace literal
  //   1n  ⇒  JSBI.BigInt("1")
  //
  for (const p of $j.find(j.BigIntLiteral).paths()) {
    const { value } = p.value;
    assert.ok(typeof value === "string");
    p.replace(j.callExpression(JSBI_BIGINT, [j.stringLiteral(value)]));
    found = true;
  }

  //
  // replace constructor
  //   BigInt  ⇒  JSBI.BigInt
  //
  for (const p of $j.find(j.CallExpression).paths()) {
    const { callee } = p.value;
    if (j.Identifier.check(callee) && callee.name === "BigInt") {
      p.replace(j.callExpression(JSBI_BIGINT, p.value.arguments));
      found = true;
    }
  }

  if (!found) return;

  //
  // prepend require/import
  //   const JSBI = require("jsbi");
  //
  for (const p of $j.find(j.Program).paths()) {
    p.value.body.unshift(
      j.variableDeclaration("const", [
        j.variableDeclarator(
          j.identifier("JSBI"),
          j.callExpression(j.identifier("require"), [j.stringLiteral("jsbi")])
        ),
      ])
    );
  }

  return $j.toSource();
};

export default transform;
