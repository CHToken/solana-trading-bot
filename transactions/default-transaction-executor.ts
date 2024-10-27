import {
  BlockhashWithExpiryBlockHeight,
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { TransactionExecutor } from './transaction-executor.interface';
import { logger } from '../helpers';

export class DefaultTransactionExecutor implements TransactionExecutor {
  private latestBlockhashCache?: BlockhashWithExpiryBlockHeight;

  constructor(private readonly connection: Connection) {}

  public async executeAndConfirm(
    transaction: VersionedTransaction,
    payer: Keypair,
  ): Promise<{ confirmed: boolean; signature?: string, error?: string }> {
    // Get latest blockhash if not cached
    if (!this.latestBlockhashCache) {
      this.latestBlockhashCache = await this.connection.getLatestBlockhash();
    }

    logger.debug('Executing transaction...');
    const signature = await this.execute(transaction);

    logger.debug({ signature }, 'Confirming transaction...');
    return this.confirm(signature);
  }

  private async execute(transaction: Transaction | VersionedTransaction) {
    return this.connection.sendRawTransaction(transaction.serialize(), {
      preflightCommitment: 'processed',
    });
  }

  private async confirm(signature: string): Promise<{ confirmed: boolean; signature?: string; error?: string }> {
    try {
        const confirmation = await this.connection.confirmTransaction(
            {
                signature,
                lastValidBlockHeight: this.latestBlockhashCache!.lastValidBlockHeight,
                blockhash: this.latestBlockhashCache!.blockhash,
            },
            'processed',
        );

        return { confirmed: !confirmation.value.err, signature };
    } catch (error: unknown) {
        let errorMessage = 'Unknown error occurred';

        if (error instanceof Error) {
            errorMessage = error.message;
        }

        logger.error({ signature, error: errorMessage }, 'Transaction confirmation failed');
        return { confirmed: false, signature, error: errorMessage };
    }
  }
}