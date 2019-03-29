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

const fs = require('fs-extra');

const {createVersion, uploadVersion, zip} = require('./hockey-utils');
const {checkEnvVars, findDown} = require('../utils');

checkEnvVars(['MACOS_CUSTOM_HOCKEY_ID', 'MACOS_CUSTOM_HOCKEY_TOKEN', 'WRAPPER_BUILD']);

const HOCKEY_ID = process.env.MACOS_CUSTOM_HOCKEY_ID;
const HOCKEY_TOKEN = process.env.MACOS_CUSTOM_HOCKEY_TOKEN;
const VERSION = process.env.WRAPPER_BUILD.split('#')[1];

(async () => {
  try {
    const appExe = await findDown('.pkg', '../../');

    if (!appExe) {
      throw new Error('Could not find setup package');
    }
    const zipFile = await zip(appExe, appExe.replace('.pkg', '.zip'));

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
