import {
  Blockfrost,
  C,
  Data,
  Lucid,
  SpendingValidator,
  TxHash,
  fromHex,
  toHex,
  toUnit,
  Constr,
  MintingPolicy,
  fromText,
  mintingPolicyToId,
  applyParamsToScript,
  applyDoubleCborEncoding,
  attachSpendingValidator,
  UTxO,
} from "https://deno.land/x/lucid@0.10.6/mod.ts";
import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";

// deno run --allow-net --allow-read --allow-env lucidInit.ts

// check the order of your validators in the './plutus.json' file 
// after you have built the project

const BLOCKFROST = "previewLtKSAAN8MBR9TjuZwIVwvBnFJ1YKB6Y7"
 
const lucid = await Lucid.new(
  new Blockfrost(
    "https://cardano-preview.blockfrost.io/api/v0",
    BLOCKFROST,
  ),
  "Preview",
);
 
lucid.selectWalletFromPrivateKey(await Deno.readTextFile("./owner.sk"));
// lucid.selectWalletFromPrivateKey(await Deno.readTextFile("./beneficiary.sk"));
 
const ownerPKH = lucid.utils.getAddressDetails(await Deno.readTextFile("owner.addr"))
.paymentCredential.hash;

const refMint = await readRefMint()
const refCS = lucid.utils.mintingPolicyToId(refMint)
const refVal = await readRefValidator()

// --- Supporting functions

async function readRefMint(): Promise<MintingPolicy> {
  const validator = JSON.parse(await Deno.readTextFile("plutus.json")).validators[0]
  return {
    type: "PlutusV2",
    script: validator.compiledCode
  }
}

async function readRefValidator(): Promise<SpendingValidator> {
  const validator = JSON.parse(await Deno.readTextFile("plutus.json")).validators[1];
  return {
    type: "PlutusV2",
    script: applyParamsToScript(applyDoubleCborEncoding(validator.compiledCode), [refCS]),
  };
}

const ownerAddress = await Deno.readTextFile("./owner.addr");

// --- Validator Details


const rAddress = lucid.utils.validatorToAddress(refVal)

const tokenName = fromText("STOIC01") // whatever the album name is

const eDatum = Data.to(new Constr(0, [BigInt(1)]))
const alphaAction = Data.to(new Constr(0, []))
const betaAction = Data.to(new Constr(1, []))

// --- Transaction Execution

// const mintToken = await mint()

// await lucid.awaitTx(mintToken)

// console.log(`Minted SoundRig Album!
//     Tx Hash: ${mintToken}
//     PolicyID : ${refCS}
// `)

// const distroToken = await spend()

// await lucid.awaitTx(distroToken)

// console.log(`Spent Token!
//     Tx Hash: ${distroToken}
//     Redeemer: ${alphaAction}
// `)

const burnToken = await burn()

await lucid.awaitTx(burnToken)

console.log(`Updated Album!
    Tx Hash: ${burnToken}
`)
 
// --- Transactions

async function mint() {
  const tx = await lucid 
    .newTx()
    .mintAssets({
      [toUnit(refCS, tokenName)]: BigInt(1)
    }, alphaAction)
    .attachMintingPolicy(refMint)
    .payToContract(rAddress, { inline: eDatum }, { [toUnit(refCS, tokenName)]: BigInt(1)})
    .addSignerKey(ownerPKH)
    .complete()

  const signedTx = await tx.sign().complete()

  return signedTx.submit()
}

async function spend() {
  const unit = toUnit(refCS, tokenName)
  const utxos: [UTxO] = await lucid.utxosAtWithUnit(rAddress, [unit])
  const utxo: UTxO = utxos[0]

  const tx = await lucid
    .newTx()
    .collectFrom([utxo], alphaAction) 
    .attachSpendingValidator(refVal) 
    .payToContract(rAddress, { inline: eDatum }, { [unit]: 1n} ) 
    .addSignerKey(ownerPKH)
    .complete()

  const signedTx = await tx.sign().complete()

  return signedTx.submit()
}

async function burn() {
  const unit = toUnit(refCS, tokenName)
  const utxos = await lucid.utxosAtWithUnit(rAddress, [unit])
  const utxo = utxos[0]

  const tx = await lucid
    .newTx()
    .collectFrom([utxo], betaAction) 
    .mintAssets({
      [unit]: -1n
    }, betaAction)
    .attachMintingPolicy(refMint)
    .attachSpendingValidator(refVal)  
    .addSignerKey(ownerPKH)
    .complete()

  const signedTx = await tx.sign().complete()

  return signedTx.submit()
}