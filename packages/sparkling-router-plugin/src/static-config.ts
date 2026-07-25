import ts from 'typescript';

export interface StaticContainerConfig {
  id?: string;
  presentation?: 'push' | 'modal';
  containerOptions?: Record<string, string>;
}

function propertyName(node: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function literalValue(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return [];
        const name = propertyName(property.name);
        if (!name) return [];
        return [[name, literalValue(property.initializer)]];
      }),
    );
  }
  return undefined;
}

export function readExportedObject(
  sourceText: string,
  fileName: string,
  exportName: string,
): StaticContainerConfig | undefined {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        return literalValue(declaration.initializer) as StaticContainerConfig;
      }
    }
  }
  return undefined;
}

export function readCreateFileRoutePath(
  sourceText: string,
  fileName: string,
): string | undefined {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let routePath: string | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'createFileRoute'
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) {
        routePath = argument.text;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return routePath;
}
