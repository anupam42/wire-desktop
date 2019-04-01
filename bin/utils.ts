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

import {exec} from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import {promisify} from 'util';

interface FindOptions {
  cwd?: string;
  safeGuard?: boolean;
}

export interface FindResult {
  fileName: string;
  filePath: string;
}

function checkEnvVars(envVars: string[]) {
  envVars.forEach(envVar => {
    if (!process.env[envVar]) {
      throw new Error(`Environment variable "${envVar}" is not defined.`);
    }
  });
}

async function findDown(fileName: string, options: {cwd?: string; safeGuard: false}): Promise<Partial<FindResult>>;
async function findDown(fileName: string, options: {cwd?: string; safeGuard?: boolean}): Promise<FindResult>;
async function findDown(fileName: string, options?: FindOptions): Promise<FindResult | Partial<FindResult>> {
  const fullOptions: Required<FindOptions> = {
    cwd: '.',
    safeGuard: true,
    ...options,
  };
  const resolvedPath = path.resolve(fullOptions.cwd);
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
      return {fileName: path.basename(currentFile), filePath: currentFile};
    }
  }

  for (const currentDir of currentDirs) {
    const directoryResult = await findDown(fileName, {cwd: currentDir});
    if (directoryResult) {
      return directoryResult;
    }
  }

  if (fullOptions.safeGuard) {
    throw new Error(`Could not find "${fileName}".`);
  }

  return {};
}

async function execAsync(command: string) {
  const {stderr, stdout} = await promisify(exec)(command);
  if (stderr) {
    throw new Error(stderr.trim());
  }
  return stdout.trim();
}

export {checkEnvVars, execAsync, findDown};
