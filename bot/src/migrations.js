const FPersist = require('fpersist');
const path = require('path');

const monochromePersistence = new FPersist(path.join(__dirname, '..', 'data', 'monochrome-persistence'));

let getAllKeysPromise;
function getAllKeys() {
  if (!getAllKeysPromise) {
    getAllKeysPromise = monochromePersistence.getAllKeys();
  }

  return getAllKeysPromise;
}

async function migrateServerSettings(logger, mongoPersistence) {
  try {
    const globalData = await monochromePersistence.getItem('Global', {});
    const prefixForServerId = globalData.prefixes;
    if (!prefixForServerId) {
      return logger.info({ detail: 'Skipping server settings migration. It appears to have already been completed.' });
    }

    logger.info({ detail: 'Migrating server settings.' });

    const allFPersistKeys = await getAllKeys();
    const serverIdsMap = {};
    allFPersistKeys
      .filter(k => k.startsWith('Server'))
      .map(serverKey => serverKey.replace('Server', ''))
      .concat(Object.keys(prefixForServerId))
      .forEach((id) => { serverIdsMap[id] = true; });

    const serverIds = Object.keys(serverIdsMap);
    await Promise.all(serverIds.map(async (serverId) => {
      const serverKey = `Server${serverId}`;
      const serverData = await monochromePersistence.getItem(serverKey);
      const prefix = prefixForServerId[serverId];
      const newServerData = { ...serverData, prefix };
      if (!newServerData.prefix) {
        delete newServerData.prefix;
      }

      await mongoPersistence.setValue(`Monochrome__Server__${serverId}`, newServerData);
      await monochromePersistence.deleteItem(serverKey);
    }));

    await monochromePersistence.editItem('Global', (oldGlobalData) => {
      const { prefixes, ...newGlobalData } = oldGlobalData; // Remove the prefixes property
      return newGlobalData;
    });
    return logger.info({ detail: 'Server settings migrated.' });
  } catch (err) {
    return logger.error({
      detail: 'ERROR MIGRATING SERVER SETTINGS',
      err,
    });
  }
}

async function migrate(logger, mongoPersistence) {
  await Promise.all([
    migrateServerSettings(logger, mongoPersistence),
  ]);
}

module.exports = migrate;
