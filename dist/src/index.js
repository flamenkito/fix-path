#! /usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const clc = require("cli-color");
function walk(dir) {
    return new Promise((resolve, reject) => {
        fs_1.readdir(dir, (error, files) => {
            if (error) {
                return reject(error);
            }
            Promise.all(files.map(file => {
                return new Promise((resolve, reject) => {
                    const filepath = path_1.join(dir, file);
                    fs_1.stat(filepath, (error, stats) => {
                        if (error) {
                            return reject(error);
                        }
                        if (stats.isDirectory()) {
                            walk(filepath).then(resolve);
                        }
                        else if (stats.isFile()) {
                            resolve(filepath);
                        }
                    });
                });
            })).then(foldersContents => {
                resolve(foldersContents.reduce((all, folderContents) => all.concat(folderContents), []));
            });
        });
    });
}
exports.walk = walk;
function getDirectories(source) {
    const isDirectory = (dir) => fs_1.lstatSync(dir).isDirectory();
    return fs_1.readdirSync(source)
        .map(name => path_1.join(source, name))
        .filter(isDirectory);
}
function getCompilerOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const tsconfig = fs_1.readFileSync('../tsconfig.json').toString();
        const { compilerOptions } = JSON.parse(tsconfig);
        return compilerOptions;
    });
}
function getDistDir() {
    return __awaiter(this, void 0, void 0, function* () {
        const { outDir } = yield getCompilerOptions();
        return outDir
            .split('/')
            .filter(s => s !== '.')
            .join('/');
    });
}
function getRootDirNames(distDir) {
    return getDirectories(distDir).map(dir => dir
        .replace(distDir, '')
        .split('/')
        .filter(s => !!s)
        .join('/'));
}
const replacePaths = (rootDirNames) => (jsName) => __awaiter(this, void 0, void 0, function* () {
    let jsFile = fs_1.readFileSync(jsName).toString();
    const re = /(require\(\"((?![\.|\@]).+[\w\/\.\-]*)+\"\))+/g;
    const replace = [];
    for (let m = re.exec(jsFile); m; m = re.exec(jsFile)) {
        const from = m[1];
        const path = m[2];
        if (rootDirNames.some(dir => path.startsWith(dir))) {
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
    fs_1.writeFileSync(jsName, jsFile);
    return {
        file: jsName,
        updates: replace.map(update => {
            const { from, to, path } = update;
            return { from, to, path };
        })
    };
});
function fix() {
    return __awaiter(this, void 0, void 0, function* () {
        const distDir = yield getDistDir();
        const fileNames = (yield walk(distDir));
        const rootDirNames = getRootDirNames(distDir);
        const results = yield Promise.all(fileNames
            .filter(name => name.endsWith('.js'))
            .map(replacePaths(rootDirNames)));
        return results.filter(result => result.updates.length > 0);
    });
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
//# sourceMappingURL=index.js.map