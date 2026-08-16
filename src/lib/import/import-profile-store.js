/*
 * Server-only persistence for the cross-device import ritual profile.
 * It updates the existing per-user KV record with bounded workflow metadata;
 * no workout contents, filenames, or lift values are stored here.
 */

import { kv } from "@/lib/kv";
import { buildNextImportProfile } from "@/lib/import/import-profile";
import { getImportSource } from "@/lib/import/import-sources";
import { getUserKvKey } from "@/lib/user-kv-keys";

export async function getImportProfile(email) {
  if (!email) return null;
  const record = (await kv.get(getUserKvKey(email))) || {};
  return record.importProfile || null;
}

export async function recordImportActivity(email, activity) {
  if (!email) return null;
  const key = getUserKvKey(email);
  const record = (await kv.get(key)) || {};
  const source = getImportSource(activity);
  const currentProfile = record.importProfile || null;
  const sourceProfile = currentProfile?.sources?.[source.id];
  const previousCheckMs = sourceProfile?.lastCheckedAt
    ? new Date(sourceProfile.lastCheckedAt).getTime()
    : null;
  const checkedAtMs = new Date(activity.checkedAt).getTime();
  const isDuplicateFreshnessCheck =
    activity.insertedRows === 0 &&
    Number.isFinite(previousCheckMs) &&
    Number.isFinite(checkedAtMs) &&
    checkedAtMs >= previousCheckMs &&
    checkedAtMs - previousCheckMs < 60_000 &&
    (sourceProfile.latestWorkoutDate || null) ===
      (activity.latestWorkoutDate || null);

  if (isDuplicateFreshnessCheck) {
    return {
      ...buildNextImportProfile(currentProfile, activity),
      profile: currentProfile,
      duplicateActivity: true,
    };
  }
  const transition = buildNextImportProfile(currentProfile, activity);
  await kv.set(key, {
    ...record,
    importProfile: transition.profile,
  });
  return transition;
}
