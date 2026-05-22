/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@expense-tracker/eslint-config/nestjs.cjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
