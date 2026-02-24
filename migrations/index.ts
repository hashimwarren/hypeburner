import * as migration_20260222_213104_issue53_schema from './20260222_213104_issue53_schema'

export const migrations = [
  {
    up: migration_20260222_213104_issue53_schema.up,
    down: migration_20260222_213104_issue53_schema.down,
    name: '20260222_213104_issue53_schema',
  },
]
