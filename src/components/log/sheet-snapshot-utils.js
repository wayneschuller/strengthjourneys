/**
 * Sheet row snapshot helpers for verified log-page write operations.
 * These functions preserve exact sparse-sheet identity while UI fields are
 * edited optimistically.
 */

export function getAutoTimestampNotes() {
  return `${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} `;
}

export function getEditableSetFields(set) {
  return {
    reps: set.reps,
    weight: set.weight,
    unitType: set.unitType ?? "",
    notes: set.notes ?? "",
    url: set.URL ?? "",
  };
}

export function buildSheetSnapshotFromFields(fields, identity = {}) {
  return {
    date: identity.date ?? "",
    // Verified sheet writes must match the original sheet label, not the
    // normalized app label, so aliased rows (for example "OHP") stay editable.
    liftType: identity.rawLiftType ?? identity.liftType ?? "",
    reps: fields.reps != null ? String(fields.reps) : "",
    weight:
      fields.weight != null ? `${fields.weight}${fields.unitType ?? ""}` : "",
    notes: fields.notes ?? "",
    url: fields.url ?? "",
  };
}

export function buildSheetSnapshotFromSetLike(set) {
  if (!set) return null;
  if (set._serverSnapshot) return set._serverSnapshot;
  const fields = getEditableSetFields(set);
  return {
    date: set.date ?? "",
    // Use rawLiftType to match exact sheet label (e.g. "OHP") not normalized form.
    liftType: set.rawLiftType ?? set.liftType ?? "",
    reps: fields.reps != null ? String(fields.reps) : "",
    // Use rawWeight to avoid unit-suffix mismatches for older ambiguous rows.
    weight:
      set.rawWeight != null
        ? set.rawWeight
        : fields.weight != null
          ? `${fields.weight}${fields.unitType ?? ""}`
          : "",
    notes: fields.notes ?? "",
    url: fields.url ?? "",
  };
}

export function snapshotToEditableFields(snapshot) {
  const weightValue =
    typeof snapshot?.weight === "string"
      ? parseFloat(snapshot.weight)
      : snapshot?.weight;
  const unitMatch =
    typeof snapshot?.weight === "string"
      ? snapshot.weight.match(/[a-zA-Z]+$/)
      : null;
  return {
    reps: snapshot?.reps != null ? Number(snapshot.reps) : "",
    weight: Number.isNaN(weightValue) ? "" : weightValue,
    unitType: unitMatch?.[0] ?? "",
    notes: snapshot?.notes ?? "",
    url: snapshot?.url ?? "",
  };
}

export function getCellValueForField(field, fields) {
  if (field === "reps") return fields.reps != null ? String(fields.reps) : "";
  if (field === "weight") {
    return fields.weight != null
      ? `${fields.weight}${fields.unitType ?? ""}`
      : "";
  }
  if (field === "notes") return fields.notes ?? "";
  if (field === "url") return fields.url ?? "";
  return "";
}

export async function readApiError(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  return {
    message: payload?.error || fallbackMessage,
    code: payload?.code || null,
    actual: payload?.actual || null,
  };
}

// Accept comma-as-decimal for locale keyboards that only offer `,`.
export function parseWeightInput(value) {
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.includes(".") ? value : value.replace(",", ".");
  return Number.parseFloat(normalized);
}
