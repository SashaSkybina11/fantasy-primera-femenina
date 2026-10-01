import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function load(file) {
 const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(output,{exports});return exports;
}
const extras=load('frontend/src/locales/market.ts');
const pt=load('frontend/src/locales/pt.ts');
const source=ts.createSourceFile('locale.tsx',fs.readFileSync('frontend/src/contexts/LocaleContext.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
export const dictionaries={};
for(const stmt of source.statements) if(ts.isVariableStatement(stmt)) for(const decl of stmt.declarationList.declarations) if(['spanish','ukrainian','english'].includes(decl.name.getText(source))) {
 const props=(ts.isAsExpression(decl.initializer)?decl.initializer.expression:decl.initializer).properties;
 const entries=props.flatMap(p=>ts.isSpreadAssignment(p)?Object.entries(extras[p.expression.getText(source)]):[[p.name.text,p.initializer.text]]);
 assert.equal(new Set(entries.map(e=>e[0])).size,entries.length,'Duplicate translations');
 dictionaries[decl.name.getText(source)]=Object.fromEntries(entries);
}
dictionaries.portuguese=pt.portuguese;dictionaries.brazilian=pt.brazilian;
for(const [language,dict] of Object.entries(dictionaries)) {
 assert.deepEqual(Object.keys(dictionaries.spanish).sort(),Object.keys(dict).sort(),language);
 for(const [key,text] of Object.entries(dict)) {
  assert.ok(text.trim(),`${language}: ${key}`);
  assert.deepEqual(dictionaries.spanish[key].match(/{{?\w+}}?/g),text.match(/{{?\w+}}?/g),`${language}: ${key}`);
 }
}
export const byLocale={es:dictionaries.spanish,uk:dictionaries.ukrainian,en:dictionaries.english,pt:dictionaries.portuguese,'pt-BR':dictionaries.brazilian};
