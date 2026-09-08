import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

describe("blackout lifecycle scaffold", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.Contracts as anchor.Program;

  it("creates a bounded match config", async () => {
    const matchId = new anchor.BN(Date.now());
    const [matchConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("match"), matchId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const prizeMint = anchor.web3.Keypair.generate().publicKey;

    await program.methods
      .createMatch(
        matchId,
        72000,
        new Array(32).fill(0),
        prizeMint,
        new anchor.BN(1)
      )
      .accounts({
        authority: provider.wallet.publicKey,
        matchConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await (program.account as any).matchConfig.fetch(
      matchConfig
    );
    if (account.playerCount !== 0)
      throw new Error("new match must have no players");
    if (!account.prizeMint.equals(prizeMint))
      throw new Error("prize mint must be immutable match config");
  });
});
