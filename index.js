const _db = require('./mongoDB.js')
const sdk = require('./sdk.js')
const express = require('express')
const app = express()
const port = 3000
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()

app.get('/genMsigWalletPreData', (req, res) => {
    _db.getMsigWallet()
        .then(res => sdk.prepareWalletData(res))
        .then(r => _db.setNotDeployedUserToDB(r))
        .then(scData => res.send(scData))
        .catch(error => res.send(error));
})
app.post('/deployWallet', jsonParser, (req, res) => {
    _db.getDataForWallet(req.body.address)
        .then(dat => sdk.deployWallet(dat))
        .then(address => _db.updateUserDeployStatus(address))
        .then(userData1 => res.send(userData1))
        .catch(error => res.send(error));
})
app.get('/getBalance/:address', jsonParser, (req, res) => {
    sdk.getBalance(req.params.address)
        .then(balanceData => res.send(balanceData))
        .catch(error => res.send(error));
})

app.post('/transfer', jsonParser, (req, res) => {
    let body = req.body.data
    let p1 = _db.getMsigWallet()
    let p2 = _db.getUserByAddress({"address": body[0].from})
    // console.log("p1", p1, "p2", p2)
    Promise.all([p1, p2, body[0].to, body[0].amount])
        .then(values => {
            sdk.transfer(values)
                .then(result => res.send(result))
        }).catch(error => res.send(error));
})
app.get('/subscribe', jsonParser, (req, res) => {
    sdk.subscribe("0:3b7c772c81ebb6536525a0dbc5134dc8cdab1dca84ad28e57066a625ede1aae7")
        .then(result => res.send(result))
        .catch(error => res.send(error));
})
const server = app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})
server.timeout = 120000

// {"data":
//     [{"from":"0:c3558e9e55e0269c8224287a38830ee476941ae9670247ebf085f3223f3e6485",
//         "to":"0:4594ac781bdcdee350c9c8c25dfaf08d067b1214fa86c687f4deca048a76551f",
//         "amount":"1000000000"}]
// }
