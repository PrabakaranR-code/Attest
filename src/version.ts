import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

export const ENGINE_NAME = 'attest';
export const ENGINE_VERSION: string = pkg.version;
