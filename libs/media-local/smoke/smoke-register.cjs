const Module = require('node:module');
const nodeJsLoader = Module._extensions['.js'];
require('@swc-node/register');
Module._extensions['.js'] = nodeJsLoader;
