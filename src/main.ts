import { startL1BatchHandler } from "./l1-batch-handler/exec"
import { startL2PrecompileHandler } from "./l2-precompile-handler/exec"
import args from './getClargs'

const main = async () => {
    switch(args.action) {
        case "L1BatchHandler":
            if(!args.l1TxHash) {
                throw new Error ("No l1TxHash! (You should add --l1TxHash)")
            }
            
            // yargs will read l1TxHash as number wrongly so we need add this convert.
            const txHash = args.l1TxHash?.toString()
            await startL1BatchHandler(txHash)
            break
        case "L2PrecompileHandler":
            await startL2PrecompileHandler()
            break
            default:
                console.log(`Unknown action: ${args.action}`)
    }
}

main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error)
  process.exit(1)
})