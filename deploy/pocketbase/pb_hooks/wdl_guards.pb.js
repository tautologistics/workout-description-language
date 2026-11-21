/// <reference path="../pb_data/types.d.ts" />

// Server-side guards that PocketBase's rule language can't express, because
// it has no string concatenation and no pattern matching. Security audit H-1
// (SEC-2) and M-2 (SEC-4).
//
//   SEC-2: a namespaced key (`workouts.wdlId`, `movement_sets.setId`,
//   `goals.goalId` on a `user`-scoped goal) must start with the writer's own
//   handle and a colon, `<handle>:<slug>` (DEC-021 / DEC-027 / DEC-028).
//   Before this, only the app enforced it, so a raw API call could save
//   `crossfit:fran` on an attacker's own row and spoof an org's library.
//
//   SEC-4: a `users.handle` must pass the same shape rules as the app's
//   validateHandle() (apps/shared/handle.js): 3-63 characters of [a-z0-9-],
//   no leading or trailing hyphen, not all digits, not `api`/`admin`/`_`.
//   Before this, a raw PATCH could claim `admin`, or a handle containing `:`
//   that breaks `<handle>:<slug>` parsing. An empty handle is still allowed,
//   because Google sign-in creates the account before the app assigns one.
//
// Both checks run only when the value is being set or changed, so a later
// edit of an existing row (a soft delete, a rename) isn't blocked by data that
// predates the rule. Superusers (the admin UI, the `make *:load` loaders) are
// exempt: they write org rows under org handles on purpose.
//
// Deployed by `make deploy:db` into ~/pb/pb_hooks, which PocketBase loads by
// default (the directory beside pb_data). See
// deploy/pocketbase/pb_migrations/README.md for how this was verified.

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const { handleError } = require(`${__hooks}/lib/guards.js`);
    const handle = e.record.getString("handle");
    const err = handle === "" ? null : handleError(handle);
    if (err) throw new BadRequestError(err);
  }
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const { handleError } = require(`${__hooks}/lib/guards.js`);
    const handle = e.record.getString("handle");
    if (handle !== e.record.original().getString("handle")) {
      const err = handle === "" ? "A handle can't be cleared once set." : handleError(handle);
      if (err) throw new BadRequestError(err);
    }
  }
  e.next();
}, "users");

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const { keyError, keyIsBound, KEY_FIELD } = require(`${__hooks}/lib/guards.js`);
    const name = e.record.collection().name;
    const field = KEY_FIELD[name];
    if (keyIsBound(name, e.record)) {
      const handle = e.auth ? e.auth.getString("handle") : "";
      const err = keyError(field, e.record.getString(field), handle);
      if (err) throw new BadRequestError(err);
    }
  }
  e.next();
}, "workouts", "movement_sets", "goals");

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const { keyError, keyIsBound, KEY_FIELD } = require(`${__hooks}/lib/guards.js`);
    const name = e.record.collection().name;
    const field = KEY_FIELD[name];
    const key = e.record.getString(field);
    if (keyIsBound(name, e.record) && key !== e.record.original().getString(field)) {
      const handle = e.auth ? e.auth.getString("handle") : "";
      const err = keyError(field, key, handle);
      if (err) throw new BadRequestError(err);
    }
  }
  e.next();
}, "workouts", "movement_sets", "goals");
