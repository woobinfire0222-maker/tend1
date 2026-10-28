import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
const output = new URL('../dist/', import.meta.url);
await copyFile(new URL('index.html', output), new URL('404.html', output));
