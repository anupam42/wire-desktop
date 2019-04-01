#!/usr/bin/env node

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
const fs = require('fs-extra');
const commander = require('commander');

const {createVersion, uploadVersion, zip} = require('./hockey-utils');
const {findDown} = require('../utils');

commander
  .name('hockey.js')
  .description('Upload files to Hockey')
  .option('-i, --hockey-id <id>', 'Specify the Hockey app ID')
  .option('-t, --hockey-token <token>', 'Specify the Hockey API token')
  .option('-w, --wrapper-build <build>', 'Specify the wrapper build (e.g. "Linux#3.7.1234")')
  .option('-p, --path <path>', 'Specify the local path to search for files (e.g. "../../wrap")')
  .parse(process.argv);

if (!commander.hockeyToken || !commander.hockeyId || !commander.wrapperBuild || !commander.wrapperBuild.includes('#')) {
  commander.outputHelp();
  process.exit(1);
}

/**
 * @param {string} platform
 * @param {string} basePath
 */
async function getUploadFile(platform, basePath) {
  if (platform === 'linux') {
    const debImage = await findDown('.deb', {cwd: basePath});
    return debImage;
  } else if (platform === 'windows') {
    const setupExe = await findDown('-Setup.exe', {cwd: basePath});
    return setupExe;
  } else if (platform === 'macos') {
    const setupPkg = await findDown('.pkg', {cwd: basePath});
    return setupPkg;
  }
}

(async () => {
  try {
    const {hockeyId, hockeyToken, wrapperBuild} = commander;
    const [platform, version] = wrapperBuild.toLowerCase().split('#');
    const searchBasePath = commander.path || path.resolve('.');

    const {filePath} = await getUploadFile(platform, searchBasePath);

    const zipFile = await zip(filePath, filePath.replace('.exe', '.zip'));

    const {id: hockeyVersionId} = await createVersion({
      hockeyAppId: hockeyId,
      hockeyToken: hockeyToken,
      version: version,
    });

    await uploadVersion({
      filePath: zipFile,
      hockeyAppId: hockeyId,
      hockeyToken: hockeyToken,
      hockeyVersionId,
      version: version,
    });

    await fs.remove(zipFile);
    console.log('Done.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();