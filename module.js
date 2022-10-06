

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

// Normally we don't log exceptions but instead let them bubble out the top
// level where the embedding environment (e.g. the browser) can handle
// them.
// However under v8 and node we sometimes exit the process direcly in which case
// its up to use us to log the exception before exiting.
// If we fix https://github.com/emscripten-core/emscripten/issues/15080
// this may no longer be needed under node.
function logExceptionOnExit(e) {
  if (e instanceof ExitStatus) return;
  var toLog = e;
  if (e && typeof e === 'object' && e.stack) {
    toLog = [e, e.stack];
  }
  err('exiting due to exception: ' + toLog);
}

var nodeFS;
var nodePath;

if (ENVIRONMENT_IS_NODE) {
  if (!(typeof process === 'object' && typeof require === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = require('path').dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js


read_ = function shell_read(filename, binary) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    return binary ? ret : ret.toString();
  }
  if (!nodeFS) nodeFS = require('fs');
  if (!nodePath) nodePath = require('path');
  filename = nodePath['normalize'](filename);
  return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
};

readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

readAsync = function readAsync(filename, onload, onerror) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    onload(ret);
  }
  if (!nodeFS) nodeFS = require('fs');
  if (!nodePath) nodePath = require('path');
  filename = nodePath['normalize'](filename);
  nodeFS['readFile'](filename, function(err, data) {
    if (err) onerror(err);
    else onload(data.buffer);
  });
};

