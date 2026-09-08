import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import {
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as nacl from "tweetnacl";
import type { Contracts } from "../target/types/contracts";

const PROBE_SEED = "probe";
const VAULT_ID = new web3.PublicKey(
  "MagicVau1t999999999999999999999999999999999"
);
const TEE_VALIDATOR =
  process.env.MB_TEE_VALIDATOR || "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo";

const withToken = (endpoint: string, token: string) =>
  `${endpoint}${endpoint.includes("?") ? "&" : "?"}token=${encodeURIComponent(
    token
  )}`;

async function sendOnEr(
  provider: anchor.AnchorProvider,
  transaction: web3.Transaction
) {
  transaction.feePayer = provider.wallet.publicKey;
  transaction.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  const signed = await provider.wallet.signTransaction(transaction);
  return provider.sendAndConfirm(signed, [], { skipPreflight: true });
}

async function assertNoRawRead<T>(
  label: string,
  read: () => Promise<T>,
  leaked: (value: T) => boolean
) {
  try {
    if (leaked(await read())) throw new Error(`${label} returned raw data`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("returned raw data"))
      throw error;
  }
}

async function assertNoSubscription(
  connection: web3.Connection,
  address: web3.PublicKey,
  label: string
) {
  let subscriptionId: number | undefined;
  try {
    subscriptionId = await connection.onAccountChange(
      address,
      () => undefined,
      "confirmed"
    );
    throw new Error(`${label} opened`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("opened")) throw error;
  } finally {
    if (subscriptionId !== undefined)
      await connection.removeAccountChangeListener(subscriptionId);
  }
}

const gate = process.env.BLACKOUT_PER_TEST === "1" ? describe : describe.skip;

gate("BLACKOUT Phase 1 private-state gate", () => {
  it("blocks raw reads while allowing the authorized TEE reader", async () => {
    const baseEndpoint =
      process.env.PROVIDER_ENDPOINT || "https://api.devnet.solana.com";
    const teeEndpoint = (
      process.env.TEE_PROVIDER_ENDPOINT || "https://devnet-tee.magicblock.app"
    ).replace(/\/$/, "");
    const teeWsEndpoint =
      process.env.TEE_WS_ENDPOINT || "wss://devnet-tee.magicblock.app";
    const wallet = anchor.Wallet.local();
    const base = new anchor.AnchorProvider(
      new web3.Connection(baseEndpoint, { commitment: "confirmed" }),
      wallet
    );
    anchor.setProvider(base);
    const program = anchor.workspace.Contracts as Program<Contracts>;
    const [probe] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(PROBE_SEED), wallet.publicKey.toBuffer()],
      program.programId
    );
    const permission = permissionPdaFromAccount(probe);
    const secret = new anchor.BN(Date.now()).ushln(8).addn(0xa5);
    const secretBytes = secret.toArrayLike(Buffer, "le", 8);
    const validator = new web3.PublicKey(TEE_VALIDATOR);
    let delegated = false;
    let permissionCreated = false;

    const auth = await getAuthToken(
      teeEndpoint,
      wallet.publicKey,
      async (message) => nacl.sign.detached(message, wallet.payer.secretKey)
    );
    const authorizedEr = new anchor.AnchorProvider(
      new web3.Connection(withToken(teeEndpoint, auth.token), {
        wsEndpoint: withToken(teeWsEndpoint, auth.token),
        commitment: "confirmed",
      }),
      wallet
    );

    try {
      const existing = await base.connection.getAccountInfo(probe);
      if (!existing) {
        await program.methods
          .initializeProbe(secret)
          .accountsPartial({
            authority: wallet.publicKey,
            probe,
            systemProgram: web3.SystemProgram.programId,
          })
          .rpc({ skipPreflight: true });
      }

      const owner = (await base.connection.getAccountInfo(probe))?.owner;
      if (!owner || owner.equals(program.programId)) {
        await program.methods
          .delegateProbe()
          .accountsPartial({
            authority: wallet.publicKey,
            probe,
            validator,
          })
          .rpc({ skipPreflight: true });
        delegated = true;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      delegated = true;

      const writeSignature = await sendOnEr(
        authorizedEr,
        await program.methods
          .initProbePermission()
          .accountsPartial({
            authority: wallet.publicKey,
            probe,
            permission,
            magicProgram: MAGIC_PROGRAM_ID,
            permissionProgram: PERMISSION_PROGRAM_ID,
            ephemeralVault: VAULT_ID,
          })
          .transaction()
      );
      permissionCreated = true;

      await sendOnEr(
        authorizedEr,
        await program.methods
          .writeProbe(secret)
          .accounts({ authority: wallet.publicKey, probe })
          .transaction()
      );

      const authorizedAccount = await authorizedEr.connection.getAccountInfo(
        probe
      );
      if (!authorizedAccount || authorizedAccount.data.indexOf(secretBytes) < 0)
        throw new Error("authorized TEE read did not return the probe secret");

      const unauthenticatedEr = new web3.Connection(teeEndpoint, {
        commitment: "confirmed",
      });
      await assertNoRawRead(
        "base RPC",
        () => base.connection.getAccountInfo(probe),
        Boolean
      );
      await assertNoRawRead(
        "unauthenticated TEE account RPC",
        () => unauthenticatedEr.getAccountInfo(probe),
        Boolean
      );
      await assertNoRawRead(
        "unauthenticated TEE batch RPC",
        () => unauthenticatedEr.getMultipleAccountsInfo([probe]),
        (accounts) => accounts.some(Boolean)
      );
      await assertNoSubscription(unauthenticatedEr, probe, "TEE subscription");
      await assertNoRawRead(
        "unauthenticated TEE logs RPC",
        () => unauthenticatedEr.getSignaturesForAddress(probe, { limit: 1 }),
        (signatures) => signatures.length > 0
      );
      await assertNoRawRead(
        "unauthenticated TEE transaction RPC",
        () =>
          unauthenticatedEr.getTransaction(writeSignature, {
            maxSupportedTransactionVersion: 0,
          }),
        Boolean
      );

      const simulation = await program.methods
        .writeProbe(secret)
        .accounts({ authority: wallet.publicKey, probe })
        .transaction();
      simulation.feePayer = wallet.publicKey;
      simulation.recentBlockhash = (
        await authorizedEr.connection.getLatestBlockhash()
      ).blockhash;
      const signedSimulation = await wallet.signTransaction(simulation);
      await assertNoRawRead(
        "unauthenticated TEE simulation",
        () => unauthenticatedEr.simulateTransaction(signedSimulation),
        (result) => result.value.err === null
      );

      const wrong = web3.Keypair.generate();
      const wrongAuth = await getAuthToken(
        teeEndpoint,
        wrong.publicKey,
        async (message) => nacl.sign.detached(message, wrong.secretKey)
      );
      await assertNoRawRead(
        "wrong-wallet TEE RPC",
        () =>
          new web3.Connection(withToken(teeEndpoint, wrongAuth.token), {
            commitment: "confirmed",
          }).getAccountInfo(probe),
        Boolean
      );
      await assertNoRawRead(
        "wrong-wallet TEE batch RPC",
        () =>
          new web3.Connection(withToken(teeEndpoint, wrongAuth.token), {
            commitment: "confirmed",
          }).getMultipleAccountsInfo([probe]),
        (accounts) => accounts.some(Boolean)
      );
    } finally {
      if (permissionCreated) {
        await sendOnEr(
          authorizedEr,
          await program.methods
            .scrubProbe()
            .accounts({ authority: wallet.publicKey, probe })
            .transaction()
        );
        await sendOnEr(
          authorizedEr,
          await program.methods
            .closeProbePermission()
            .accountsPartial({
              authority: wallet.publicKey,
              probe,
              permission,
              magicProgram: MAGIC_PROGRAM_ID,
              permissionProgram: PERMISSION_PROGRAM_ID,
              ephemeralVault: VAULT_ID,
            })
            .transaction()
        );
      }
      if (delegated) {
        await sendOnEr(
          authorizedEr,
          await program.methods
            .undelegateProbe()
            .accountsPartial({ payer: wallet.publicKey, probe })
            .transaction()
        );
      }
    }
  });
});
