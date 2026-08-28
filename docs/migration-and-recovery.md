# Migration, reconciliation, and recovery

## Legacy import

The importer accepts only an operator-supplied immutable SQLite backup and an
empty Prism target:

```bash
npm run legacy:import -- /secure/hearth.db /staging/prism.db /staging/artifacts
npm run legacy:reconcile -- /secure/hearth.db /staging/prism.db /staging/artifacts
```

Before writing, it verifies source bytes, SHA-256, all four source table hashes,
and the canonical Prism product hash. It opens the source read-only with
`query_only=ON`, applies Prism migrations to the target, preserves row IDs and
timestamps, records explicit lineage, and externalizes every image.
Artifact publication uses deterministic content-addressed keys and atomic
temporary-file rename compatible with Azure Files (no hard links). An
exclusive target import claim serializes writers. An interrupted retry adopts
an exact verified object, replaces
a mismatched unreferenced object only while the target authority is proven
empty, and then commits all four tables plus the import record in one SQLite
transaction.

Reconciliation compares:

- all four source/target counts and legacy key sets;
- type-aware canonical field hashes;
- image bytes through content hashes and object existence;
- relationships and all foreign keys;
- SQLite sequences against maximum imported IDs.

The production rehearsal imported and matched 56 conversations, 230 messages,
17 images, and 40 prompts: 343 rows, zero differences, zero foreign-key
violations.

## Cutover

1. Quiesce only Hearth writes to conversations and prompts.
2. Capture and independently verify the approved immutable backup.
3. Import into an empty Prism authority and reconcile to zero differences.
4. Verify artifact retrieval and application readiness.
5. Promote Prism and record its first committed write.
6. Keep the immutable source backup and old read-only authority through soak.

After Prism's first write, recovery is forward-only. There is no dual write.

## Recovery

Recovery snapshots SQLite and every referenced external conversation image as
one immutable generation:

```bash
npm run recovery -- backup <source.db> <artifact-root> <generation-dir>
npm run recovery -- verify <generation-dir>
npm run recovery -- restore <generation-dir> <destination.db> <artifact-root>
```

Backup uses SQLite's online backup API, validates every source and copied
artifact against SQLite size/hash metadata, and publishes the generation only
after all checks pass. The manifest records database bytes/hash, creation
provenance, all-table counts, and the exact artifact key/type/bytes/hash set.
Verification is read-only: it checks immutable expected evidence and fails on
any mismatch without rewriting the manifest. Creation identity remains
historical provenance, so a later Prism release can verify an older generation
without requiring current build identity equality.

The application runtime, import, and restore all take the same exclusive
`<database>.operation.claim` gate, created with atomic exclusive file creation
on the shared authority. Existing claims always fail closed; PID liveness is
never used and no host may delete or steal a claim automatically.

Restore takes that exclusive operator-target claim, copies into invocation-owned
private staging paths, verifies the entire database/artifact set, promotes
artifacts first, and promotes the database last as the authority marker. A
concurrent restore cannot clean another invocation's state. After an
interruption, the unchanged claim blocks every app/operator process until an
explicit recovery review.

## Operation claim recovery

Claim recovery is deliberately separate from import/restore:

```bash
npm run claim:recover -- \
  /home/data/prism.db.operation.claim \
  /secure/prism-claim-evidence \
  "RECOVER PRISM OPERATION CLAIM" \
  --token <recorded-token>
```

Before running it, the operator must use the one-instance deployment gate to
stop Prism and prove no import/restore operator is active. The command acquires
its own exclusive recovery claim, requires the exact path/token/confirmation,
archives immutable path/bytes/hash/content evidence, re-reads and revalidates
the unchanged token, atomically quarantines the path under the common recovery
mutex, verifies moved device/inode/bytes, and removes only that exact
quarantine. If a replacement won the path, Azure-compatible no-clobber restore
preserves it; a second claimant is never overwritten and the prior replacement
remains quarantined as evidence. It never cleans staging
or data automatically; those artifacts remain available for the operator's
evidence-led disposition.

Claim publication fsyncs the exclusively created file. A synchronous
write/fsync failure removes it only after descriptor/path device+inode
ownership proof. A crash can still leave an empty, truncated, or otherwise
malformed claim; it remains fail-closed and uses raw evidence recovery:

```bash
npm run claim:recover -- \
  /home/data/prism.db.operation.claim \
  /secure/prism-claim-evidence \
  "RECOVER MALFORMED PRISM OPERATION CLAIM" \
  --raw-bytes <exact-byte-count> \
  --raw-sha256 <exact-sha256>
```

Malformed recovery archives the raw claim bytes as base64, requires the exact
recorded length/hash, and immediately revalidates device, inode, bytes, and
hash before quarantine. A JSON object is token-recoverable only when it has the
exact ClaimRecord keys, a UUIDv4 token, positive safe PID, bounded operation,
canonical ISO timestamp, and plain-object payload; every other shape uses raw
evidence recovery. Every evidence filename and record includes a unique
recovery UUID, so repeated recovery of byte-identical malformed claims into the
same archive never overwrites or collides with earlier evidence.

Conversation deletion is also recoverable across storage outages and crashes.
SQLite records every object in `artifact_deletion_queue` before deletion,
rejects new messages while deletion is pending, refreshes the object set before
final commit, and removes the conversation only after every private artifact is
gone. Startup resumes durable pending deletions.

The initial filesystem artifact adapter is app-owned and keeps bytes outside
SQLite. Back up the database and artifact root as one recovery generation. A
future Blob adapter must preserve object keys and hashes, use Prism managed
identity, verify uploaded bytes by read-back, and complete a disposable restore
before becoming authoritative.

SQLite production constraints: `/home/data/prism.db`, `journal_mode=DELETE`,
`foreign_keys=ON`, five-second busy timeout, one process, one worker, one App
Service instance, and no scale-out. Integrity scans and backups do not run on
startup or request paths.
