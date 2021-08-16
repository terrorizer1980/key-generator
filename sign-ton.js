const Web3 = require("web3");
const TonWeb = require("tonweb");
const fs = require("fs");

const tonMultisigIndex = Number(process.argv[2]);

if (isNaN(tonMultisigIndex)) {
    console.error('Usage `node sign-ton.js mulitisig-index`');
    return;
}

async function init() {
    const nacl = TonWeb.utils.nacl;
    const web3 = new Web3();
    const BN = Web3.utils.BN;

    const FILE_NAME = 'keys.json';

    let tonSecretKey, ethAccount;
    let needSave = false;

    if (fs.existsSync(FILE_NAME)) {
        console.log(`Getting keys from ${FILE_NAME}..`);
        const json = JSON.parse(fs.readFileSync(FILE_NAME).toString('utf-8'));

        if (!json.tonPrivateKey) throw new Error('invalid ' + FILE_NAME);
        if (!json.ethPrivateKey) throw new Error('invalid ' + FILE_NAME);

        tonSecretKey = json.tonPrivateKey;
        ethAccount = web3.eth.accounts.privateKeyToAccount(json.ethPrivateKey);
        const keyPair = nacl.sign.keyPair.fromSeed(TonWeb.utils.hexToBytes(tonSecretKey));

        const tonMultisigAddress = '0f9pUVkE0AjZSVmExQdELgd3Z6pHSE5_6X48NnOBcSbOeK7Z';
        const destAddress = 'EQCmDZwk4sS3Nl2VumtvsDMs5AZ2AqH8yqJzf9y10sxaolWg';
        const WALLET_ID = 1;
        const queryId = new BN(1629209348).mul(new BN(4294967296)).add(new BN(1));

        const orderHeader = TonWeb.Contract.createInternalMessageHeader(new TonWeb.utils.Address(destAddress), new TonWeb.utils.toNano(0.5));
        const msgToBridge = TonWeb.Contract.createCommonMsgInfo(orderHeader, null, null);

        const cell = new TonWeb.boc.Cell();
        cell.bits.writeUint(tonMultisigIndex, 8);
        cell.bits.writeBit(0); // null signatures dict
        cell.bits.writeUint(WALLET_ID, 32);
        cell.bits.writeUint(queryId, 64);
        cell.bits.writeUint(3, 8); // send mode 3
        cell.refs.push(msgToBridge);

        const rootHash = await cell.hash();
        const rootSignature = TonWeb.utils.nacl.sign.detached(rootHash, keyPair.secretKey);

        const body = new TonWeb.boc.Cell();
        body.bits.writeBytes(rootSignature);
        body.writeCell(cell);

        const header = TonWeb.Contract.createExternalMessageHeader(tonMultisigAddress);
        const resultMessage = TonWeb.Contract.createCommonMsgInfo(header, null, body);
        const boc = TonWeb.utils.bytesToBase64(await resultMessage.toBoc(false));

        console.log(boc);

    } else {
        console.error('No file ' + FILE_NAME);
    }
}

init();