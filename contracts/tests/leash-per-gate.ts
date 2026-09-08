import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import {
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
  verifyTeeRpcIntegrity,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as nacl from "tweetnacl";
import type { Contracts } from "../target/types/contracts";

const POLICY_SEED = "policy";
const SESSION_SEED = "session";
const VAULT_ID = new web3.PublicKey(
  "MagicVau1t999999999999999999999999999999999"
);
const TEE_VALIDATOR = new web3.PublicKey(
  process.env.MB_TEE_VALIDATOR || "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo"
);
const ACTION_DISCRIMINATOR = [10, 58, 136, 98, 207, 113, 239, 90];
const PAYLOAD_HASH = Array(32).fill(8);
const gate = process.env.LEASH_PER_TEST === "1" ? describe : describe.skip;

const withToken = (endpoint: string, token: string) =>
  `${endpoint}?token=${encodeURIComponent(token)}`;

async function providerFor(endpoint: string, keypair: web3.Keypair) {
  const auth = await getAuthToken(endpoint, keypair.publicKey, (message) =>
    Promise.resolve(nacl.sign.detached(message, keypair.secretKey))
  );
  return new anchor.AnchorProvider(
    new web3.Connection(withToken(endpoint, auth.token), {
      commitment: "confirmed",
    }),
    new anchor.Wallet(keypair)
  );
}

async function send(
  provider: anchor.AnchorProvider,
  transaction: web3.Transaction
) {
  transaction.feePayer = provider.wallet.publicKey;
  transaction.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  return provider.sendAndConfirm(
    await provider.wallet.signTransaction(transaction),
    [],
    { skipPreflight: true }
  );
}

gate("LEASH TEE sibling-read gate", () => {
  it("allows an agent ledger while denying a sibling", async () => {
    const baseEndpoint =
      process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const teeEndpoint = (
      process.env.MB_TEE_RPC_URL || "https://devnet-tee.magicblock.app"
    ).replace(/\/$/, "");
    const controller = anchor.Wallet.local().payer;
    const agent = web3.Keypair.generate();
    const sibling = web3.Keypair.generate();
    const base = new anchor.AnchorProvider(
      new web3.Connection(baseEndpoint, { commitment: "confirmed" }),
      new anchor.Wallet(controller)
    );
    anchor.setProvider(base);
    const program = anchor.workspace.Contracts as Program<Contracts>;
    const policyId = new anchor.BN(Date.now());
    const [policy] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(POLICY_SEED),
        controller.publicKey.toBuffer(),
        policyId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const [session] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(SESSION_SEED),
        policy.toBuffer(),
        agent.publicKey.toBuffer(),
      ],
      program.programId
    );
    const policyPermission = permissionPdaFromAccount(policy);
    const sessionPermission = permissionPdaFromAccount(session);
    const amount = new anchor.BN(76123);
    const amountBytes = amount.toArrayLike(Buffer, "le", 8);
    let subscriptionId: number | undefined;
    let subscriptionLeaked = false;

    await verifyTeeRpcIntegrity(teeEndpoint);
    await base.sendAndConfirm(
      new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: controller.publicKey,
          toPubkey: agent.publicKey,
          lamports: 10_000_000,
        })
      ),
      [controller]
    );
    await program.methods
      .createPolicy(policyId, TEE_VALIDATOR)
      .accountsPartial({
        controller: controller.publicKey,
        policy,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([controller])
      .rpc();
    await program.methods
      .createSession()
      .accountsPartial({
        agent: agent.publicKey,
        policy,
        session,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([agent])
      .rpc();
    await program.methods
      .delegateSession(policy)
      .accountsPartial({
        agent: agent.publicKey,
        session,
        validator: TEE_VALIDATOR,
      })
      .signers([agent])
      .rpc();
    await program.methods
      .delegatePolicy(policyId)
      .accountsPartial({
        controller: controller.publicKey,
        policy,
        validator: TEE_VALIDATOR,
      })
      .signers([controller])
      .rpc();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const controllerEr = await providerFor(teeEndpoint, controller);
    const agentEr = await providerFor(teeEndpoint, agent);
    const siblingEr = await providerFor(teeEndpoint, sibling);
    await send(
      controllerEr,
      await program.methods
        .initPolicyPermission()
        .accountsPartial({
          controller: controller.publicKey,
          policy,
          permission: policyPermission,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          ephemeralVault: VAULT_ID,
        })
        .transaction()
    );
    await send(
      agentEr,
      await program.methods
        .initSessionPermission()
        .accountsPartial({
          agent: agent.publicKey,
          session,
          permission: sessionPermission,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          ephemeralVault: VAULT_ID,
        })
        .transaction()
    );
    const expiresAt = new anchor.BN(
      (await controllerEr.connection.getSlot()) + 100
    );
    try {
      subscriptionId = await siblingEr.connection.onAccountChange(
        session,
        (account) => {
          if (account.data.indexOf(amountBytes) >= 0) subscriptionLeaked = true;
        },
        "confirmed"
      );
    } catch (_) {}
    const issueSignature = await send(
      controllerEr,
      await program.methods
        .configurePolicy(
          1,
          program.programId,
          ACTION_DISCRIMINATOR,
          program.programId,
          agent.publicKey,
          controller.publicKey,
          amount,
          amount,
          expiresAt
        )
        .accountsPartial({ controller: controller.publicKey, policy })
        .transaction()
    );
    await send(
      agentEr,
      await program.methods
        .issuePermit(
          amount,
          expiresAt,
          program.programId,
          ACTION_DISCRIMINATOR,
          PAYLOAD_HASH,
          agent.publicKey,
          program.programId,
          controller.publicKey
        )
        .accountsPartial({ agent: agent.publicKey, policy, session })
        .transaction()
    );

    const ownLedger = await agentEr.connection.getAccountInfo(session);
    if (!ownLedger || ownLedger.data.indexOf(amountBytes) < 0)
      throw new Error("agent did not receive its private ledger");
    const baseLedger = await base.connection.getAccountInfo(session);
    if (baseLedger?.data.indexOf(amountBytes) >= 0)
      throw new Error("base RPC returned the private reservation");
    if (await siblingEr.connection.getAccountInfo(session))
      throw new Error("sibling token read the agent ledger");
    const siblingBatch = await siblingEr.connection.getMultipleAccountsInfo([
      session,
    ]);
    if (siblingBatch.some(Boolean))
      throw new Error("sibling batch read the agent ledger");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (subscriptionLeaked)
      throw new Error("sibling subscription returned the reservation");
    if (subscriptionId !== undefined)
      await siblingEr.connection.removeAccountChangeListener(subscriptionId);
    const transaction = await siblingEr.connection.getTransaction(
      issueSignature,
      { maxSupportedTransactionVersion: 0 }
    );
    if (
      transaction?.transaction.message.compiledInstructions.some(
        (instruction) => Buffer.from(instruction.data).indexOf(amountBytes) >= 0
      )
    )
      throw new Error("sibling transaction RPC returned the reservation");
    const simulation = await program.methods
      .issuePermit(
        amount,
        expiresAt,
        program.programId,
        ACTION_DISCRIMINATOR,
        PAYLOAD_HASH,
        agent.publicKey,
        program.programId,
        controller.publicKey
      )
      .accountsPartial({ agent: agent.publicKey, policy, session })
      .transaction();
    simulation.feePayer = agent.publicKey;
    simulation.recentBlockhash = (
      await agentEr.connection.getLatestBlockhash()
    ).blockhash;
    const simulated = await siblingEr.connection
      .simulateTransaction(
        await agentEr.wallet.signTransaction(simulation),
        [],
        [session]
      )
      .catch(() => undefined);
    const simulatedAccount = simulated?.value.accounts?.[0];
    if (
      (simulated?.value.returnData &&
        Buffer.from(simulated.value.returnData.data[0], "base64").indexOf(
          amountBytes
        ) >= 0) ||
      (simulatedAccount &&
        Buffer.from(simulatedAccount.data[0], "base64").indexOf(amountBytes) >=
          0)
    )
      throw new Error("sibling simulation returned the reservation");

    await send(
      controllerEr,
      await program.methods
        .scrubSession()
        .accountsPartial({ controller: controller.publicKey, policy, session })
        .transaction()
    );
    await send(
      controllerEr,
      await program.methods
        .scrubPolicy()
        .accountsPartial({ controller: controller.publicKey, policy })
        .transaction()
    );
    await send(
      agentEr,
      await program.methods
        .closeSessionPermission()
        .accountsPartial({
          agent: agent.publicKey,
          session,
          permission: sessionPermission,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          ephemeralVault: VAULT_ID,
        })
        .transaction()
    );
    await send(
      controllerEr,
      await program.methods
        .closePolicyPermission()
        .accountsPartial({
          controller: controller.publicKey,
          policy,
          permission: policyPermission,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          ephemeralVault: VAULT_ID,
        })
        .transaction()
    );
    await send(
      agentEr,
      await program.methods
        .undelegateSession()
        .accountsPartial({ payer: agent.publicKey, session })
        .transaction()
    );
    await send(
      controllerEr,
      await program.methods
        .undelegatePolicy()
        .accountsPartial({ payer: controller.publicKey, policy })
        .transaction()
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const tornDown = await base.connection.getMultipleAccountsInfo([
      policy,
      session,
    ]);
    if (tornDown.some((account) => account?.data.indexOf(amountBytes) >= 0))
      throw new Error("teardown committed the reservation to base RPC");
  });
});
