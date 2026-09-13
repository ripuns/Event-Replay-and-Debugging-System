'use strict';

/*
  Prisma 7's generated client (src/generated/prisma) is written nodenext-style:
  its own internal imports use explicit ".js" specifiers (e.g. "./internal/class.js")
  even though only the ".ts" source exists on disk under ts-node's CJS runtime.
  `nest build`'s tsc compile handles this fine (it emits real .js files), and
  `ts-jest` handles it via jest's `moduleNameMapper` - but plain `ts-node/register`
  has no equivalent, so a bare `node -r ts-node/register` run crashes resolving
  those specifiers. This hook mirrors the jest moduleNameMapper approach: if a
  relative ".js" specifier fails to resolve as-is, retry it without the
  extension so Node's normal .ts-aware resolution (added by ts-node) can find
  the sibling .ts file. Must be `-r`'d before ts-node/register.
*/
const Module = require('module');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolveFilename(request, ...rest) {
  if (/^\.{1,2}\//.test(request) && request.endsWith('.js')) {
    try {
      return originalResolveFilename.call(this, request, ...rest);
    } catch (error) {
      const withoutExtension = request.slice(0, -'.js'.length);
      return originalResolveFilename.call(this, withoutExtension, ...rest);
    }
  }
  return originalResolveFilename.call(this, request, ...rest);
};
