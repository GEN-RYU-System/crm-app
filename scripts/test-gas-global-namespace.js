const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourceDirectory = path.join(root, 'src');
const ignoredBasenames = new Set(
  fs.readFileSync(path.join(root, '.claspignore'), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.includes('/') && !line.includes('*'))
);
const deployedFiles = fs.readdirSync(sourceDirectory)
  .filter(name => name.endsWith('.js') && !ignoredBasenames.has(name))
  .sort();
const declarations = new Map();

deployedFiles.forEach(file => {
  const source = fs.readFileSync(path.join(sourceDirectory, file), 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(/^(const|let|class|var|function)\s+([A-Za-z_$][\w$]*)\b/);
    if (!match) return;
    const kind = match[1];
    const name = match[2];
    const locations = declarations.get(name) || [];
    locations.push({ kind: kind, location: file + ':' + (index + 1) });
    declarations.set(name, locations);
  });
});

const duplicateDeclarations = Array.from(declarations.entries())
  .filter(([, locations]) => locations.length > 1);
const blockingDuplicates = duplicateDeclarations
  .filter(([, locations]) => locations.some(item =>
    ['const', 'let', 'class'].includes(item.kind)
  ))
  .map(([name, locations]) => ({ name, locations }));
const warnings = duplicateDeclarations
  .filter(([, locations]) => locations.every(item =>
    ['function', 'var'].includes(item.kind)
  ))
  .map(([name, locations]) => ({ name, locations }));

const combinedSource = deployedFiles.map(file =>
  fs.readFileSync(path.join(sourceDirectory, file), 'utf8')
).join('\n;\n');

assert.throws(() => new vm.Script('const blocked = 1; function blocked() {}'));
assert.doesNotThrow(() => new vm.Script('function warned() {} function warned() {}'));
assert.doesNotThrow(() => new vm.Script('var warned; var warned;'));
assert.doesNotThrow(() => new vm.Script(combinedSource, {
  filename: 'combined-deployed-gas-source.js'
}));
assert.deepEqual(blockingDuplicates, [], JSON.stringify(blockingDuplicates));

console.log(JSON.stringify({
  result: 'PASS',
  deployedFileCount: deployedFiles.length,
  blockingDuplicateCount: blockingDuplicates.length,
  warningDuplicateCount: warnings.length,
  warnings: warnings
}));
