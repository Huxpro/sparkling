// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Shared page-boundary codegen, used by BOTH authoring frontends:
//   - gen-mpa.mjs  (TanStack file convention: `export const page` in a route
//     file, or a `-container.ts` boundary file per directory)
//   - gen-next.mjs (Next-style app directory, marker: `export const container`)
// Each frontend extracts its own marker; the manifest they compile to is the
// same artifact (schema v1), consumed by the same runtime.
//
// Extraction is TypeScript-AST based (no regex, no eval of app source): the
// marker must be a statically evaluable literal — plain values only. Anything
// dynamic fails the build instead of silently mis-partitioning routes.
import ts from 'typescript';

export const MANIFEST_VERSION = 1;
export const DEFAULT_SCHEME_BASE = 'hybrid://lynxview_page';

/** Statically evaluate a literal expression; throw on anything dynamic. */
function literalValue(node, file, sourceFile) {
  // `satisfies X` / `as X` wrappers around a literal are fine — unwrap.
  if (ts.isSatisfiesExpression?.(node) || ts.isAsExpression(node)) {
    return literalValue(node.expression, file, sourceFile);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((el) => literalValue(el, file, sourceFile));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new Error(
          `page-manifest: ${file} — marker object may only contain plain ` +
            `\`key: value\` properties (no spreads, methods, or shorthand).`,
        );
      }
      const name =
        ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined;
      if (name === undefined) {
        throw new Error(`page-manifest: ${file} — computed property names are not supported.`);
      }
      out[name] = literalValue(prop.initializer, file, sourceFile);
    }
    return out;
  }
  throw new Error(
    `page-manifest: ${file} — marker must be a statically evaluable literal; found ` +
      `\`${node.getText(sourceFile)}\`. Use plain strings/numbers/booleans/objects/arrays.`,
  );
}

/**
 * Extract `export const <name> = { ... }` from a source file via the TS AST.
 * Returns undefined when the export is absent; throws when it exists in a
 * form that cannot be statically read (referenced constant, re-export, ...).
 */
export function extractExportedObjectLiteral(src, name, file) {
  const sourceFile = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    // `export { page }` / `export { x as page }` — unreadable statically.
    if (ts.isExportDeclaration(statement) && statement.exportClause &&
        ts.isNamedExports(statement.exportClause)) {
      for (const el of statement.exportClause.elements) {
        if (el.name.text === name) {
          throw new Error(
            `page-manifest: ${file} re-exports \`${name}\`; declare it inline as ` +
              `\`export const ${name} = { ... }\` so the build can read it.`,
          );
        }
      }
    }
    if (!ts.isVariableStatement(statement)) continue;
    const isExported = statement.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    );
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== name) continue;
      if (!isExported) continue;
      if (!decl.initializer) {
        throw new Error(`page-manifest: ${file} exports \`${name}\` without an initializer.`);
      }
      const value = literalValue(decl.initializer, file, sourceFile);
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`page-manifest: ${file} — \`${name}\` must be an object literal.`);
      }
      return value;
    }
  }
  return undefined;
}

/** The static path prefix a page owns (up to the first param segment). */
export function staticPrefix(routePath) {
  const segs = routePath.split('/');
  const out = [];
  for (const seg of segs) {
    if (seg.startsWith('$') || seg === '') {
      if (seg === '' && out.length === 0) out.push(''); // keep leading '/'
      if (seg.startsWith('$')) break;
      continue;
    }
    out.push(seg);
  }
  const prefix = out.join('/') || '/';
  return prefix === '' ? '/' : prefix;
}

/** Longest-prefix match score; mirrors sparkling-history's resolve-page. */
function matchLen(pathname, prefix) {
  if (prefix === '/') return pathname === '/' ? 1 : 0.5;
  if (pathname === prefix) return prefix.length + 1;
  if (pathname.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')) {
    return prefix.length;
  }
  return 0;
}

