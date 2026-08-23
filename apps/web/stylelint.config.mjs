/**
 * CSS rules for the post-globals.css layout.
 *
 * Three tiers, because the files are in three different states:
 *
 *   src/shared/styles/**   tokens + reset + typography. Hard errors.
 *   src/features/**        CSS a feature owns. Hard errors.
 *   src/styles/**          the 11k lines lifted out of globals.css.
 *   src/components/**      hierarchy.css, which predates the split.
 *
 * The last two are linted, but the token debt they arrived with is a *warning*
 * under a fixed ceiling (see RATCHET below). Substituting a token there is not
 * a no-op: --accent-rose-glow is rgba(244,63,94,.3) in dark and
 * rgba(225,29,72,.15) in light, so replacing a raw literal that matches the
 * dark value changes how light theme renders. That is the point of tokenising
 * and also why it cannot be done by codemod.
 *
 * `src/app/globals.css` is ignored: it is now an import manifest, and the
 * import order in it is load-bearing (components.css must stay last, or
 * .glass-panel stops beating .section-card).
 *
 * ── RATCHET ─────────────────────────────────────────────────────────────────
 * `npm run lint:css` passes `--max-warnings=742`, today's exact count. Nothing
 * new can be added to the pile, and the number only moves down. When you fix
 * warnings, lower the ceiling in package.json in the same commit — otherwise
 * the slack you leave is slack the next person can spend.
 *
 * Do NOT widen the override to make a new file pass. New CSS goes in
 * features/ or shared/, where these are errors.
 */

/** stylelint's "downgrade to warning" secondary-option object. */
const warn = { severity: "warning" };

/* Raw rgba() in a colour-ish property. Kept verbatim between the error tier
 * and the warning tier so the two tiers cannot silently diverge. */
const NO_RAW_RGBA = {
  // A real RegExp, not stylelint's "/…/" string form: the string form has to be
  // double-escaped and silently degrades to a literal-substring match when it
  // isn't. This cannot be got wrong.
  "/^(color|background|background-color|border|border-color|box-shadow|fill|stroke|outline-color)$/":
    [/rgba?\(/],
};

const TOKEN_MESSAGE =
  "Use a token from shared/styles/tokens.css. globals.css accumulated 220 hex " +
  "literals and 1,166 rgba() values against 191 tokens — a 7:1 ratio that made " +
  "theming impossible. Raw literals are how that happened.";

/** @type {import('stylelint').Config} */
export default {
  extends: "stylelint-config-standard",
  ignoreFiles: ["src/app/globals.css", "**/node_modules/**", ".next/**"],

  rules: {
    "color-no-hex": [true, { message: TOKEN_MESSAGE }],
    "declaration-property-value-disallowed-list": NO_RAW_RGBA,
    "declaration-no-important": true,

    /* :not(.a):not(.b) has specificity 0,2,0; the "complex" :not(.a, .b) this
     * rule prefers has 0,1,0. That is a silent specificity drop — the exact
     * class of change that flips a cascade winner. Pin the chained form. */
    "selector-not-notation": "simple",

    /* overflow-x + overflow-y collapse to `overflow: <x> <y>`, which only
     * landed in Safari 15. The longhands work everywhere; tidiness is not
     * worth raising the browser floor. */
    "declaration-block-no-redundant-longhand-properties": [
      true,
      { ignoreShorthands: ["overflow"] },
    ],

    /* Every prefixed property in this repo is one Safari still needs:
     * -webkit-backdrop-filter, -webkit-mask-image, -webkit-appearance. There
     * is no autoprefixer behind this build, so "fixing" the rule deletes
     * working CSS — `stylelint --fix` already tried to, once. */
    "property-no-vendor-prefix": null,

    /* Conventions this codebase deliberately does not follow. */
    "custom-property-pattern": null,
    "selector-class-pattern": null,
    "no-descending-specificity": null,
    "media-feature-range-notation": null,
    "color-function-notation": null,
    "color-function-alias-notation": null,
    "alpha-value-notation": null,
    "comment-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "declaration-empty-line-before": null,
    "rule-empty-line-before": null,
  },

  overrides: [
    {
      /* The token file is where the literals are supposed to live. */
      files: ["src/shared/styles/tokens.css"],
      rules: {
        "color-no-hex": null,
        "declaration-property-value-disallowed-list": null,
      },
    },
    {
      /* The legacy pile. Same rules, warning severity, fixed ceiling.
       * no-duplicate-selectors is a warning rather than an error because the
       * fix — merging the blocks — moves declarations and so can change which
       * rule wins. Each one needs reading, not a codemod. */
      files: ["src/styles/**/*.css", "src/components/**/*.css"],
      rules: {
        "declaration-property-value-disallowed-list": [NO_RAW_RGBA, warn],
        "color-no-hex": [true, { message: TOKEN_MESSAGE, ...warn }],
        "declaration-no-important": [true, warn],
        "declaration-block-single-line-max-declarations": [1, warn],
        "no-duplicate-selectors": [true, warn],
        "declaration-property-value-keyword-no-deprecated": [true, warn],
        "property-no-deprecated": [true, warn],
        "length-zero-no-unit": [true, warn],
      },
    },
  ],
};
