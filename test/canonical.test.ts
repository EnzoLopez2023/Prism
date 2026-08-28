import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalProductHash, canonicalTableHash } from '../lib/migration/canonicalHash.js'
import { testRepository } from './helpers.js'

test('canonical hashing is deterministic and type aware', t => {
  const fixture = testRepository()
  t.after(() => fixture.close())
  fixture.db.exec(`CREATE TABLE canonical_sample(id INTEGER PRIMARY KEY, value TEXT, bytes BLOB);
    INSERT INTO canonical_sample VALUES (1, NULL, X'00FF'), (2, 'é', X'')`)
  const first = canonicalTableHash(fixture.db, 'canonical_sample')
  const second = canonicalTableHash(fixture.db, 'canonical_sample')
  assert.deepEqual(first, second)
  assert.equal(first.rowCount, 2)
  assert.equal(canonicalProductHash('PrismFixture', [first]), canonicalProductHash('PrismFixture', [second]))
})
