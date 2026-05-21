'use strict';

/*
// bad
const show = hidden
  ? false
  : dismissibleKey
    ? (config ? !config.frontend[dismissibleKey] : true)
    : true;

// good
const show = (
  hidden
    ? false
    : dismissibleKey
      ? (config ? !config.frontend[dismissibleKey] : true)
      : true
);

// bad
const x =
a instanceof Foo;

// good
const x = (
  a instanceof Foo
);
*/

const isMultiline = (node) => {
  return node.loc.start.line !== node.loc.end.line;
};

const isParenthesized = (sourceCode, node) => {
  const before = sourceCode.getTokenBefore(node);
  const after = sourceCode.getTokenAfter(node);

  return (
    before
    && after
    && before.value === '('
    && after.value === ')'
  );
};

const needsWrapping = (node) => {
  return (
    node
    && (
      node.type === 'ConditionalExpression'
      || node.type === 'LogicalExpression'
      || node.type === 'BinaryExpression'
    )
  );
};

export default {
  meta: {
    type: 'layout',

    docs: {
      description: 'Enforce parentheses around multiline assignment expressions',
      recommended: false
    },

    fixable: 'code',

    schema: [],

    messages: {
      requireParens: 'Wrap multiline assignment expressions in parentheses.'
    }
  },

  create(context) {
    const sourceCode = context.sourceCode;

    const reportIfNeeded = (expr) => {
      if (!needsWrapping(expr)) {
        return;
      }

      if (!isMultiline(expr)) {
        return;
      }

      if (isParenthesized(sourceCode, expr)) {
        return;
      }

      context.report({
        node: expr,

        messageId: 'requireParens',

        fix(fixer) {
          const before = sourceCode.getTokenBefore(expr);

          const line = sourceCode.lines[expr.loc.start.line - 1];

          const baseIndent = line.match(/^\s*/)?.[0] ?? '';

          return [
            fixer.insertTextAfter(
              before,
              ' (\n'
            ),

            fixer.insertTextAfterRange(
              [expr.range[1], expr.range[1]],
              `\n${baseIndent})`
            )
          ];
        }
      });
    }

    return {
      VariableDeclarator(node) {
        if (!node.init) {
          return;
        }

        reportIfNeeded(node.init);
      },

      AssignmentExpression(node) {
        reportIfNeeded(node.right);
      }
    };
  }
};
