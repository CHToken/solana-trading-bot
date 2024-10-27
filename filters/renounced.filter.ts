import { Filter, FilterResult } from './pool-filters';
import { MintLayout } from '@solana/spl-token';
import { Connection } from '@solana/web3.js';
import { LiquidityPoolKeysV4 } from '@raydium-io/raydium-sdk';
import { logger } from '../helpers';

export class RenouncedFreezeFilter implements Filter {
  private readonly errorMessage: string[] = [];

  constructor(
    private readonly connection: Connection,
    private readonly checkRenounced: boolean,
    private readonly checkFreezable: boolean,
  ) {
    if (this.checkRenounced) {
      this.errorMessage.push('mint');
    }

    if (this.checkFreezable) {
      this.errorMessage.push('freeze');
    }
  }

  async execute(poolKeys: LiquidityPoolKeysV4): Promise<FilterResult> {
    try {
      const accountInfo = await this.connection.getAccountInfo(poolKeys.baseMint, this.connection.commitment);
      if (!accountInfo?.data) {
        return { ok: false, message: 'RenouncedFreeze -> Failed to fetch account data' };
      }

      const deserialize = MintLayout.decode(accountInfo.data);

      // Renounced check
      const renouncedOK = !this.checkRenounced || (deserialize.mintAuthorityOption === 0);

      // Freezable check: confirm if the token is freezable or has an active freeze authority
      const freezeAuthorityExists = deserialize.freezeAuthorityOption === 1 && deserialize.freezeAuthority !== null;
      const freezeOK = !this.checkFreezable || !freezeAuthorityExists;
      const ok = renouncedOK && freezeOK;

      const message: string[] = [];
      if (!renouncedOK) {
        message.push('minting authority is not renounced');
      }
      if (!freezeOK) {
        message.push('token has a freeze authority');
      }

      return { ok: ok, message: ok ? undefined : `RenouncedFreeze -> ${message.join(' and ')}` };
    } catch (e) {
      logger.error(
        { mint: poolKeys.baseMint },
        `RenouncedFreeze -> Failed to check if ${this.errorMessage.join(' and ')} are applicable`,
      );
    }

    return {
      ok: false,
      message: `RenouncedFreeze -> Failed to check if ${this.errorMessage.join(' and ')} are applicable`,
    };
  }
}
