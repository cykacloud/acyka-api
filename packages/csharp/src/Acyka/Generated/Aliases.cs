// Generated from openapi.json by tools/generate.ts. Do not edit.

// A post's id, on the wire as a string and in the database as a bigint.
//
// Its own type rather than a `String` field, so the conversion happens in one
// place and a query that forgets it does not compile. JSON has one number type
// and it is a double; ids near 2^53 are exactly where that stops being an
// academic point, and a client that silently rounds one reads and edits the
// wrong row.
global using PostId = string;
