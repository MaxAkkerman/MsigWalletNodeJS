const { loadContract } = require ( "utils");

module.exports = {
    MultisigContract: loadContract("safemultisig/SafeMultisigWallet"),
};
