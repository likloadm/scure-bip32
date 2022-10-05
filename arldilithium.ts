export interface MyBindings {
    generateKeypair: (arg1: Uint8Array) => Uint8Array;
}
// Load it with require
var ArlDilithium: MyBindings = require('@liklo/arl-dilithium');
export default ArlDilithium;