// end include: node_shell_read.js
  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  // Without this older versions of node (< v15) will log unhandled rejections
  // but return 0, which is not normally the desired behaviour.  This is
  // not be needed with node v15 and about because it is now the default
  // behaviour:
  // See https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode
  process['on']('unhandledRejection', function(reason) { throw reason; });

  quit_ = function(status, toThrow) {
    if (keepRuntimeAlive()) {
      process['exitCode'] = status;
      throw toThrow;
    }
    logExceptionOnExit(toThrow);
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };

} else
if (ENVIRONMENT_IS_SHELL) {

  if ((typeof process === 'object' && typeof require === 'function') || typeof window === 'object' || typeof importScripts === 'function') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  readAsync = function readAsync(f, onload, onerror) {
    setTimeout(function() { onload(readBinary(f)); }, 0);
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = function(status, toThrow) {
      logExceptionOnExit(toThrow);
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr !== 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document !== 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  if (!(typeof window === 'object' || typeof importScripts === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {

// include: web_or_worker_shell_read.js


  read_ = function(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  readAsync = function(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

// end include: web_or_worker_shell_read.js
  }

  setWindowTitle = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];
if (!Object.getOwnPropertyDescriptor(Module, 'arguments')) {
  Object.defineProperty(Module, 'arguments', {
    configurable: true,
    get: function() {
      abort('Module.arguments has been replaced with plain arguments_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (Module['thisProgram']) thisProgram = Module['thisProgram'];
if (!Object.getOwnPropertyDescriptor(Module, 'thisProgram')) {
  Object.defineProperty(Module, 'thisProgram', {
    configurable: true,
    get: function() {
      abort('Module.thisProgram has been replaced with plain thisProgram (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (Module['quit']) quit_ = Module['quit'];
if (!Object.getOwnPropertyDescriptor(Module, 'quit')) {
  Object.defineProperty(Module, 'quit', {
    configurable: true,
    get: function() {
      abort('Module.quit has been replaced with plain quit_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] === 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] === 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] === 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] === 'undefined', 'Module.setWindowTitle option was removed (modify setWindowTitle in JS)');
assert(typeof Module['TOTAL_MEMORY'] === 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');

if (!Object.getOwnPropertyDescriptor(Module, 'read')) {
  Object.defineProperty(Module, 'read', {
    configurable: true,
    get: function() {
      abort('Module.read has been replaced with plain read_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'readAsync')) {
  Object.defineProperty(Module, 'readAsync', {
    configurable: true,
    get: function() {
      abort('Module.readAsync has been replaced with plain readAsync (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'readBinary')) {
  Object.defineProperty(Module, 'readBinary', {
    configurable: true,
    get: function() {
      abort('Module.readBinary has been replaced with plain readBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'setWindowTitle')) {
  Object.defineProperty(Module, 'setWindowTitle', {
    configurable: true,
    get: function() {
      abort('Module.setWindowTitle has been replaced with plain setWindowTitle (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';
function alignMemory() { abort('`alignMemory` is now a library function and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line'); }

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add 'shell' to `-s ENVIRONMENT` to enable.");




var STACK_ALIGN = 16;

function getPointerSize() {
  return 4;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return getPointerSize();
      } else if (type[0] === 'i') {
        var bits = Number(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

// include: runtime_functions.js


// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {

  // If the type reflection proposal is available, use the new
  // "WebAssembly.Function" constructor.
  // Otherwise, construct a minimal wasm module importing the JS function and
  // re-exporting it.
  if (typeof WebAssembly.Function === "function") {
    var typeNames = {
      'i': 'i32',
      'j': 'i64',
      'f': 'f32',
      'd': 'f64'
    };
    var type = {
      parameters: [],
      results: sig[0] == 'v' ? [] : [typeNames[sig[0]]]
    };
    for (var i = 1; i < sig.length; ++i) {
      type.parameters.push(typeNames[sig[i]]);
    }
    return new WebAssembly.Function(type, func);
  }

  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  var typeSection = [
    0x01, // id: section,
    0x00, // length: 0 (placeholder)
    0x01, // count: 1
    0x60, // form: func
  ];
  var sigRet = sig.slice(0, 1);
  var sigParam = sig.slice(1);
  var typeCodes = {
    'i': 0x7f, // i32
    'j': 0x7e, // i64
    'f': 0x7d, // f32
    'd': 0x7c, // f64
  };

  // Parameters, length + signatures
  typeSection.push(sigParam.length);
  for (var i = 0; i < sigParam.length; ++i) {
    typeSection.push(typeCodes[sigParam[i]]);
  }

  // Return values, length + signatures
  // With no multi-return in MVP, either 0 (void) or 1 (anything else)
  if (sigRet == 'v') {
    typeSection.push(0x00);
  } else {
    typeSection = typeSection.concat([0x01, typeCodes[sigRet]]);
  }

  // Write the overall length of the type section back into the section header
  // (excepting the 2 bytes for the section id and length)
  typeSection[1] = typeSection.length - 2;

  // Rest of the module is static
  var bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // magic ("\0asm")
    0x01, 0x00, 0x00, 0x00, // version: 1
  ].concat(typeSection, [
    0x02, 0x07, // import section
      // (import "e" "f" (func 0 (type 0)))
      0x01, 0x01, 0x65, 0x01, 0x66, 0x00, 0x00,
    0x07, 0x05, // export section
      // (export "f" (func 0 (type 0)))
      0x01, 0x01, 0x66, 0x00, 0x00,
  ]));

   // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    'e': {
      'f': func
    }
  });
  var wrappedFunc = instance.exports['f'];
  return wrappedFunc;
}

var freeTableIndexes = [];

// Weak map of functions in the table to their indexes, created on first use.
var functionsInTableMap;

function getEmptyTableSlot() {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  try {
    wasmTable.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
  }
  return wasmTable.length - 1;
}

function updateTableMap(offset, count) {
  for (var i = offset; i < offset + count; i++) {
    var item = getWasmTableEntry(i);
    // Ignore null values.
    if (item) {
      functionsInTableMap.set(item, i);
    }
  }
}

// Add a function to the table.
// 'sig' parameter is required if the function being added is a JS function.
function addFunction(func, sig) {
  assert(typeof func !== 'undefined');

  // Check if the function is already in the table, to ensure each function
  // gets a unique index. First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap();
    updateTableMap(0, wasmTable.length);
  }
  if (functionsInTableMap.has(func)) {
    return functionsInTableMap.get(func);
  }

  // It's not in the table, add it now.

  var ret = getEmptyTableSlot();

  // Set the new value.
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    setWasmTableEntry(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction: ' + func);
    var wrapped = convertJsFunctionToWasm(func, sig);
    setWasmTableEntry(ret, wrapped);
  }

  functionsInTableMap.set(func, ret);

  return ret;
}

function removeFunction(index) {
  functionsInTableMap.delete(getWasmTableEntry(index));
  freeTableIndexes.push(index);
}

// end include: runtime_functions.js
// include: runtime_debug.js


// end include: runtime_debug.js
var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
if (!Object.getOwnPropertyDescriptor(Module, 'wasmBinary')) {
  Object.defineProperty(Module, 'wasmBinary', {
    configurable: true,
    get: function() {
      abort('Module.wasmBinary has been replaced with plain wasmBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}
var noExitRuntime = Module['noExitRuntime'] || true;
if (!Object.getOwnPropertyDescriptor(Module, 'noExitRuntime')) {
  Object.defineProperty(Module, 'noExitRuntime', {
    configurable: true,
    get: function() {
      abort('Module.noExitRuntime has been replaced with plain noExitRuntime (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (typeof WebAssembly !== 'object') {
  abort('no native wasm support detected');
}

// include: runtime_safe_heap.js


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @param {number} ptr
    @param {number} value
    @param {string} type
    @param {number|boolean=} noSafe */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32';
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)] = tempI64[0],HEAP32[(((ptr)+(4))>>2)] = tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @param {number} ptr
    @param {string} type
    @param {number|boolean=} noSafe */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32';
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return Number(HEAPF64[((ptr)>>3)]);
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

// end include: runtime_safe_heap.js
// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
/** @param {string|null=} returnType
    @param {Array=} argTypes
    @param {Arguments|Array=} args
    @param {Object=} opts */
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  function onDone(ret) {
    if (stack !== 0) stackRestore(stack);
    return convertReturnValue(ret);
  }

  ret = onDone(ret);
  return ret;
}

/** @param {string=} returnType
    @param {Array=} argTypes
    @param {Object=} opts */
function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((Uint8Array|Array<number>), number)} */
function allocate(slab, allocator) {
  var ret;
  assert(typeof allocator === 'number', 'allocate no longer takes a type argument')
  assert(typeof slab !== 'number', 'allocate no longer takes a number as arg0')

  if (allocator == ALLOC_STACK) {
    ret = stackAlloc(slab.length);
  } else {
    ret = _malloc(slab.length);
  }

  if (slab.subarray || slab.slice) {
    HEAPU8.set(/** @type {!Uint8Array} */(slab), ret);
  } else {
    HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
}

// include: runtime_strings.js


// runtime_strings.js: Strings related runtime functions that are part of both MINIMAL_RUNTIME and regular runtime.

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(heap.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = heap[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = heap[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = heap[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  ;
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   heap: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 0xC0 | (u >> 6);
      heap[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 0xE0 | (u >> 12);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u > 0x10FFFF) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
      heap[outIdx++] = 0xF0 | (u >> 18);
      heap[outIdx++] = 0x80 | ((u >> 12) & 63);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}

// end include: runtime_strings.js
// include: runtime_strings_extra.js


// runtime_strings_extra.js: Strings related runtime functions that are available only in regular runtime.

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;

function UTF16ToString(ptr, maxBytesToRead) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  var maxIdx = idx + maxBytesToRead / 2;
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var str = '';

    // If maxBytesToRead is not passed explicitly, it will be undefined, and the for-loop's condition
    // will always evaluate to true. The loop is then terminated on the first null char.
    for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) break;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }

    return str;
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)] = codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr, maxBytesToRead) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(i >= maxBytesToRead / 4)) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0) break;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
  return str;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated
    @param {boolean=} dontAddNull */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

/** @param {boolean=} dontAddNull */
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === (str.charCodeAt(i) & 0xff));
    HEAP8[((buffer++)>>0)] = str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)] = 0;
}

// end include: runtime_strings_extra.js
// Memory management

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216;
if (!Object.getOwnPropertyDescriptor(Module, 'INITIAL_MEMORY')) {
  Object.defineProperty(Module, 'INITIAL_MEMORY', {
    configurable: true,
    get: function() {
      abort('Module.INITIAL_MEMORY has been replaced with plain INITIAL_MEMORY (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

assert(INITIAL_MEMORY >= TOTAL_STACK, 'INITIAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');

// If memory is defined in wasm, the user can't provide it.
assert(!Module['wasmMemory'], 'Use of `wasmMemory` detected.  Use -s IMPORTED_MEMORY to define wasmMemory externally');
assert(INITIAL_MEMORY == 16777216, 'Detected runtime INITIAL_MEMORY setting.  Use -s IMPORTED_MEMORY to define wasmMemory dynamically');

// include: runtime_init_table.js
// In regular non-RELOCATABLE mode the table is exported
// from the wasm module and this will be assigned once
// the exports are available.
var wasmTable;

// end include: runtime_init_table.js
// include: runtime_stack_check.js


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // The stack grows downwards
  HEAP32[((max + 4)>>2)] = 0x2135467
  HEAP32[((max + 8)>>2)] = 0x89BACDFE
  // Also test the global address 0 for integrity.
  HEAP32[0] = 0x63736d65; /* 'emsc' */
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  var cookie1 = HEAPU32[((max + 4)>>2)];
  var cookie2 = HEAPU32[((max + 8)>>2)];
  if (cookie1 != 0x2135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x' + cookie2.toString(16) + ' ' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

// end include: runtime_stack_check.js
// include: runtime_assertions.js


// Endianness check
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian! (Run with -s SUPPORT_BIG_ENDIAN=1 to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;
var runtimeKeepaliveCounter = 0;

function keepRuntimeAlive() {
  return noExitRuntime || runtimeKeepaliveCounter > 0;
}

function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  
  callRuntimeCallbacks(__ATINIT__);
}

function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data

/** @param {string|number=} what */
function abort(what) {
  {
    if (Module['onAbort']) {
      Module['onAbort'](what);
    }
  }

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// {{MEM_INITIALIZER}}

// include: memoryprofiler.js


// end include: memoryprofiler.js
// show errors on likely calls to FS when it was not included
var FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

// include: URIUtils.js


// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  // Prefix of data URIs emitted by SINGLE_FILE and related options.
  return filename.startsWith(dataURIPrefix);
}

// Indicates whether filename is delivered via file protocol (as opposed to http/https)
function isFileURI(filename) {
  return filename.startsWith('file://');
}

// end include: URIUtils.js
function createExportWrapper(name, fixedasm) {
  return function() {
    var displayName = name;
    var asm = fixedasm;
    if (!fixedasm) {
      asm = Module['asm'];
    }
    assert(runtimeInitialized, 'native function `' + displayName + '` called before runtime initialization');
    assert(!runtimeExited, 'native function `' + displayName + '` called after runtime exit (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
    if (!asm[name]) {
      assert(asm[name], 'exported native function `' + displayName + '` not found');
    }
    return asm[name].apply(null, arguments);
  };
}

var wasmBinaryFile;
  wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB6YCAgAARYAN/f38AYAF/AGACf38AYAJ/fwF/YAF/AX9gA39/fwF/YAABf2AEf39/fwBgBX9/f39/AX9gAABgBH9/f38Bf2AHf39/f39/fwBgAX4Bf2AFf39/f38AYAF/AX5gAn9+AGADf35/AX4CxYCAgAADA2VudgRleGl0AAEDZW52FmVtc2NyaXB0ZW5fcmVzaXplX2hlYXAABANlbnYVZW1zY3JpcHRlbl9tZW1jcHlfYmlnAAUD/ICAgAB7CQEBAAALCwcKAQEAAAEBAQAAAAUAAwAKAAoAAgICAgICAgICAgIAAAAAAQABAQADAAEBAAABAQEAAwAABQACDAQEAwMDAwUDCAgICAMAAAEBAAcBAQAABwEBAAEAAQ0OBw8AAAEHAwYEAQYEBQYBBAkGBgQBAQEGCQQEBIWAgIAAAXABAQEFhoCAgAABAYACgAIGk4CAgAADfwFB0JXAAgt/AUEAC38BQQALB4mEgIAAFAZtZW1vcnkCABFfX3dhc21fY2FsbF9jdG9ycwADLFBRQ0xFQU5fRElMSVRISVVNM19DTEVBTl9jcnlwdG9fc2lnbl9rZXlwYWlyAEkzUFFDTEVBTl9ESUxJVEhJVU0zX0NMRUFOX2NyeXB0b19zaWduX2tleXBhaXJfcmFuZG9tAEouUFFDTEVBTl9ESUxJVEhJVU0zX0NMRUFOX2NyeXB0b19zaWduX3NpZ25hdHVyZQBLJFBRQ0xFQU5fRElMSVRISVVNM19DTEVBTl9jcnlwdG9fc2lnbgBMK1BRQ0xFQU5fRElMSVRISVVNM19DTEVBTl9jcnlwdG9fc2lnbl92ZXJpZnkATSlQUUNMRUFOX0RJTElUSElVTTNfQ0xFQU5fY3J5cHRvX3NpZ25fb3BlbgBOEmNyeXB0b19wcml2X3RvX3B1YgBPGV9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUBAAZtYWxsb2MAawRmcmVlAGwGZmZsdXNoAHwQX19lcnJub19sb2NhdGlvbgBqCXN0YWNrU2F2ZQBwDHN0YWNrUmVzdG9yZQBxCnN0YWNrQWxsb2MAchVlbXNjcmlwdGVuX3N0YWNrX2luaXQAcxllbXNjcmlwdGVuX3N0YWNrX2dldF9mcmVlAHQYZW1zY3JpcHRlbl9zdGFja19nZXRfZW5kAHUK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';
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }

function getBinary(file) {
  try {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    var binary = tryParseAsDataURI(file);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(file);
    } else {
      throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // If we don't have the binary yet, try to to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch === 'function'
      && !isFileURI(wasmBinaryFile)
    ) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
          return getBinary(wasmBinaryFile);
      });
    }
    else {
      if (readAsync) {
        // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
        return new Promise(function(resolve, reject) {
          readAsync(wasmBinaryFile, function(response) { resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))) }, reject)
        });
      }
    }
  }

  // Otherwise, getBinary should be able to get it synchronously
  return Promise.resolve().then(function() { return getBinary(wasmBinaryFile); });
}

function instantiateSync(file, info) {
  var instance;
  var module;
  var binary;
  try {
    binary = getBinary(file);
    module = new WebAssembly.Module(binary);
    instance = new WebAssembly.instantiate(module, info);
  } catch (e) {
    var str = e.toString();
    err('failed to compile wasm module: ' + str);
    if (str.includes('imported Memory') ||
        str.includes('memory import')) {
      err('Memory size incompatibility issues may be due to changing INITIAL_MEMORY at runtime to something too large. Use ALLOW_MEMORY_GROWTH to allow any size memory (and also make sure not to set INITIAL_MEMORY at runtime to something smaller than it was at compile time).');
    }
    throw e;
  }
  return [instance, module];
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    var exports = instance.exports;

    Module['asm'] = exports;

    wasmMemory = Module['asm']['memory'];
    assert(wasmMemory, "memory not found in wasm exports");
    // This assertion doesn't hold when emscripten is run in --post-link
    // mode.
    // TODO(sbc): Read INITIAL_MEMORY out of the wasm file in post-link mode.
    //assert(wasmMemory.buffer.byteLength === 16777216);
    updateGlobalBufferAndViews(wasmMemory.buffer);

    wasmTable = Module['asm']['__indirect_function_table'];
    assert(wasmTable, "table not found in wasm exports");

    addOnInit(Module['asm']['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
  }
  // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  var result = instantiateSync(wasmBinaryFile, info);
  // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193,
  // the above line no longer optimizes out down to the following line.
  // When the regression is fixed, we can remove this if/else.
  receiveInstance(result[0]);
  return Module['asm']; // exports were assigned here
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  
};






  function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
          callback(Module); // Pass the module as the first argument.
          continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            getWasmTableEntry(func)();
          } else {
            getWasmTableEntry(func)(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

  function withStackSave(f) {
      var stack = stackSave();
      var ret = f();
      stackRestore(stack);
      return ret;
    }
  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  var wasmTableMirror = [];
  function getWasmTableEntry(funcPtr) {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      assert(wasmTable.get(funcPtr) == func, "JavaScript-side Wasm function table mirror is out of date!");
      return func;
    }

  function handleException(e) {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS;
      }
      quit_(1, e);
    }

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }

  function setWasmTableEntry(idx, func) {
      wasmTable.set(idx, func);
      wasmTableMirror[idx] = func;
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s INITIAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }
  function _emscripten_resize_heap(requestedSize) {
      var oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      abortOnCannotGrowMemory(requestedSize);
    }

  function _exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      exit(status);
    }
var ASSERTIONS = true;



/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {string} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf = Buffer.from(s, 'base64');
    return new Uint8Array(buf['buffer'], buf['byteOffset'], buf['byteLength']);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


var asmLibraryArg = {
  "emscripten_memcpy_big": _emscripten_memcpy_big,
  "emscripten_resize_heap": _emscripten_resize_heap,
  "exit": _exit
};
var asm = createWasm();
/** @type {function(...*):?} */
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = createExportWrapper("__wasm_call_ctors", asm);

/** @type {function(...*):?} */
var _PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_keypair = Module["_PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_keypair"] = createExportWrapper("PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_keypair", asm);

/** @type {function(...*):?} */
var _PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_keypair_random = Module["_PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_keypair_random"] = createExportWrapper("PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_keypair_random", asm);

/** @type {function(...*):?} */
var _PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_signature = Module["_PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_signature"] = createExportWrapper("PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_signature", asm);

/** @type {function(...*):?} */
var _PQCLEAN_DILITHIUM3_CLEAN_crypto_sign = Module["_PQCLEAN_DILITHIUM3_CLEAN_crypto_sign"] = createExportWrapper("PQCLEAN_DILITHIUM3_CLEAN_crypto_sign", asm);

/** @type {function(...*):?} */
var _PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_verify = Module["_PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_verify"] = createExportWrapper("PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_verify", asm);

/** @type {function(...*):?} */
var _PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_open = Module["_PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_open"] = createExportWrapper("PQCLEAN_DILITHIUM3_CLEAN_crypto_sign_open", asm);

/** @type {function(...*):?} */
var _crypto_priv_to_pub = Module["_crypto_priv_to_pub"] = createExportWrapper("crypto_priv_to_pub", asm);

/** @type {function(...*):?} */
var _malloc = Module["_malloc"] = createExportWrapper("malloc", asm);

/** @type {function(...*):?} */
var _free = Module["_free"] = createExportWrapper("free", asm);

/** @type {function(...*):?} */
var _fflush = Module["_fflush"] = createExportWrapper("fflush", asm);

/** @type {function(...*):?} */
var ___errno_location = Module["___errno_location"] = createExportWrapper("__errno_location", asm);

/** @type {function(...*):?} */
var stackSave = Module["stackSave"] = createExportWrapper("stackSave", asm);

/** @type {function(...*):?} */
var stackRestore = Module["stackRestore"] = createExportWrapper("stackRestore", asm);

/** @type {function(...*):?} */
var stackAlloc = Module["stackAlloc"] = createExportWrapper("stackAlloc", asm);

/** @type {function(...*):?} */
var _emscripten_stack_init = Module["_emscripten_stack_init"] = asm["emscripten_stack_init"]

/** @type {function(...*):?} */
var _emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = asm["emscripten_stack_get_free"]

/** @type {function(...*):?} */
var _emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = asm["emscripten_stack_get_end"]





// === Auto-generated postamble setup entry stuff ===

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getValue")) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocate")) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addFunction")) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "removeFunction")) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callMain")) Module["callMain"] = function() { abort("'callMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abort")) Module["abort"] = function() { abort("'abort' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "keepRuntimeAlive")) Module["keepRuntimeAlive"] = function() { abort("'keepRuntimeAlive' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "zeroMemory")) Module["zeroMemory"] = function() { abort("'zeroMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToNewUTF8")) Module["stringToNewUTF8"] = function() { abort("'stringToNewUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setFileTime")) Module["setFileTime"] = function() { abort("'setFileTime' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abortOnCannotGrowMemory")) Module["abortOnCannotGrowMemory"] = function() { abort("'abortOnCannotGrowMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscripten_realloc_buffer")) Module["emscripten_realloc_buffer"] = function() { abort("'emscripten_realloc_buffer' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "withStackSave")) Module["withStackSave"] = function() { abort("'withStackSave' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_CODES")) Module["ERRNO_CODES"] = function() { abort("'ERRNO_CODES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_MESSAGES")) Module["ERRNO_MESSAGES"] = function() { abort("'ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setErrNo")) Module["setErrNo"] = function() { abort("'setErrNo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton4")) Module["inetPton4"] = function() { abort("'inetPton4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop4")) Module["inetNtop4"] = function() { abort("'inetNtop4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton6")) Module["inetPton6"] = function() { abort("'inetPton6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop6")) Module["inetNtop6"] = function() { abort("'inetNtop6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readSockaddr")) Module["readSockaddr"] = function() { abort("'readSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeSockaddr")) Module["writeSockaddr"] = function() { abort("'writeSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "DNS")) Module["DNS"] = function() { abort("'DNS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getHostByName")) Module["getHostByName"] = function() { abort("'getHostByName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GAI_ERRNO_MESSAGES")) Module["GAI_ERRNO_MESSAGES"] = function() { abort("'GAI_ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Protocols")) Module["Protocols"] = function() { abort("'Protocols' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Sockets")) Module["Sockets"] = function() { abort("'Sockets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getRandomDevice")) Module["getRandomDevice"] = function() { abort("'getRandomDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "traverseStack")) Module["traverseStack"] = function() { abort("'traverseStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UNWIND_CACHE")) Module["UNWIND_CACHE"] = function() { abort("'UNWIND_CACHE' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgsArray")) Module["readAsmConstArgsArray"] = function() { abort("'readAsmConstArgsArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgs")) Module["readAsmConstArgs"] = function() { abort("'readAsmConstArgs' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mainThreadEM_ASM")) Module["mainThreadEM_ASM"] = function() { abort("'mainThreadEM_ASM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_q")) Module["jstoi_q"] = function() { abort("'jstoi_q' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_s")) Module["jstoi_s"] = function() { abort("'jstoi_s' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getExecutableName")) Module["getExecutableName"] = function() { abort("'getExecutableName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "listenOnce")) Module["listenOnce"] = function() { abort("'listenOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "autoResumeAudioContext")) Module["autoResumeAudioContext"] = function() { abort("'autoResumeAudioContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCallLegacy")) Module["dynCallLegacy"] = function() { abort("'dynCallLegacy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getDynCaller")) Module["getDynCaller"] = function() { abort("'getDynCaller' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callRuntimeCallbacks")) Module["callRuntimeCallbacks"] = function() { abort("'callRuntimeCallbacks' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "wasmTableMirror")) Module["wasmTableMirror"] = function() { abort("'wasmTableMirror' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setWasmTableEntry")) Module["setWasmTableEntry"] = function() { abort("'setWasmTableEntry' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getWasmTableEntry")) Module["getWasmTableEntry"] = function() { abort("'getWasmTableEntry' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "handleException")) Module["handleException"] = function() { abort("'handleException' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePush")) Module["runtimeKeepalivePush"] = function() { abort("'runtimeKeepalivePush' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePop")) Module["runtimeKeepalivePop"] = function() { abort("'runtimeKeepalivePop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callUserCallback")) Module["callUserCallback"] = function() { abort("'callUserCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeExit")) Module["maybeExit"] = function() { abort("'maybeExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "safeSetTimeout")) Module["safeSetTimeout"] = function() { abort("'safeSetTimeout' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "asmjsMangle")) Module["asmjsMangle"] = function() { abort("'asmjsMangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "asyncLoad")) Module["asyncLoad"] = function() { abort("'asyncLoad' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignMemory")) Module["alignMemory"] = function() { abort("'alignMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mmapAlloc")) Module["mmapAlloc"] = function() { abort("'mmapAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reallyNegative")) Module["reallyNegative"] = function() { abort("'reallyNegative' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "unSign")) Module["unSign"] = function() { abort("'unSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reSign")) Module["reSign"] = function() { abort("'reSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "formatString")) Module["formatString"] = function() { abort("'formatString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH")) Module["PATH"] = function() { abort("'PATH' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH_FS")) Module["PATH_FS"] = function() { abort("'PATH_FS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SYSCALLS")) Module["SYSCALLS"] = function() { abort("'SYSCALLS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMmap2")) Module["syscallMmap2"] = function() { abort("'syscallMmap2' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMunmap")) Module["syscallMunmap"] = function() { abort("'syscallMunmap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketFromFD")) Module["getSocketFromFD"] = function() { abort("'getSocketFromFD' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketAddress")) Module["getSocketAddress"] = function() { abort("'getSocketAddress' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "JSEvents")) Module["JSEvents"] = function() { abort("'JSEvents' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerKeyEventCallback")) Module["registerKeyEventCallback"] = function() { abort("'registerKeyEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "specialHTMLTargets")) Module["specialHTMLTargets"] = function() { abort("'specialHTMLTargets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeCStringToJsString")) Module["maybeCStringToJsString"] = function() { abort("'maybeCStringToJsString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findEventTarget")) Module["findEventTarget"] = function() { abort("'findEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findCanvasEventTarget")) Module["findCanvasEventTarget"] = function() { abort("'findCanvasEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getBoundingClientRect")) Module["getBoundingClientRect"] = function() { abort("'getBoundingClientRect' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillMouseEventData")) Module["fillMouseEventData"] = function() { abort("'fillMouseEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerMouseEventCallback")) Module["registerMouseEventCallback"] = function() { abort("'registerMouseEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerWheelEventCallback")) Module["registerWheelEventCallback"] = function() { abort("'registerWheelEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerUiEventCallback")) Module["registerUiEventCallback"] = function() { abort("'registerUiEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFocusEventCallback")) Module["registerFocusEventCallback"] = function() { abort("'registerFocusEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceOrientationEventData")) Module["fillDeviceOrientationEventData"] = function() { abort("'fillDeviceOrientationEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceOrientationEventCallback")) Module["registerDeviceOrientationEventCallback"] = function() { abort("'registerDeviceOrientationEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceMotionEventData")) Module["fillDeviceMotionEventData"] = function() { abort("'fillDeviceMotionEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceMotionEventCallback")) Module["registerDeviceMotionEventCallback"] = function() { abort("'registerDeviceMotionEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "screenOrientation")) Module["screenOrientation"] = function() { abort("'screenOrientation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillOrientationChangeEventData")) Module["fillOrientationChangeEventData"] = function() { abort("'fillOrientationChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerOrientationChangeEventCallback")) Module["registerOrientationChangeEventCallback"] = function() { abort("'registerOrientationChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillFullscreenChangeEventData")) Module["fillFullscreenChangeEventData"] = function() { abort("'fillFullscreenChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFullscreenChangeEventCallback")) Module["registerFullscreenChangeEventCallback"] = function() { abort("'registerFullscreenChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerRestoreOldStyle")) Module["registerRestoreOldStyle"] = function() { abort("'registerRestoreOldStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "hideEverythingExceptGivenElement")) Module["hideEverythingExceptGivenElement"] = function() { abort("'hideEverythingExceptGivenElement' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreHiddenElements")) Module["restoreHiddenElements"] = function() { abort("'restoreHiddenElements' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setLetterbox")) Module["setLetterbox"] = function() { abort("'setLetterbox' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "currentFullscreenStrategy")) Module["currentFullscreenStrategy"] = function() { abort("'currentFullscreenStrategy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreOldWindowedStyle")) Module["restoreOldWindowedStyle"] = function() { abort("'restoreOldWindowedStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "softFullscreenResizeWebGLRenderTarget")) Module["softFullscreenResizeWebGLRenderTarget"] = function() { abort("'softFullscreenResizeWebGLRenderTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "doRequestFullscreen")) Module["doRequestFullscreen"] = function() { abort("'doRequestFullscreen' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillPointerlockChangeEventData")) Module["fillPointerlockChangeEventData"] = function() { abort("'fillPointerlockChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockChangeEventCallback")) Module["registerPointerlockChangeEventCallback"] = function() { abort("'registerPointerlockChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockErrorEventCallback")) Module["registerPointerlockErrorEventCallback"] = function() { abort("'registerPointerlockErrorEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "requestPointerLock")) Module["requestPointerLock"] = function() { abort("'requestPointerLock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillVisibilityChangeEventData")) Module["fillVisibilityChangeEventData"] = function() { abort("'fillVisibilityChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerVisibilityChangeEventCallback")) Module["registerVisibilityChangeEventCallback"] = function() { abort("'registerVisibilityChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerTouchEventCallback")) Module["registerTouchEventCallback"] = function() { abort("'registerTouchEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillGamepadEventData")) Module["fillGamepadEventData"] = function() { abort("'fillGamepadEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerGamepadEventCallback")) Module["registerGamepadEventCallback"] = function() { abort("'registerGamepadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBeforeUnloadEventCallback")) Module["registerBeforeUnloadEventCallback"] = function() { abort("'registerBeforeUnloadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillBatteryEventData")) Module["fillBatteryEventData"] = function() { abort("'fillBatteryEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "battery")) Module["battery"] = function() { abort("'battery' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBatteryEventCallback")) Module["registerBatteryEventCallback"] = function() { abort("'registerBatteryEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setCanvasElementSize")) Module["setCanvasElementSize"] = function() { abort("'setCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCanvasElementSize")) Module["getCanvasElementSize"] = function() { abort("'getCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangle")) Module["demangle"] = function() { abort("'demangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangleAll")) Module["demangleAll"] = function() { abort("'demangleAll' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jsStackTrace")) Module["jsStackTrace"] = function() { abort("'jsStackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getEnvStrings")) Module["getEnvStrings"] = function() { abort("'getEnvStrings' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "checkWasiClock")) Module["checkWasiClock"] = function() { abort("'checkWasiClock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "flush_NO_FILESYSTEM")) Module["flush_NO_FILESYSTEM"] = function() { abort("'flush_NO_FILESYSTEM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64")) Module["writeI53ToI64"] = function() { abort("'writeI53ToI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Clamped")) Module["writeI53ToI64Clamped"] = function() { abort("'writeI53ToI64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Signaling")) Module["writeI53ToI64Signaling"] = function() { abort("'writeI53ToI64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Clamped")) Module["writeI53ToU64Clamped"] = function() { abort("'writeI53ToU64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Signaling")) Module["writeI53ToU64Signaling"] = function() { abort("'writeI53ToU64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromI64")) Module["readI53FromI64"] = function() { abort("'readI53FromI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromU64")) Module["readI53FromU64"] = function() { abort("'readI53FromU64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertI32PairToI53")) Module["convertI32PairToI53"] = function() { abort("'convertI32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertU32PairToI53")) Module["convertU32PairToI53"] = function() { abort("'convertU32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setImmediateWrapped")) Module["setImmediateWrapped"] = function() { abort("'setImmediateWrapped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "clearImmediateWrapped")) Module["clearImmediateWrapped"] = function() { abort("'clearImmediateWrapped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "polyfillSetImmediate")) Module["polyfillSetImmediate"] = function() { abort("'polyfillSetImmediate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "uncaughtExceptionCount")) Module["uncaughtExceptionCount"] = function() { abort("'uncaughtExceptionCount' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionLast")) Module["exceptionLast"] = function() { abort("'exceptionLast' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionCaught")) Module["exceptionCaught"] = function() { abort("'exceptionCaught' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ExceptionInfo")) Module["ExceptionInfo"] = function() { abort("'ExceptionInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "CatchInfo")) Module["CatchInfo"] = function() { abort("'CatchInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_addRef")) Module["exception_addRef"] = function() { abort("'exception_addRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_decRef")) Module["exception_decRef"] = function() { abort("'exception_decRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Browser")) Module["Browser"] = function() { abort("'Browser' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "funcWrappers")) Module["funcWrappers"] = function() { abort("'funcWrappers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setMainLoop")) Module["setMainLoop"] = function() { abort("'setMainLoop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "wget")) Module["wget"] = function() { abort("'wget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS")) Module["FS"] = function() { abort("'FS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "MEMFS")) Module["MEMFS"] = function() { abort("'MEMFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "TTY")) Module["TTY"] = function() { abort("'TTY' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PIPEFS")) Module["PIPEFS"] = function() { abort("'PIPEFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SOCKFS")) Module["SOCKFS"] = function() { abort("'SOCKFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "_setNetworkCallback")) Module["_setNetworkCallback"] = function() { abort("'_setNetworkCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tempFixedLengthArray")) Module["tempFixedLengthArray"] = function() { abort("'tempFixedLengthArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "miniTempWebGLFloatBuffers")) Module["miniTempWebGLFloatBuffers"] = function() { abort("'miniTempWebGLFloatBuffers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapObjectForWebGLType")) Module["heapObjectForWebGLType"] = function() { abort("'heapObjectForWebGLType' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapAccessShiftForWebGLHeap")) Module["heapAccessShiftForWebGLHeap"] = function() { abort("'heapAccessShiftForWebGLHeap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGet")) Module["emscriptenWebGLGet"] = function() { abort("'emscriptenWebGLGet' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "computeUnpackAlignedImageSize")) Module["computeUnpackAlignedImageSize"] = function() { abort("'computeUnpackAlignedImageSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetTexPixelData")) Module["emscriptenWebGLGetTexPixelData"] = function() { abort("'emscriptenWebGLGetTexPixelData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetUniform")) Module["emscriptenWebGLGetUniform"] = function() { abort("'emscriptenWebGLGetUniform' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetUniformLocation")) Module["webglGetUniformLocation"] = function() { abort("'webglGetUniformLocation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglPrepareUniformLocationsBeforeFirstUse")) Module["webglPrepareUniformLocationsBeforeFirstUse"] = function() { abort("'webglPrepareUniformLocationsBeforeFirstUse' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetLeftBracePos")) Module["webglGetLeftBracePos"] = function() { abort("'webglGetLeftBracePos' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetVertexAttrib")) Module["emscriptenWebGLGetVertexAttrib"] = function() { abort("'emscriptenWebGLGetVertexAttrib' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeGLArray")) Module["writeGLArray"] = function() { abort("'writeGLArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AL")) Module["AL"] = function() { abort("'AL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_unicode")) Module["SDL_unicode"] = function() { abort("'SDL_unicode' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_ttfContext")) Module["SDL_ttfContext"] = function() { abort("'SDL_ttfContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_audio")) Module["SDL_audio"] = function() { abort("'SDL_audio' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL")) Module["SDL"] = function() { abort("'SDL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_gfx")) Module["SDL_gfx"] = function() { abort("'SDL_gfx' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLUT")) Module["GLUT"] = function() { abort("'GLUT' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "EGL")) Module["EGL"] = function() { abort("'EGL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW_Window")) Module["GLFW_Window"] = function() { abort("'GLFW_Window' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW")) Module["GLFW"] = function() { abort("'GLFW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLEW")) Module["GLEW"] = function() { abort("'GLEW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "IDBStore")) Module["IDBStore"] = function() { abort("'IDBStore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runAndAbortIfError")) Module["runAndAbortIfError"] = function() { abort("'runAndAbortIfError' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8OnStack")) Module["allocateUTF8OnStack"] = function() { abort("'allocateUTF8OnStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["writeStackCookie"] = writeStackCookie;
Module["checkStackCookie"] = checkStackCookie;
if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromBase64")) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tryParseAsDataURI")) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { configurable: true, get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { configurable: true, get: function() { abort("'ALLOC_STACK' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

var calledRun;

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  _emscripten_stack_init();
  writeStackCookie();
}

/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  stackCheckInit();

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = null;
    if (flush) flush();
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

/** @param {boolean|number=} implicit */
function exit(status, implicit) {
  EXITSTATUS = status;

  checkUnflushedContent();

  if (keepRuntimeAlive()) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      var msg = 'program exited (with status: ' + status + '), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)';
      err(msg);
    }
  } else {
    exitRuntime();
  }

  procExit(status);
}

function procExit(code) {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    if (Module['onExit']) Module['onExit'](code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

run();





