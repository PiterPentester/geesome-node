'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const groupsTable = await queryInterface.describeTable('groups');

    if(groupsTable['isOpen']) {
      return;
    }

    return Promise.all([
      queryInterface.addColumn('groups', 'isOpen', {
        type: Sequelize.BOOLEAN
      }).catch(() => {})
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('groups', 'isOpen').catch(() => {})
    ]);
  }
};
