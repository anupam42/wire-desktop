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

import * as commander from 'commander';
import * as path from 'path';
import {findDown} from '../utils';
import {uploadToS3} from './s3-utils';

commander
  .name('s3.js')
  .description('Upload files to S3')
  .option('-b, --bucket <bucket>', 'Specify the S3 bucket to upload to')
  .option('-w, --wrapper-build <build>', 'Specify the wrapper build (e.g. "Linux#3.7.1234")')
  .option('-s, --s3path <s3path>', 'Specify the base path on S3 (e.g. "apps/windows")')
  .option('-p, --path <path>', 'Specify the local path to search for files (e.g. "../../wrap")')
  .parse(process.argv);

if (!commander.bucket || !commander.wrapperBuild || !commander.wrapperBuild.includes('#')) {
  commander.outputHelp();
  process.exit(1);
}

async function getUploadFiles(
  platform: string,
  basePath: string,
  version: string
): Promise<{filePath: string; fileName: string}[]> {
  if (platform.includes('linux')) {
    const appImage = await findDown('.AppImage', {cwd: basePath});
    const debImage = await findDown('.deb', {cwd: basePath});
    const repositoryFiles = [
      `debian/pool/main/${debImage.fileName}`,
      'debian/dists/stable/Contents-amd64',
      'debian/dists/stable/Contents-amd64.bz2',
      'debian/dists/stable/Contents-amd64.gz',
      'debian/dists/stable/InRelease',
      'debian/dists/stable/Release',
      'debian/dists/stable/Release.gpg',
      'debian/dists/stable/main/binary-amd64/Packages',
      'debian/dists/stable/main/binary-amd64/Packages.bz2',
      'debian/dists/stable/main/binary-amd64/Packages.gz',
    ].map(fileName => ({fileName, filePath: path.join(basePath, fileName)}));

    return [...repositoryFiles, appImage, debImage];
  } else if (platform.includes('windows')) {
    const setupExe = await findDown('-Setup.exe', {cwd: basePath});
    const nupkgFile = await findDown('-full.nupkg', {cwd: basePath});
    const releasesFile = await findDown('RELEASES', {cwd: basePath});

    const [, appShortName] = new RegExp('(.+)-[\\d.]+-full\\.nupkg').exec(nupkgFile.fileName);

    if (!appShortName) {
      throw new Error('App short name not found');
    }

    const setupExeRenamed = {...setupExe, fileName: `${appShortName}-${version}.exe`};
    const releasesRenamed = {...releasesFile, fileName: `${appShortName}-${version}-RELEASES`};

    return [nupkgFile, releasesRenamed, setupExeRenamed];
  } else if (platform.includes('macos')) {
    const setupPkg = await findDown('.pkg', {cwd: basePath});
    return [setupPkg];
  } else {
    throw new Error('Invalid platform');
  }
}

(async () => {
  const searchBasePath = commander.path || path.join(__dirname, '../../wrap');
  const s3BasePath = `${commander.s3path || ''}/`;
  const [platform, version] = commander.wrapperBuild.toLowerCase().split('#');

  const files = await getUploadFiles(platform, searchBasePath, version);

  for (const file of files) {
    const {fileName, filePath} = file;
    const s3Path = `${s3BasePath}${fileName}`.replace('//', '/');
    await uploadToS3({bucket: commander.bucket, filePath, s3Path});
  }

  console.log('Done uploading to S3.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
