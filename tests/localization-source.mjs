import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const failures = [];
// Proper names, external brands, the IANA timezone and a phone-number mask.
const invariantText = new Set([': Europe/Madrid', 'RFEF', 'Instagram @', 'Instagram', 'WhatsApp', '+346XXXXXXXX']);
let files = 0;
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { inspect(file); continue; }
    if (!file.endsWith('.tsx') || file.endsWith('LocaleContext.tsx')) continue;
    files++;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const report = (node, value) => {
      value = value.replace(/&nbsp;/g, ' ').trim();
      if (invariantText.has(value)) return;
      if (/\p{L}/u.test(value)) failures.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${value.trim()}`);
    };
    function visibleExpression(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) report(node, node.text);
      if (ts.isConditionalExpression(node)) { visibleExpression(node.whenTrue); visibleExpression(node.whenFalse); }
      if (ts.isBinaryExpression(node)) visibleExpression(node.right);
      if (ts.isParenthesizedExpression(node)) visibleExpression(node.expression);
    }
    function visit(node) {
      if (ts.isJsxText(node)) report(node, node.text);
      if (ts.isJsxAttribute(node) && /^(title|placeholder|aria-label|alt|label|subtitle|data-label)$/.test(node.name.getText(source)) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) report(node.initializer, node.initializer.text);
        else if (node.initializer.expression) visibleExpression(node.initializer.expression);
      }
      if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) visibleExpression(node.expression);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
inspect('frontend/src');
assert.deepEqual(failures, [], 'User-facing literals must come from translations');
console.log(`PASS: ${files} TSX files; no hardcoded textual JSX, display attributes or literal display fallbacks`);
