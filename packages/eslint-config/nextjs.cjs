/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    require.resolve('./base.cjs'),
    'next/core-web-vitals',
    'prettier',
  ],
  env: {
    browser: true,
    node: true,
  },
};