/**
 * Boundary-containment validation (subset rule R3, static approximation).
 * An UNMARKED route falls into the root page by default — but if its path
 * sits under a prefix another page explicitly claimed with a marker, the
 * default assignment contradicts the territory map and the app would render
 * the route in a surprising container. Fail the build; the fix is to move
 * the file or give it its own boundary marker. Marked routes are always
 * legitimate (an explicit carve-out, e.g. a modal page inside another
 * page's path space).
 */
export function validateBoundaries(routes, rootPageId) {
  // Territory prefixes declared by markers, keyed by owning page.
  const declared = [];
  for (const r of routes) {
    if (r.page) declared.push({ id: r.page.id, prefix: staticPrefix(r.path) });
  }
  for (const r of routes) {
    if (r.page) continue; // explicit assignment — always fine
    const pathname = staticPrefix(r.path);
    let best;
    let bestLen = 0;
    for (const d of declared) {
      const len = matchLen(pathname, d.prefix);
      if (len > bestLen) {
        bestLen = len;
        best = d;
      }
    }
    if (best && best.id !== rootPageId) {
      throw new Error(
        `page-manifest: route '${r.path}' has no boundary marker (so it falls ` +
          `into root page '${rootPageId}') but sits under page '${best.id}''s ` +
          `path prefix '${best.prefix}' — at runtime it would open in the wrong ` +
          `container. Move it, or give it its own boundary marker.`,
      );
    }
  }
}

/**
 * Compile route records into manifest pages.
 * @param {Array<{ path: string, page?: { id: string, root?: boolean, presentation?: string, containerParams?: Record<string,string> } }>} routes
 */
export function buildPages(routes) {
  const rootPage = routes.find((r) => r.page?.root)?.page;
  if (!rootPage) {
    throw new Error('No root page found: exactly one route must declare a page with `root: true`.');
  }

  const byId = new Map();
  const ensure = (id, marker) => {
    if (!byId.has(id)) {
      byId.set(id, { id, paths: new Set(), containerParams: marker?.containerParams, presentation: marker?.presentation });
    } else {
      const e = byId.get(id);
      if (marker?.containerParams && !e.containerParams) e.containerParams = marker.containerParams;
      if (marker?.presentation && !e.presentation) e.presentation = marker.presentation;
    }
    return byId.get(id);
  };

  for (const r of routes) {
    const pageId = r.page?.id ?? rootPage.id; // unmarked routes -> root page
    const entry = ensure(pageId, r.page);
    entry.paths.add(staticPrefix(r.path));
    // The declaring route (the one carrying the page marker) is the page's
    // deep-link default. Param segments can't be defaulted; use the static
    // prefix of that route instead.
    if (r.page) {
      const candidate = r.path.includes('$') ? staticPrefix(r.path) : r.path;
      if (!entry.defaultHref || candidate.length < entry.defaultHref.length) {
        entry.defaultHref = candidate;
      }
    }
  }

  // Deterministic order (by id) so different frontends emit identical
  // manifests for the same app.
  const pages = [...byId.values()]
    .map((p) => ({
      id: p.id,
      paths: [...p.paths].sort(),
      ...(p.presentation && p.presentation !== 'push' ? { presentation: p.presentation } : {}),
      ...(p.containerParams ? { containerParams: p.containerParams } : {}),
      ...(p.defaultHref ? { defaultHref: p.defaultHref } : {}),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  validateBoundaries(routes, rootPage.id);
  return pages;
}

/** Render the manifest TS module source (schema v1). */
export function renderManifestModule(pages, generatedBy, schemeBase = DEFAULT_SCHEME_BASE) {
  const manifest = {
    version: MANIFEST_VERSION,
    scheme: { base: schemeBase },
    pages,
  };
  return (
    `// AUTO-GENERATED by ${generatedBy} — do not edit.\n` +
    `// Route -> native-page (bundle) mapping, schema v${MANIFEST_VERSION}.\n` +
    `import type { PageManifest } from 'sparkling-history';\n\n` +
    `export const manifest: PageManifest = ${JSON.stringify(manifest, null, 2)};\n`
  );
}
