const { libNode } = require("@tonclient/lib-node");
const { Account } = require("@tonclient/appkit");
const {
    signerKeys,
    TonClient,
} = require("@tonclient/core");
TonClient.useBinaryLibrary(libNode);
const ACCOUNT_TYPE_ACTIVE = 1;
const ACCOUNT_TYPE_UNINITIALIZED = 0;
const CONTRACT_REQUIRED_DEPLOY_TOKENS = 500000000;
const SEED_PHRASE_WORD_COUNT = 12; //Mnemonic word count
const SEED_PHRASE_DICTIONARY_ENGLISH = 1; //Dictionary identifier
const HD_PATH = "m/44'/396'/0'/0/0";
const DappServer = "net.ton.dev"
const _db = require('./mongoDB.js')
const client = new TonClient({ network: { endpoints: [DappServer] } });

// TonClient.useBinaryLibrary(libNode);
function UserException(message) {
    this.message = message;
    this.name = "UserExeption";
}
let deployWallet = async function(val) {
    console.log("Start deploying")
    let userData = val[1]
    let msigImage = val[0]
    // const client = new TonClient({ network: { endpoints: [DappServer] } });
    try {
        const keyPair = JSON.parse(userData.keys);
        const acc = new Account(msigImage.data, {
            signer: signerKeys(keyPair),
            client
        });

        const address = await acc.getAddress();
        let info;
        try {
            info = await acc.getAccount();
        } catch (err) {
            console.log(`Account with address ${address} isn't exist`)
            throw new UserException(`Account with address ${address} isn't exist`);
        }
        if (info.acc_type === ACCOUNT_TYPE_ACTIVE) {
            console.log(`Account with address ${address} is already deployed`)
            throw new UserException(`Account with address ${address} is already deployed`);
        }
        if (info.acc_type === ACCOUNT_TYPE_UNINITIALIZED && BigInt(info.balance) <= BigInt(CONTRACT_REQUIRED_DEPLOY_TOKENS)) {
            console.log(`Balance of ${address} is too low for deploy to net.ton.dev`)
            throw new UserException(`Balance of ${address} is too low for deploy to net.ton.dev`);
        }

        const response = await acc.deploy({
            initInput: {
                owners: [`0x${keyPair.public}`],
                reqConfirms: 0,
            },
        });
        console.log("responce",response)
        if(!response){
            console.log("response",response)
            throw new UserException(`Something wrong with deploying`);
        }

        return [address, response.transaction.id]
    } catch (error) {
        throw [error.name, error.message]
    }
};
let getBalance = async function(address) {
    // const client = new TonClient({ network: { endpoints: [DappServer] } });
    try {
        console.log("address data", address);
        const batchQueryResult = (await client.net.batch_query({
            "operations": [
                {
                    type: "QueryCollection",
                    collection: "accounts",
                    filter: {
                        id: {
                            eq: address,
                        },
                    },
                    result: "balance",
                }],
        })).results;
        if(!batchQueryResult[0][0]){
            console.log("no such client")
            throw new UserException(`Такого аккаунта не существует`);
        }else {
            let yourNumber = parseInt(batchQueryResult[0][0].balance, 16);
            console.log("Balance of wallet 1 is " + yourNumber + " grams");
            return {"address": address, "balance": yourNumber}
        }

    } catch (error) {
        console.error(error);
        throw [error.name, error.message]
    }
};
async function sendMoney(acc, toAddress, amount) {
    await acc.run("sendTransaction", {
        dest: toAddress,
        value: amount,
        bounce: false,
        flags: 0,
        payload: "",
    });
}

