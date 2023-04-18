import { ethers } from "ethers"
import brotli from "brotli"
import { rlp, bufArrToArr } from 'ethereumjs-util'
import { Decoded, Input } from "rlp";
import { getL2Network } from "@arbitrum/sdk"
import { Interface } from "ethers/lib/utils";
import { seqFunctionAbi } from "./abi";

const MaxL2MessageSize                 = 256 * 1024
const BrotliMessageHeaderByte          = 0

const BatchSegmentKindL2Message        = 0
const BatchSegmentKindL2MessageBrotli  = 1

const L2MessageKind_Batch              = 3
const L2MessageKind_SignedTx           = 4

const provider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/5WJKrYtTlkSBN1c4EoMIIMcueB3gSUpn")


export const decompressAndDecode = (compressedData: Uint8Array): Uint8Array[] => {
    let d = brotli.decompress(Buffer.from(compressedData))
    let output = ethers.utils.hexlify(d)
    
    let res = rlp.decode(output ,true) as Decoded
    let l2Segments: Uint8Array[] = []
    while (res.remainder !== undefined) {
        l2Segments.push(bufArrToArr(res.data as Buffer))
        res = (rlp.decode(res.remainder as Input, true) as Decoded)
    }
    return l2Segments
}

export const processRawData = (rawData: Uint8Array): Uint8Array => {
    console.log(rawData[0])
    if(rawData[0] !== BrotliMessageHeaderByte) {
        throw Error("Can only process brotli compressed data.")
    }
    const compressedData = rawData.subarray(1)
    if(compressedData.length === 0) {
        throw new Error("Empty sequencer message")
    }
    return compressedData
}


const getNextSerializedTransactionSize = (remainData: Uint8Array, start: number): bigint => {
    const sizeBytes = remainData.subarray(start, start + 8)
    const size = ethers.BigNumber.from(sizeBytes).toBigInt()
    if(size > MaxL2MessageSize) {
        throw new Error("size too large in getOneSerializedTransaction")
    }
    return size
}

export const getAllL2Msgs = (l2segments: Uint8Array[]):Uint8Array[] => {
    let l2Msgs:Uint8Array[] = []

    for(let i = 0; i < l2segments.length; i++) {
        let kind = l2segments[i][0]
        let segment = l2segments[i].subarray(1)
        if(kind === BatchSegmentKindL2Message || kind === BatchSegmentKindL2MessageBrotli) {
            if(kind === BatchSegmentKindL2MessageBrotli) {
                segment = brotli.decompress(Buffer.from(segment))
            }
            l2Msgs.push(segment)
        }
    }

    if(l2Msgs.length > MaxL2MessageSize) {
        throw Error("Message too large")
    }

    return l2Msgs
}

export const decodeL2Msgs = (l2Msgs: Uint8Array): string[] => {
    let txHash: string[] = []
    
    const kind = l2Msgs[0]
    if(kind === L2MessageKind_SignedTx) {
        const serializedTransaction = l2Msgs.subarray(1)
        txHash.push(ethers.utils.keccak256(serializedTransaction))
    } else if(kind === L2MessageKind_Batch) {
        let remainData: Uint8Array = l2Msgs.subarray(1)
        const lengthOfData = remainData.length
        let current = BigInt(0)
        while(current < lengthOfData) {
            const nextSize = getNextSerializedTransactionSize(remainData, Number(current))
            current += 8n // the size of next data length value is 8 bytes
            const endOfNext = current + nextSize
            const nextData = remainData.subarray(Number(current), Number(endOfNext))
            txHash.push(...decodeL2Msgs(nextData))
            current = endOfNext     
        }
    }
    return txHash
}

export const getRawData = async (sequencerTx: string): Promise<Uint8Array> => {
    const contractInterface = new Interface(seqFunctionAbi)
    const l2Network = await getL2Network(42161)
    const txReceipt = await provider.getTransactionReceipt(sequencerTx)
    const tx = await provider.getTransaction(sequencerTx)
    if(!tx || !txReceipt || (txReceipt && !txReceipt.status)) {
        throw new Error("No such a l1 transaction or transaction reverted")
    }
    
    if(tx.to !== l2Network.ethBridge.sequencerInbox) {
        throw new Error("Not a sequencer inbox transaction")
    }

    const calldata = contractInterface.decodeFunctionData("addSequencerL2BatchFromOrigin",tx.data)
    const seqData = calldata["data"].substring(2) //remove '0x'
    const rawData = Uint8Array.from(Buffer.from(seqData,'hex'))
    return rawData
}

//TODO: get all startBlock tx in this batch
export const getAllStartBlockTx = () => {}

//TODO: get all tx from delayed inbox in this batch
export const getAllDelayed = () => {}