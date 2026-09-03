"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const LIMIT = Number(process.argv[2] || 10);

function walkDir(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkDir(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  );
}

function nameOf(node, sourceFile) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  if ((ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) && node.name) {
    return node.name.getText(sourceFile);
  }
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (node.parent) {
    if (ts.isVariableDeclaration(node.parent) && node.parent.name) return node.parent.name.getText(sourceFile);
    if (ts.isPropertyAssignment(node.parent) && node.parent.name) return node.parent.name.getText(sourceFile);
  }
  return "<anonymous>";
}

function isLogicalOp(node) {
  return (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  );
}

function isOptionalChain(node) {
  return (
    (ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) ||
      ts.isCallExpression(node)) &&
    Boolean(node.questionDotToken)
  );
}

function analyzeFunction(fn) {
  let cyclomatic = 1;
  function walk(node) {
    if (isFunctionLike(node) && node !== fn) return;
    if (
      ts.isIfStatement(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCatchClause(node) ||
      ts.isCaseClause(node) ||
      ts.isConditionalExpression(node) ||
      isLogicalOp(node) ||
      isOptionalChain(node)
    ) {
      cyclomatic += 1;
    }
    ts.forEachChild(node, walk);
  }
  walk(fn);
  return cyclomatic;
}

function collect(sourceFile) {
  const fns = [];
  function visit(node, owner) {
    if (isFunctionLike(node)) {
      const name = nameOf(node, sourceFile);
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      fns.push({
        name: owner ? `${owner}.${name}` : name,
        cc: analyzeFunction(node),
        line: start.line + 1,
      });
      ts.forEachChild(node, (c) => visit(c, name));
      return;
    }
    ts.forEachChild(node, (c) => visit(c, owner));
  }
  visit(sourceFile, null);
  return fns;
}

const over = [];
let max = 0;
let count = 0;
let simple = 0;
let moderate = 0;
for (const full of walkDir(SRC)) {
  const fileRel = rel(full);
  const text = fs.readFileSync(full, "utf8");
  const kind = full.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileRel, text, ts.ScriptTarget.Latest, true, kind);
  for (const fn of collect(sourceFile)) {
    count += 1;
    if (fn.cc > max) max = fn.cc;
    if (fn.cc <= 5) simple += 1;
    else if (fn.cc <= LIMIT) moderate += 1;
    if (fn.cc > LIMIT) over.push({ ...fn, file: fileRel });
  }
}
over.sort((a, b) => b.cc - a.cc);
console.log(JSON.stringify({
  limit: LIMIT,
  functions: count,
  max,
  over: over.length,
  simple,
  moderate,
  items: over,
}, null, 2));
if (over.length) process.exitCode = 1;
