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
const S3 = require('aws-sdk/clients/s3');
const {checkEnvVars} = require('../utils');

/**
 * @typedef {{bucket: string; filePath: string; s3Path: string}} UploadOptions
 * @param {UploadOptions} uploadOptions
 */
async function uploadToS3(uploadOptions) {
  const {AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY} = process.env;
  const {bucket, filePath, s3Path} = uploadOptions;
  checkEnvVars(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']);

  const lstat = await fs.lstat(filePath);

  if (!lstat.isFile()) {
    throw new Error(`File "${filePath} not found`);
  }

  console.log(`Uploading "${path.basename(filePath)}" to "${s3Path}" ...`);

  const file = fs.createReadStream(filePath);

  await new S3({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  })
    .upload({
      ACL: 'public-read',
      Body: file,
      Bucket: bucket,
      Key: s3Path,
    })
    .promise();

  console.log('Uploaded to S3.');
}

/**
 * @typedef {{bucket: string; s3Path: string}} DeleteOptions
 * @param {DeleteOptions} deleteOptions
 */
async function deleteFromS3(deleteOptions) {
  const {AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY} = process.env;
  const {bucket, s3Path} = deleteOptions;
  checkEnvVars(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']);

  await new S3({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  })
    .deleteObject({
      Bucket: bucket,
      Key: s3Path,
    })
    .promise();

  console.log(`Deleted "${s3Path}" from S3`);
}

/**
 * @typedef {{bucket: string; s3FromPath: string; s3ToPath: string}} CopyOptions
 * @param {CopyOptions} copyOptions
 */
async function copyOnS3(copyOptions) {
  const {AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY} = process.env;
  const {bucket, s3FromPath, s3ToPath} = copyOptions;
  checkEnvVars(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']);

  await new S3({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  })
    .copyObject({
      ACL: 'public-read',
      Bucket: bucket,
      CopySource: s3FromPath,
      Key: s3ToPath,
    })
    .promise();

  console.log(`Copied "${s3FromPath}" to "${s3ToPath}" on S3`);
}

module.exports = {copyOnS3, deleteFromS3, uploadToS3};
