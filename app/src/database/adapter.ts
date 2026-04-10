import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import migrations from './migrations';

export default new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'ConstruxPDV',
  jsi: true,
  onSetUpError: error => {
    console.error('WatermelonDB SQLite setup error:', error);
  }
});
