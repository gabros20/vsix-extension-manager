// Global Node.js type declarations
declare var process: any;
declare var console: any;
declare var Buffer: any;
declare var global: any;
declare var __dirname: string;
declare var __filename: string;

// Node.js modules
declare module 'fs' {
  export = require('node:fs');
}

declare module 'path' {
  export = require('node:path');
}

declare module 'os' {
  export = require('node:os');
}

declare module 'crypto' {
  export = require('node:crypto');
}

declare module 'child_process' {
  export = require('node:child_process');
}

declare module 'stream/promises' {
  export = require('node:stream/promises');
}

declare module 'fs-extra' {
  export = require('fs-extra');
}
