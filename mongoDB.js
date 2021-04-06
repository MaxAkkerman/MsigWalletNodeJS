const { MongoClient } = require("mongodb");
var _ = require('lodash');
const uri = "mongodb+srv://123456qwerty:123456qwerty@tonwallet.qvo7z.mongodb.net/TONWallet?retryWrites=true&w=majority&autoReconnect=true&socketTimeoutMS=360000&connectTimeoutMS=360000";
const client = new MongoClient(uri, { useUnifiedTopology: true });
client.connect().then(res=>console.log("connection to db success")).catch(err=>console.log(err))

let setNotDeployedUserToDB = async function(user) {
    try {
        const database = client.db("TONWallet");
        const users = database.collection("users");
        const result = await users.insertOne(user[0]);
        let userDataToShow = [];
        userDataToShow.push({"address":result.ops[0].address, "_id": result.ops[0]._id, "createAt":result.ops[0].createAt});
        return userDataToShow;
    } catch(e){
        return e
    }
}

function UserException(message) {
    this.message = message;
    this.name = "Пользовательское исключение";
}
let getDataForWallet = async function(walletAddress) {
    try {
        const userData = await getUserByAddress({"address":walletAddress})
        const msig = await getMsigWallet()
        console.log("userData",userData, "msig", msig)
        return [msig, userData]
    } catch(e){
        return e
    }
}
let getUserByAddress = async function(walletAddress) {
    try {
        const database = client.db("TONWallet");
        const users = database.collection("users");
        const usersData = await users.findOne(walletAddress);
        console.log("usersData",usersData)
        if(!usersData){
            throw new UserException("cannot get user from db");
        }
        console.log("userData image getted success")
        return usersData
    } catch(e){
        return e
    }
}
let getMsigWallet = async function() {
    try {
        const database = client.db("TONWallet");
        const img = database.collection("users");
        const msig = await img.findOne({"name": "msigImage"});
        if(!msig){
            throw new UserException("cannot get msig image from db");
        }
        console.log("Msig image getted success")
        return msig
    } catch(e) {
        throw [e.name, e.message]
    }
}
let updateUserDeployStatus = async function(address) {
    try {
        const database = client.db("TONWallet");
        const users = database.collection("users");
        const filter = {"address":address[0]};
        const updateDoc = {
            $set: {
                deployStatus:true,
                subscribe:true
            },
        };
        const result = await users.updateOne(filter, updateDoc);
        if(!result){
            throw new UserException("user update error");
        }
        console.log("Set deployed status success")
        return {"deployStatus": "Success", "transactionID": address[1]}
    } catch(e){
        throw [e.name, e.message]
    }
}
let updateTransactions = async function(transactionData) {
    console.log("transArray", transactionData)
    try {
        const database = client.db("TONWallet");
        const users = database.collection("users");
        const filter = {"address":transactionData.dst};
        const usersData = await users.findOne({"address":transactionData.dst});
        let userDataTransactionsClone = _.cloneDeep(usersData.transactions);
        userDataTransactionsClone.push({"src":transactionData.src, "value": transactionData.value})
        console.log("tran", userDataTransactionsClone)
        const updateDoc = {
            $set: {
                transactions:userDataTransactionsClone,
            },
        };
        const result = await users.updateOne(filter, updateDoc);
        if(!result){
            console.log("user update transactions array error")
            throw new UserException("user update transactions array error");
        }
        console.log("transactions update success " + result)
        // return {"deployStatus": "Success"}
    } catch(e){
        return [e.name, e.message]
    }
}

module.exports.updateTransactions = updateTransactions;
module.exports.updateUserDeployStatus = updateUserDeployStatus;
module.exports.getUserByAddress = getUserByAddress;
module.exports.setNotDeployedUserToDB = setNotDeployedUserToDB;
module.exports.getMsigWallet = getMsigWallet;
module.exports.getDataForWallet = getDataForWallet;
