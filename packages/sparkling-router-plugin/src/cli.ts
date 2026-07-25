#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileRoutes } from './compiler.js';
import type { AuthoringConvention } from './types.js';

const args = process.argv.slice(2);
const value = (flag: string) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const convention = (value('--convention') ?? 'tanstack') as AuthoringConvention;
if (convention !== 'tanstack' && convention !== 'next') {
  throw new Error('--convention must be "tanstack" or "next"');
}
const routesDirectory = resolve(value('--routes') ?? 'src/routes');
const output = resolve(value('--out') ?? 'src/routes.manifest.json');
const result = compileRoutes({ convention, routesDirectory });
writeFileSync(
  output,
  `${JSON.stringify({ manifest: result.manifest, entries: result.entries }, null, 2)}\n`,
);
console.log(
  `sparkling-router: ${result.routes.length} routes, ${result.manifest.containers.length} containers -> ${output}`,
);
