export interface MyBindings {
    generateKeypair: (arg1: Uint8Array) => Uint8Array;
}

var ArlDilithium: MyBindings = require('arl-dilithium');
export default ArlDilithium;