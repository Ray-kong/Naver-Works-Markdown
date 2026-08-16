export const MAX_MESSAGE_CHARACTERS = 250_000;
export const MAX_FILE_BYTES = 1_048_576;
export const FILE_TIMEOUT_MS = 2_000;
export const MERMAID_MAX_TEXT_SIZE = 50_000;
export const MERMAID_MAX_EDGES = 500;

// Mermaid's configuration uses these property names. Keep the policy values
// centralized while exposing the names consumed by the renderer.
export const maxTextSize = MERMAID_MAX_TEXT_SIZE;
export const maxEdges = MERMAID_MAX_EDGES;
