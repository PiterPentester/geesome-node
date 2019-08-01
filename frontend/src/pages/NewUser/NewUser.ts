/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company 
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster), 
 * [Valery Litvin](https://github.com/litvintech) by 
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 * ​
 * Copyright ©️ 2018 Galt•Core Blockchain Company 
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and 
 * Galt•Space Society Construction and Terraforming Company by 
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

import PeriodInput from "@galtproject/frontend-core/directives/PeriodInput/PeriodInput";
import EthData from "@galtproject/frontend-core/libs/EthData";

const pIteration = require('p-iteration');

export default {
  template: require('./NewUser.html'),
  components: {PeriodInput},
  methods: {
    create() {
      this.creation = true;
      this.$coreApi.adminCreateUser(this.user).then(async (createdUser) => {
        if (!this.passwordAuth) {
          this.resultApiKey = await this.$coreApi.adminAddUserAPiKey(createdUser.id);
        }
        if (this.userLimit.isActive) {
          await this.$coreApi.adminSetUserLimit(this.user);
        }
        if (this.isAdmin) {
          const permissions = ['admin:read', 'admin:add_user', 'admin:set_permissions', 'admin:set_user_limit', 'admin:add_user_api_key'];
          await pIteration.forEach(permissions, (permissionName) => {
            return this.$coreApi.adminAddCorePermission(createdUser.id, permissionName)
          });
        }
        this.created = true;
        this.error = null;
      }).catch((e) => {
        this.error = e && e.message && EthData.humanizeKey(e.message);
        this.creation = false;
      })
    }
  },
  computed: {
    creationDisabled() {
      return !this.user.name || !this.user.email || !(this.passwordAuth ? this.user.password : true) || !(this.userLimit.isActive ? (this.userLimit.valueMb && this.userLimit.periodTimestamp) : true);
    }
  },
  data() {
    return {
      localeKey: 'new_user',
      user: {
        name: '',
        title: '',
        email: '',
        keyStoreMethod: ''
      },
      isAdmin: false,
      passwordAuth: true,
      userLimit: {
        isActive: false,
        periodTimestamp: 60 * 60 * 24,
        valueMb: 100,
        name: 'save_content:size' //TODO: include and use UserLimitName.SaveContentSize
      },
      resultApiKey: null,
      error: null,
      creation: false,
      created: false
    };
  }
}
