/**
 * Safe arithmetic expression evaluator — shunting-yard to RPN, then evaluate.
 * Deliberately avoids eval/Function so no user input is ever executed as code.
 * Supports + - * / % ^, parentheses, unary minus, and decimals.
 */
'use strict';

const OPERATORS = {
  '+': { precedence: 1, assoc: 'left', apply: (a, b) => a + b },
  '-': { precedence: 1, assoc: 'left', apply: (a, b) => a - b },
  '*': { precedence: 2, assoc: 'left', apply: (a, b) => a * b },
  '/': { precedence: 2, assoc: 'left', apply: (a, b) => a / b },
  '%': { precedence: 2, assoc: 'left', apply: (a, b) => a % b },
  '^': { precedence: 3, assoc: 'right', apply: (a, b) => Math.pow(a, b) },
};

/** Tokenise. Normalises the display glyphs × ÷ − to * / -. */
export function tokenize(input) {
  const src = String(input)
    .replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/−/g, '-').replace(/,/g, '');
  const tokens = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (/\s/.test(ch)) { i++; continue; }

    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      if ((num.match(/\./g) || []).length > 1) throw new Error(`Malformed number "${num}"`);
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    if (OPERATORS[ch]) {
      const prev = tokens[tokens.length - 1];
      const isUnary = ch === '-' &&
        (!prev || prev.type === 'operator' || (prev.type === 'paren' && prev.value === '('));
      if (isUnary) {
        // Represent unary minus as (0 - x) at the token level.
        tokens.push({ type: 'number', value: 0 });
        tokens.push({ type: 'operator', value: '-', unary: true });
      } else {
        tokens.push({ type: 'operator', value: ch });
      }
      i++;
      continue;
    }

    throw new Error(`Unexpected character "${ch}"`);
  }

  return tokens;
}

/** Shunting-yard: infix tokens to RPN. */
export function toRPN(tokens) {
  const output = [];
  const stack = [];

  for (const t of tokens) {
    if (t.type === 'number') {
      output.push(t);
    } else if (t.type === 'operator') {
      const o1 = OPERATORS[t.value];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== 'operator') break;
        const o2 = OPERATORS[top.value];
        const shouldPop = (o1.assoc === 'left' && o1.precedence <= o2.precedence) ||
          (o1.assoc === 'right' && o1.precedence < o2.precedence);
        if (!shouldPop) break;
        output.push(stack.pop());
      }
      stack.push(t);
    } else if (t.value === '(') {
      stack.push(t);
    } else if (t.value === ')') {
      let found = false;
      while (stack.length) {
        const top = stack.pop();
        if (top.type === 'paren' && top.value === '(') { found = true; break; }
        output.push(top);
      }
      if (!found) throw new Error('Unbalanced parentheses');
    }
  }

  while (stack.length) {
    const top = stack.pop();
    if (top.type === 'paren') throw new Error('Unbalanced parentheses');
    output.push(top);
  }

  return output;
}

/** Evaluate RPN. */
export function evalRPN(rpn) {
  const stack = [];
  for (const t of rpn) {
    if (t.type === 'number') {
      stack.push(t.value);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Incomplete expression');
      stack.push(OPERATORS[t.value].apply(a, b));
    }
  }
  if (stack.length !== 1) throw new Error('Incomplete expression');
  const result = stack[0];
  if (!isFinite(result)) throw new Error('Result is not a finite number');
  return result;
}

/** Evaluate an arithmetic expression string. Throws on malformed input. */
export function evaluate(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) throw new Error('Empty expression');
  return evalRPN(toRPN(tokenize(trimmed)));
}
