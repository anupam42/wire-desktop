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

const {createVersion, uploadVersion, zip} = require('./hockey-utils');
const {checkEnvVars} = require('../utils');

checkEnvVars(['LINUX_HOCKEY_ID', 'LINUX_HOCKEY_TOKEN', 'WRAPPER_BUILD']);

const HOCKEY_ID = process.env.LINUX_HOCKEY_ID;
const HOCKEY_TOKEN = process.env.LINUX_HOCKEY_TOKEN;
const VERSION = process.env.WRAPPER_BUILD.split('#')[1];

const wireDeb = path.join(__dirname, `../../wrap/dist/WireInternal-${VERSION}-internal_amd64.deb`);

(async () => {
  try {
    const zipFile = await zip(wireDeb, wireDeb.replace('.deb', '.zip'));

    const {id: hockeyVersionId} = await createVersion({
      hockeyAppId: HOCKEY_ID,
      hockeyToken: HOCKEY_TOKEN,
      version: VERSION,
    });

    await uploadVersion({
      filePath: zipFile,
      hockeyAppId: HOCKEY_ID,
      hockeyToken: HOCKEY_TOKEN,
      hockeyVersionId,
      version: VERSION,
    });

    await fs.remove(zipFile);
    console.log('Done.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
