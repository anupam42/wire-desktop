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
const {checkEnvVars} = require('../utils');

checkEnvVars(['BUCKET', 'WRAPPER_BUILD']);

const BUCKET = process.env.BUCKET;
const VERSION = process.env.WRAPPER_BUILD.split('#')[1];

const buildRoot = path.join(__dirname, '../wrap/prod/Wire-win32-ia32');

const S3_PATH = 'win/prod';

const nupkgFile = `wire-${VERSION}-full.nupkg`;
const nupkgPath = path.join(buildRoot, nupkgFile);
const setupPath = path.join(buildRoot, 'WireSetup.exe');
const releasesPath = path.join(buildRoot, 'RELEASES');

const promises = [
  uploadToS3({bucket: BUCKET, filePath: nupkgPath, s3Path: `${S3_PATH}/${nupkgFile}`}),
  uploadToS3({bucket: BUCKET, filePath: setupPath, s3Path: `${S3_PATH}/wire-${VERSION}.exe`}),
  uploadToS3({bucket: BUCKET, filePath: releasesPath, s3Path: `${S3_PATH}/wire-${VERSION}-RELEASES`}),
];

Promise.all(promises)
  .then(() => console.log('Done.'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
