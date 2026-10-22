// Types and scopes are closed lists, following Conventional Commits.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'perf', 'build', 'ci'],
    ],
    'scope-enum': [
      2,
      'always',
      ['web', 'service', 'shared', 'recurrence', 'matching', 'db', 'e2e', 'docker'],
    ],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 71],
  },
};
