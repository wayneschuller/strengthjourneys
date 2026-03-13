// Operation-oriented sheet API: insert-row
//
// This route intentionally models the Google Sheet as a first-class document.
// We are not forcing this into a REST resource model because row insertion is a
// structural sheet mutation with formatting and sparse-anchor rules attached.
//
// The client sends the exact row values to insert plus the insertion position.
// This keeps creation row-oriented while edit-cell / edit-row stay focused on
// non-structural updates.

export { default } from "@/pages/api/sheet/log-session";
