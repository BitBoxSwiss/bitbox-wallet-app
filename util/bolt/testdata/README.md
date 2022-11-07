# segfaults-on-check.db

Eunning `bbolt check segfaults-on.check.db` or running `tx.Check()` after opening this DB segfaults.
Segfaults cannot be recovered, so for now we leave this fixture in the hopes that the issue will be
solved upstream.

See https://github.com/etcd-io/bbolt/issues/105#issuecomment-1308502456.

# corrupt.db.gz

Zipped database that is corrupt and fails the `Check()` test.
