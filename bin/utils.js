/*
 * Wire
 * Copyright (C) 2019 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

//@ts-check

const path = require('path');
const {exec} = require('child_process');
const {promisify} = require('util');
const fs = require('fs-extra');

/** @param {string[]} envVars */
function checkEnvVars(envVars) {
  envVars.forEach(envVar => {
    if (!process.env[envVar]) {
      throw new Error(`Environment variable "${envVar}" is not defined.`);
    }
  });
}

/**
 * @param {string} [cwd]
 * @param {string} fileName
 * @returns {Promise<string | null>}
 */
async function findDown(fileName, cwd = '.') {
  const resolvedPath = path.resolve(cwd);
  const currentFiles = [];
  const currentDirs = [];
  const dirContent = (await fs.readdir(resolvedPath)).sort();

  for (const currentFilename of dirContent) {
    const currentPath = path.join(resolvedPath, currentFilename);
    const lstat = await fs.lstat(currentPath);
    if (lstat.isFile()) {
      currentFiles.push(currentPath);
      continue;
    }
    if (lstat.isDirectory()) {
      currentDirs.push(currentPath);
    }
  }

  for (const currentFile of currentFiles) {
    if (currentFile.endsWith(fileName)) {
      return currentFile;
    }
  }

  for (const currentDir of currentDirs) {
    const directoryResult = await findDown(fileName, currentDir);
    if (directoryResult) {
      return directoryResult;
    }
  }

  return null;
}

/** @param {string} command */
async function execAsync(command) {
  const {stderr, stdout} = await promisify(exec)(command);
  if (stderr) {
    throw new Error(stderr.trim());
  }
  return stdout.trim();
}

module.exports = {checkEnvVars, execAsync, findDown};
