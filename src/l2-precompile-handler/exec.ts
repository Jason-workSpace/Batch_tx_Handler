import {providers, BigNumber} from "ethers"
import args from '../getClargs';
import { getBlockRangeByBatch, getAllTxByBlockRange, BlockRange } from "./utils";
import { writeFileSync } from 'fs';
// import { requireEnvVariables } from "../tools"

// requireEnvVariables(['L2RPC', 'L1RPC'])

const l1Provider = new providers.JsonRpcProvider(process.env.L1RPC)
const l2Provider = new providers.JsonRpcProvider(process.env.L2RPC)
const l2BatchProvider = new providers.JsonRpcBatchProvider(process.env.L2RPC)

export const startL2PrecompileHandler = async () => {
    if(!process.env['L1RPC'] || !process.env['L1RPC']) {
        throw new Error(`You need set both l1 and l2 rpc in env in action: ${args.action}`)
    }
    if(!args.batchNum) {
        throw new Error(`No batchNum! (You should add --batchNum) in action: ${args.action}`)
    }
    switch(args.precompileAction) {
        case "getBlockRange":
            const blockRangeOutput:BlockRange = await getBlockRangeByBatch(BigNumber.from(args.batchNum), l1Provider, l2Provider)
            console.log("Here is the block range of this batch: ")
            console.log(blockRangeOutput)
            break

        case "getAllTxns":
            if(!args.outputFile) {
                throw new Error("No outputFile! (You should add --outputFile)")
            }
            const blockRange:BlockRange = await getBlockRangeByBatch(BigNumber.from(args.batchNum), l1Provider, l2Provider)
            console.log("Here is the block range of this batch: ")
            console.log(blockRange)
            console.log("Now we query the txns within those blocks...")
            const allTxns = await getAllTxByBlockRange(blockRange, l2BatchProvider)
            console.log(`All ${allTxns.length} txns found, now writing to ${args.outputFile}...`)
            writeFileSync(args.outputFile, allTxns.toString())
            break

        default:
                console.log(`Unknown precompileAction: ${args.precompileAction}`)
    }
}

