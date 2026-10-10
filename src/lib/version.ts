// The app's version, written into .vidz manifests (createdBy.version).
// Imported from package.json so there's a single source of truth.
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
