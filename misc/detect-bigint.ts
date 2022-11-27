import { ts, Project } from "ts-morph";

// cli usage:
//   node -r esbuild-register misc/detect-bigint.ts ./tsconfig.json misc/example.ts

export interface Detection {
  text: string;
  range: [number, number];
  rangePretty: [string, string];
}

export function detectBigint(
  tsConfigFilePath: string,
  sourceFilePath: string
): Detection[] {
  const project = new Project({ tsConfigFilePath });
  const sourceFile = project.getSourceFileOrThrow(sourceFilePath);
  const { offsetToLineColumn } = createPositionConverter(
    sourceFile.getFullText()
  );

  const program = project.getProgram();
  const checker = program.getTypeChecker();

  const detections: Detection[] = [];

  sourceFile.transform((traversal) => {
    const node = traversal.visitChildren();
    if (isExpressionNode(node)) {
      const type = checker.compilerObject.getTypeAtLocation(node);
      if (checker.compilerObject.typeToString(type) === "bigint") {
        const start = node.getStart();
        const end = node.getEnd();
        const [l1, c1] = offsetToLineColumn(start);
        const [l2, c2] = offsetToLineColumn(end);
        const path = sourceFile.getFilePath();
        detections.push({
          text: node.getText(),
          range: [start, end],
          // vscode-friendly source link (https://github.com/microsoft/vscode/blob/78397428676e15782e253261358b0398c2a1149e/src/vs/workbench/contrib/terminal/browser/links/terminalLocalLinkDetector.ts#L51)
          rangePretty: [
            `${path} ${l1 + 1}:${c1 + 1}`,
            `${path} ${l2 + 1}:${c2 + 1}`,
          ],
        });
      }
    }
    return node;
  });

  return detections;
}

//
// utilities
//

function createPositionConverter(source: string) {
  const acc = [0];
  for (const line of source.split("\n")) {
    acc.push(acc.at(-1)! + line.length + 1);
  }

  function offsetToLineColumn(offset: number): [number, number] {
    for (let line = 0; line < acc.length - 1; line++) {
      if (offset < acc[line + 1]) {
        const column = offset - acc[line];
        return [line, column];
      }
    }
    throw new Error("unreachable");
  }

  return { offsetToLineColumn };
}

// based on https://github.com/microsoft/TypeScript/blob/f6628a4573cd37c26912f78de3d08cd1dbf687a5/src/compiler/utilities.ts#L2712
export function isExpressionNode(node: ts.Node): node is ts.Expression {
  switch (node.kind) {
    case ts.SyntaxKind.SuperKeyword:
    case ts.SyntaxKind.NullKeyword:
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.RegularExpressionLiteral:
    case ts.SyntaxKind.ArrayLiteralExpression:
    case ts.SyntaxKind.ObjectLiteralExpression:
    case ts.SyntaxKind.PropertyAccessExpression:
    case ts.SyntaxKind.ElementAccessExpression:
    case ts.SyntaxKind.CallExpression:
    case ts.SyntaxKind.NewExpression:
    case ts.SyntaxKind.TaggedTemplateExpression:
    case ts.SyntaxKind.AsExpression:
    case ts.SyntaxKind.TypeAssertionExpression:
    case ts.SyntaxKind.SatisfiesExpression:
    case ts.SyntaxKind.NonNullExpression:
    case ts.SyntaxKind.ParenthesizedExpression:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.ClassExpression:
    case ts.SyntaxKind.ArrowFunction:
    case ts.SyntaxKind.VoidExpression:
    case ts.SyntaxKind.DeleteExpression:
    case ts.SyntaxKind.TypeOfExpression:
    case ts.SyntaxKind.PrefixUnaryExpression:
    case ts.SyntaxKind.PostfixUnaryExpression:
    case ts.SyntaxKind.BinaryExpression:
    case ts.SyntaxKind.ConditionalExpression:
    case ts.SyntaxKind.SpreadElement:
    case ts.SyntaxKind.TemplateExpression:
    case ts.SyntaxKind.OmittedExpression:
    case ts.SyntaxKind.JsxElement:
    case ts.SyntaxKind.JsxSelfClosingElement:
    case ts.SyntaxKind.JsxFragment:
    case ts.SyntaxKind.YieldExpression:
    case ts.SyntaxKind.AwaitExpression:
    case ts.SyntaxKind.MetaProperty:
    case ts.SyntaxKind.ExpressionWithTypeArguments:
    case ts.SyntaxKind.QualifiedName:
    case ts.SyntaxKind.JSDocMemberName:
    case ts.SyntaxKind.PrivateIdentifier:
    case ts.SyntaxKind.Identifier:
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.BigIntLiteral:
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.ThisKeyword:
      return true;
  }
  return false;
}

//
// main
//

function main() {
  const [tsConfigFilePath, sourceFilePath] = process.argv.slice(2);
  const detections = detectBigint(tsConfigFilePath, sourceFilePath);
  console.log(JSON.stringify(detections, null, 2));
}

if (require.main === module) {
  main();
}
