// @ts-nocheck
import Runnable from 'mocha/lib/runnable';
import { relative } from 'path';

const superRun = Runnable.prototype.run;

Runnable.prototype.run = function (...args) {
  context = {
    title: this.title,
    fullTitle: this.fullTitle ? this.fullTitle() : this.title,
    file: getFileName(this.file),
  };
  return superRun.bind(this)(...args);
}

function getFileName(f) {
  if (!f) {
    return '<root>';
  }
  return relative(process.cwd(), f);
}

let context;

export function getTestContext() {
  return context;
}
