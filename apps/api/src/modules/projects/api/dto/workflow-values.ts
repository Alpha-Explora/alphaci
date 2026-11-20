/**
 * Shapes for values AlphaCI writes into generated workflow YAML. Each excludes
 * what could change the workflow rather than name something in it: line
 * breaks and other control characters, and `$`, `{` and `}`, which open a
 * GitHub Actions expression (`${{ }}`) that would be evaluated inside the
 * reusable workflow's inputs. Project creation and the workflow settings
 * preview and pull request apply the same shapes.
 */

/** A service name: any printable text without `$`, `{` or `}`. */
export const WORKFLOW_SERVICE_NAME = /^[^\p{Cc}\p{Zl}\p{Zp}${}]+$/u;
export const WORKFLOW_SERVICE_NAME_MESSAGE =
  'serviceName may not contain line breaks, "$", "{" or "}"';

/**
 * `.` or a relative path inside the repository: no leading `/` or `\`, no
 * `..` segment, and the same excluded characters as a service name.
 */
export const WORKFLOW_SERVICE_PATH =
  /^(?![/\\]|[A-Za-z]:)(?!.*(?:^|[/\\])\.\.(?:[/\\]|$))[^\p{Cc}\p{Zl}\p{Zp}${}]+$/u;
export const WORKFLOW_SERVICE_PATH_MESSAGE =
  'servicePath must be "." or a relative path inside the repository, without ".." or "$", "{", "}"';

/** A git ref (`v1`, `main`, `release/2`, a sha). */
export const WORKFLOW_GIT_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** A Node version spec (`24`, `22.x`, `20.11.1`, `lts/*`). */
export const WORKFLOW_NODE_VERSION = /^[A-Za-z0-9][A-Za-z0-9.*/_-]*$/;

/** A catalog id such as `fe-nextjs`. */
export const CATALOG_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
