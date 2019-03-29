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
const fs = require('fs-extra');

const {checkEnvVars, execAsync} = require('./utils');

checkEnvVars(['WRAPPER_BUILD', 'GITHUB_ACCESS_TOKEN']);

const WRAPPER_BUILD = process.env.WRAPPER_BUILD.toLowerCase();
const VERSION = process.env.WRAPPER_BUILD.split('#')[1];
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const DRAFT_RESOURCE = `https://api.github.com/repos/wireapp/wire-desktop/releases`;

const AuthorizationHeaders = {
  Authorization: `token ${GITHUB_ACCESS_TOKEN}`,
};

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
    const draftResponse = await axios.post(DRAFT_RESOURCE, draftData, {headers: AuthorizationHeaders});
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

    if (WRAPPER_BUILD.toLowerCase().includes('linux')) {
      PLATFORM = 'Linux';
    } else if (WRAPPER_BUILD.toLowerCase().includes('windows')) {
      PLATFORM = 'Windows';
    } else if (WRAPPER_BUILD.toLowerCase().includes('macos')) {
      PLATFORM = 'macOS';
    }

    const commitish = await execAsync('git rev-parse HEAD');
    const CWD = process.cwd();

    const changelog = '...';

    const draftResponse = await createDraft({
      changelog,
      commitish,
      tagName: `${PLATFORM.toLowerCase()}/${VERSION}`,
      title: `${VERSION} - ${PLATFORM}`,
    });

    const {upload_url, url: fullDraftUrl} = draftResponse.data;
    const uploadUrl = upload_url.split('{')[0];

    const files = await fs.readdir(CWD);

    await Promise.all(
      files
        .filter(fileName => endsWithAny(['.asc', '.sig', '.AppImage', '.deb', '.exe', '.pkg'], fileName))
        .map(fileName => {
          const resolvedPath = path.join(CWD, fileName);
          return uploadAsset({fileName, filePath: resolvedPath, fullDraftUrl, uploadUrl});
        })
    );

    console.log('Done.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
