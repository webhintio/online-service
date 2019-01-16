// This db commands are just for historic purpouse.
db.getCollection('jobs').updateMany({ webhintVersion: null }, { $rename: { sonarVersion: 'webhintVersion' } });
db.getCollection('jobs').updateMany({ hints: null }, { $rename: { rules: 'hints' } });
db.getCollection('jobs').updateMany({ rules: { $exists: true } }, { $unset: { rules: '' } });
db.getCollection('serviceconfigs').updateMany({ $where: 'this.webhintConfigs.length === 0' }, { $rename: { sonarConfigs: 'webhintConfigs' } });
db.getCollection('serviceconfigs').updateMany({}, { $unset: { sonarConfigs: '' } });

db.getCollection('status').updateMany({ hints: null }, { $rename: { 'rules.rules': 'rules.hints' } });
db.getCollection('status').updateMany({ hints: null }, { $rename: { rules: 'hints' } });

// Update category for all jobs
db.getCollection('jobs').update({}, { $set: { 'hints.$[elem].category': 'compatibility' } }, { arrayFilters: [{ 'elem.category': 'interoperability' }], multi: true });
