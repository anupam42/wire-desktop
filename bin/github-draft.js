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

const {default: axios} = require('axios');
const commander = require('commander');
const fs = require('fs-extra');

const {execAsync} = require('./utils');

commander
  .name('github-draft.js')
  .description('Create a release draft on GitHub')
  .option('-t, --github-token <token>', 'Specify the GitHub access token')
  .option('-w, --wrapper-build <build>', 'Specify the wrapper build (e.g. "Linux#3.7.1234")')
  .option('-p, --path <path>', 'Specify the local path to look for files (e.g. "../../wrap")')
  .parse(process.argv);

if (!commander.githubToken || !commander.wrapperBuild || !commander.wrapperBuild.includes('#')) {
  commander.outputHelp();
  process.exit(1);
}

const AuthorizationHeaders = {
  Authorization: `token ${commander.githubToken}`,
};

const draftUrl = `https://api.github.com/repos/wireapp/wire-desktop/releases`;

/**
 * @param {string[]} suffixes
 * @param {string} str
 */
const endsWithAny = (suffixes, str) => suffixes.some(suffix => str.endsWith(suffix));

/**
 * @typedef {{changelog: string, commitish: string, tagName: string, title: string}} DraftOptions
 * @param {DraftOptions} options
 */
async function createDraft(options) {
  const {changelog, commitish, tagName, title} = options;

  const draftData = {
    body: changelog,
    draft: true,
    name: title,
    prerelease: false,
    tag_name: tagName,
    target_commitish: commitish,
  };

  console.log('Creating a draft ...');
  console.log(draftData);

  try {
    const draftResponse = await axios.post(draftUrl, draftData, {headers: AuthorizationHeaders});
    console.log('Draft created.');
    return draftResponse;
  } catch (error) {
    console.error('Error response from GitHub:', error.response.data);
    throw new Error(
      `Draft creation failed with status code "${error.response.status}": "${error.response.statusText}"`
    );
  }
}

/**
 * @typedef {{fileName: string, filePath: string, fullDraftUrl: string, uploadUrl: string}} UploadOptions
 * @param {UploadOptions} options
 */
async function uploadAsset(options) {
  const {fileName, filePath, fullDraftUrl, uploadUrl} = options;

  console.log(`Uploading asset "${fileName}" ...`);

  const headers = {
    ...AuthorizationHeaders,
    'Content-type': 'application/binary',
  };
  const file = await fs.readFile(filePath);

  try {
    await axios.post(`${uploadUrl}?name=${fileName}`, file, {headers, maxContentLength: 104857600});
  } catch (uploadError) {
    console.error(
      `Upload failed with status code "${uploadError.response.status}": ${uploadError.response.statusText}"`
    );
    console.log('Deleting draft because upload failed');

    try {
      await axios.delete(fullDraftUrl, {headers: AuthorizationHeaders});
      console.log('Draft deleted');
    } catch (deleteError) {
      console.error('Error response from GitHub:', deleteError.response.data);
      throw new Error(
        `Deletion failed with status code "${deleteError.response.status}: ${deleteError.response.statusText}"`
      );
    } finally {
      throw new Error('Uploading asset failed');
    }
  }
  console.log(`Asset "${fileName}" uploaded.`);
}

(async () => {
  try {
    let PLATFORM;

    const [platform, version] = commander.wrapperBuild.toLowerCase().split('#');
    const basePath = commander.path || path.resolve('.');

    if (platform === 'linux') {
      PLATFORM = 'Linux';
    } else if (platform === 'windows') {
      PLATFORM = 'Windows';
    } else if (platform === 'macos') {
      PLATFORM = 'macOS';
    } else {
      throw new Error('Invalid platform');
    }

    const commitish = await execAsync('git rev-parse HEAD');

    const changelog = '...';

    const draftResponse = await createDraft({
      changelog,
      commitish,
      tagName: `${platform}/${version}`,
      title: `${version} - ${PLATFORM}`,
    });

    const {upload_url, url: fullDraftUrl} = draftResponse.data;
    const uploadUrl = upload_url.split('{')[0];

    const files = await fs.readdir(basePath);
    const uploadFiles = files.filter(fileName =>
      endsWithAny(['.asc', '.sig', '.AppImage', '.deb', '.exe', '.pkg'], fileName)
    );

    for (const fileName in uploadFiles) {
      const resolvedPath = path.join(basePath, fileName);
      await uploadAsset({fileName, filePath: resolvedPath, fullDraftUrl, uploadUrl});
    }

    console.log('Done.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
