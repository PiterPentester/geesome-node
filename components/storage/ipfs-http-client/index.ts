/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import {IGeesomeApp} from "../../app/interface";

const JsIpfsServiceNode = require("geesome-libs/src/JsIpfsServiceNode");

const IPFS = require('ipfs-http-client');

module.exports = async (app: IGeesomeApp) => {
  const node = new IPFS(app.config.storageConfig.goNode);

  return new JsIpfsServiceNode(node);
};