let transfer = async function(val) {
    let recipient = val[2];
    let amount = val[3];
    console.log("vallllly", val)
    const client = new TonClient({
        network: {
            endpoints: [DappServer],
        },
    });
    if(val[1].name === 'Пользовательское исключение'){
        return new UserException("no such user in db from transfer");
    }
    const keyPair = JSON.parse(val[1].keys);

    const acc = new Account(val[0].data, {
        signer: signerKeys(keyPair),
        client
    });
    let waitForCollection = client.net.wait_for_collection({
        collection: "messages",
        filter: {
            src: {
                eq: val[1].address,
            },
            dst: {
                eq: recipient,
            },
        },
        result: "id",
        timeout: 600000,
    });
    let transactionID;
    try {
        await sendMoney(acc, recipient, amount);
        transactionID = (await waitForCollection).result;
        console.log("transactionID", transactionID, "recipient", recipient, "amount",amount)
        return {"transactionID":transactionID.id, "recipient": recipient, "amount":amount}
    } catch (error) {
        console.error(error);
        return error
    }
};
let prepareWalletData = async function(msigImage) {
    if(!msigImage){
        throw new UserException("no msig image");
    }
    const msigWallet = msigImage.data;

    // const client = new TonClient({ network: { endpoints: [DappServer] } });
    try {

        const { crypto } = client;
        const { phrase } = await crypto.mnemonic_from_random({
            dictionary: SEED_PHRASE_DICTIONARY_ENGLISH,
            word_count: SEED_PHRASE_WORD_COUNT,
        });
        console.log(`Generated seed phrase "${phrase}"`);

        let keyPair = await crypto.mnemonic_derive_sign_keys({
            phrase,
            path: HD_PATH,
            dictionary: SEED_PHRASE_DICTIONARY_ENGLISH,
            word_count: SEED_PHRASE_WORD_COUNT,
        });
        console.log(`Generated keyPair: ${keyPair}`);

        if(!phrase || !keyPair){
            throw new UserException("error with phrase or keypair");
        }
        const acc = new Account(msigWallet, { signer: signerKeys(keyPair), client });
        let addressGen = await acc.getAddress()
        console.log(`Here is the future address of your contract ${addressGen}. Please save the keys. You will need them later to work with your multisig wallet.`);
        let data = [];
        let now = new Date()
        data.push({"deployStatus":false,"address":addressGen, "seedPhrase":JSON.stringify(phrase), "keys":JSON.stringify(keyPair), subscribe:true, transactions:[], "createAt":now});

        return data

    } catch (error) {
        throw [error.name, error.message]
    }
};
let subscribe = async function(address) {
    // const client = new TonClient({ network: { endpoints: [DappServer] } });
    try {
        const subscriptionAccountHandle = (await client.net.subscribe_collection({
            collection: "messages",
            filter: {
                dst: { eq: address }
                },
            result: "id",
        }, async (d) => {
            console.log(">>> Account subscription triggered ", await d);
            // getCurMsgData(d.result.id)
        })).handle;
    } catch (error) {
        console.error("subscribition error");
        return error

    }
    return {"status":"success"}
};

let getCurMsgData = async function(id) {
    // const client = new TonClient({ network: { endpoints: [DappServer] } });
    const batchQueryResult1 = (await client.net.batch_query({
        "operations": [
            {
                type: 'QueryCollection',
                collection: 'messages',
                filter: {
                    id: {
                        eq: id
                    }
                },
                result: 'src'
            }, {
                type: 'QueryCollection',
                collection: 'messages',
                filter: {
                    id: {
                        eq: id
                    }
                },
                result: 'value'
            },
            {
                type: 'QueryCollection',
                collection: 'messages',
                filter: {
                    id: {
                        eq: id
                    }
                },
                result: 'dst'
            }]
    })).results;
    let value = parseInt(batchQueryResult1[1][0].value, 16)
    let transData = {"src": batchQueryResult1[0][0].src, "dst":batchQueryResult1[2][0].dst, "value":value}
    let ret = await _db.updateTransactions(transData)

    console.log("ret", ret)
    console.log("Balance DST " + batchQueryResult1[0][0].src);
    console.log("Balance SRC " + batchQueryResult1[2][0].dst);
    console.log("Balance VALUE " + parseInt(batchQueryResult1[1][0].value, 16) + '\n');
}

module.exports = {
    subscribe: subscribe,
    prepareWalletData: prepareWalletData,
    transfer: transfer,
    getBalance: getBalance,
    deployWallet: deployWallet,
};
