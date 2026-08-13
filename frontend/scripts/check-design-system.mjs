import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';

const frontendDir = resolve(import.meta.dirname, '..');
const srcDir = resolve(frontendDir, 'src');
const violations = [];
async function files(directory) { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]))).flat(); }
function hasRawDeclaration(source, property, allowed = []) { const pattern = new RegExp(`${property}\\s*:\\s*([^;}]+)`, 'gi'); return [...source.matchAll(pattern)].some((match) => { const value = match[1].trim(); return !value.startsWith('var(') && !allowed.includes(value) && value !== '0' && !value.startsWith('0 '); }); }
const sourceFiles = await files(srcDir);
for (const file of sourceFiles) { if (extname(file) !== '.css' || file.endsWith('/styles/palette.css')) continue; const source = await readFile(file, 'utf8'); const raw = /#[0-9a-f]{3,8}\b/i.test(source) || /\b(?:rgb|hsl)a?\(/i.test(source) || hasRawDeclaration(source, 'box-shadow', ['none']) || hasRawDeclaration(source, 'border-radius') || ['margin', 'padding', 'gap'].some((property) => hasRawDeclaration(source, property)); if (raw) violations.push(`raw design value: ${relative(frontendDir, file)}`); }
for (const file of await files(resolve(srcDir, 'pages'))) { if (!['.ts', '.tsx'].includes(extname(file))) continue; if ((await readFile(file, 'utf8')).includes('palette.css')) violations.push(`page imports palette directly: ${relative(frontendDir, file)}`); }
const navigationFile = resolve(srcDir, 'app/navigation.ts'); const navigationSource = await readFile(navigationFile, 'utf8'); for (const item of ['/dashboard', '/components']) { for (const file of sourceFiles) { if (file === navigationFile || !['.ts', '.tsx'].includes(extname(file))) continue; if ((await readFile(file, 'utf8')).includes(`'${item}'`) || (await readFile(file, 'utf8')).includes(`"${item}"`)) violations.push(`navigation route duplicated outside navigation.ts: ${relative(frontendDir, file)}`); } }
if (!navigationSource.includes('NAVIGATION_ITEMS')) violations.push('navigation.ts does not export navigation SSOT');
const artifact = resolve(frontendDir, '../src/ReactPoc.html'); const dist = resolve(frontendDir, 'dist/index.html'); const [artifactSource, distSource] = await Promise.all([readFile(artifact, 'utf8'), readFile(dist, 'utf8')]);
if (artifactSource.includes('Warning: truncated output')) violations.push('generated artifact includes truncation warning'); if (artifactSource !== distSource) violations.push('generated artifact differs from frontend/dist/index.html'); if (/<(?:script|link)\b[^>]+(?:src|href)=/i.test(artifactSource)) violations.push('generated artifact references an external JS/CSS asset');
if (violations.length) { console.error(violations.join('\n')); process.exit(1); } console.log('design-system checks passed');
