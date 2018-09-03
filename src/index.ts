#! /usr/bin/env node

import {
  readdir,
  stat,
  lstatSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'fs';

import { join } from 'path';

import * as clc from 'cli-color';

export function walk(dir) {
  return new Promise((resolve, reject) => {
    readdir(dir, (error, files) => {
      if (error) {
        return reject(error);
      }
      Promise.all(
        files.map(file => {
          return new Promise((resolve, reject) => {
            const filepath = join(dir, file);
            stat(filepath, (error, stats) => {
              if (error) {
                return reject(error);
              }
              if (stats.isDirectory()) {
                walk(filepath).then(resolve);
              } else if (stats.isFile()) {
                resolve(filepath);
              }
            });
          });
        })
      ).then(foldersContents => {
        resolve(
          foldersContents.reduce(
            (all: {}[], folderContents: {}) =>
              all.concat(folderContents),
            []
          )
        );
      });
    });
  });
}

function getDirectories(source) {
  const isDirectory = (dir: string) => lstatSync(dir).isDirectory();
  return readdirSync(source)
    .map(name => join(source, name))
    .filter(isDirectory);
}

interface CompilerOptions {
  outDir: string;
}

async function getCompilerOptions(): Promise<CompilerOptions> {
  const tsconfig = readFileSync('tsconfig.json').toString();
  const { compilerOptions } = JSON.parse(tsconfig);
  return compilerOptions;
}

async function getDistDir() {
  const { outDir } = await getCompilerOptions();
  return outDir
    .split('/')
    .filter(s => s !== '.')
    .join('/');
}

function getRootDirNames(distDir: string) {
  return getDirectories(distDir).map(dir =>
    dir
      .replace(distDir, '')
      .split('/')
      .filter(s => !!s)
      .join('/')
  );
}

interface Changes {
  jsName: string;
  from: string;
  path: string;
  to: string;
}

const replacePaths = (rootDirNames: string[]) => async (jsName: string) => {
  let jsFile = readFileSync(jsName).toString();

  const re = /(require\(\"((?![\.|\@]).+[\w\/\.\-]*)+\"\))+/g;

  const replace: Changes[] = [];

  for (let m = re.exec(jsFile); m; m = re.exec(jsFile)) {
    const from = m[1];
    const path = m[2];
    if (rootDirNames.some(dir => path === dir || path.startsWith(dir + '/'))) {
      const depth = jsName.split('/').map(() => '..');
      depth.pop();
      depth.pop();
      if (depth.length === 0) {
        depth.push('./');
      }

      const to = from.replace(path, [...depth, path].join('/'));

      replace.push({ jsName, from, path, to });
    }
  }

  replace.forEach(item => {
    jsFile = jsFile.replace(item.from, item.to);
  });

  writeFileSync(jsName, jsFile);

  return {
    file: jsName,
    updates: replace.map(update => {
      const { from, to, path } = update;
      return { from, to, path };
    })
  };
};

async function fix() {
  const distDir = await getDistDir();
  const fileNames = (await walk(distDir)) as string[];
  const rootDirNames = getRootDirNames(distDir);
  const results = await Promise.all(
    fileNames
      .filter(name => name.endsWith('.js'))
      .map(replacePaths(rootDirNames))
  );
  return results.filter(result => result.updates.length > 0);
}

fix()
  .then(results => {
    results.forEach(result => {
      console.log(clc.green(result.file));
      result.updates.forEach(update => {
        console.log(`\t${update.from} => ${update.to}`);
      });
    });
  })
  .catch(err => console.error(err));
