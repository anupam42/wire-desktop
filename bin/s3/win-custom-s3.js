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
const {uploadToS3} = require('./s3-utils');
const {checkEnvVars, findDown} = require('../utils');

checkEnvVars(['WIN_S3_BUCKET', 'WIN_S3_PATH', 'WRAPPER_BUILD']);

const BUCKET = process.env.WIN_S3_BUCKET;
const S3_PATH = process.env.WIN_S3_PATH;
const VERSION = process.env.WRAPPER_BUILD.split('#')[1];

(async () => {
  try {
    const setupExe = await findDown('-Setup.exe', path.join(__dirname, '../../wrap/'));
    const nupkgFile = await findDown('-full.nupkg', path.join(__dirname, '../../wrap/'));

    if (!setupExe) {
      throw new Error('Could not find setup executable');
    }

    console.info(`Found setup executable: "${setupExe}"`);

    if (!nupkgFile) {
      throw new Error('Could not find nupkg package');
    }

    console.info(`Found nupkg package: "${nupkgFile}"`);

    const appShortName = new RegExp('(.+)-[\\d.]+-full\\.nupkg').exec(path.basename(nupkgFile))[1];
    const nupkgName = path.basename(nupkgFile);
    const customPath = path.resolve(path.dirname(setupExe));
    const releasesPath = path.join(customPath, 'RELEASES');

    const promises = [
      uploadToS3({bucket: BUCKET, filePath: nupkgFile, s3Path: `${S3_PATH}/${nupkgName}`}),
      uploadToS3({bucket: BUCKET, filePath: setupExe, s3Path: `${S3_PATH}/${appShortName}-${VERSION}.exe`}),
      uploadToS3({bucket: BUCKET, filePath: releasesPath, s3Path: `${S3_PATH}/${appShortName}-${VERSION}-RELEASES`}),
    ];

    await Promise.all(promises);
    console.log('Done.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
