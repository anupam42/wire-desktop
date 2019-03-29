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

const {copyOnS3, deleteFromS3} = require('./s3-utils');
const {checkEnvVars} = require('../utils');

checkEnvVars(['BUCKET', 'WRAPPER_BUILD']);

const BUCKET = process.env.BUCKET;
const VERSION = process.env.WRAPPER_BUILD.split('#')[1];

const S3_PATH = 'win/internal';

const oldReleaseKey = `${S3_PATH}/RELEASES`;
const oldExeKey = `${S3_PATH}/WireInternalSetup.exe`;

const newReleaseKey = `${S3_PATH}/wire-internal-${VERSION}-RELEASES`;
const newExeKey = `${S3_PATH}/wire-internal-${VERSION}.exe`;

(async () => {
  try {
    await deleteFromS3({bucket: BUCKET, s3Path: oldReleaseKey});
    await deleteFromS3({bucket: BUCKET, s3Path: oldExeKey});
    await copyOnS3({bucket: BUCKET, s3FromPath: `${BUCKET}/${newReleaseKey}`, s3ToPath: oldReleaseKey});
    await copyOnS3({bucket: BUCKET, s3FromPath: `${BUCKET}/${newExeKey}`, s3ToPath: oldExeKey});
    console.log('Done');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
