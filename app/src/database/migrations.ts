import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'products',
          columns: [
            { name: 'volume_discount_strategy', type: 'string' }, // auto, manual
          ],
        }),
      ],
    },
  ],
});
