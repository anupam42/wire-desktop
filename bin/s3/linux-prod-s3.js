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

const buildRoot = path.join(__dirname, '../wrap/dist');
const S3_PATH = 'linux';

const uploadPromises = [
  `Wire-${VERSION}_x86_64.AppImage`,
  `debian/pool/main/Wire-${VERSION}_amd64.deb`,
  'debian/dists/stable/Contents-amd64',
  'debian/dists/stable/Contents-amd64.bz2',
  'debian/dists/stable/Contents-amd64.gz',
  'debian/dists/stable/InRelease',
  'debian/dists/stable/Release',
  'debian/dists/stable/Release.gpg',
  'debian/dists/stable/main/binary-amd64/Packages',
  'debian/dists/stable/main/binary-amd64/Packages.bz2',
  'debian/dists/stable/main/binary-amd64/Packages.gz',
].map(fileName => {
  return uploadToS3({
    bucket: BUCKET,
    filePath: path.join(buildRoot, fileName),
    s3Path: `${S3_PATH}/${fileName}`,
  });
});

Promise.all(uploadPromises)
  .then(() => console.log('Done.'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
