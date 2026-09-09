import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import {
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
  verifyTeeRpcIntegrity,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as nacl from "tweetnacl";
import type { Contracts } from "../target/types/contracts";
import { controllerKeypair, requiredEnv, writeArtifact } from "./artifact.js";

const POLICY_SEED = "policy";
const SESSION_SEED = "session";
const RECEIPT_SEED = "receipt";
const TERMINAL_SEED = "terminal";
const VAULT_ID = new web3.PublicKey(
  "MagicVau1t999999999999999999999999999999999"
);
const TEE_VALIDATOR = new web3.PublicKey(requiredEnv("MB_TEE_VALIDATOR"));
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
  const signed = await provider.wallet.signTransaction(transaction);
  const signature = await provider.connection.sendRawTransaction(
    signed.serialize(),
    { skipPreflight: true }
  );
  const confirmation = await provider.connection.confirmTransaction(
    signature,
    "confirmed"
  );
  if (confirmation.value.err) {
    const failed = await provider.connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    throw new Error(
      `${signature}: ${JSON.stringify(confirmation.value.err)}\n${
        failed?.meta?.logMessages?.join("\n") || "no logs"
      }`
    );
  }
  return signature;
}

async function mustFailWith(
  action: Promise<unknown>,
  expected: string,
  message: string
) {
  try {
    await action;
  } catch (error) {
    if (!String(error).toLowerCase().includes(expected.toLowerCase()))
      throw new Error(`${message}: unexpected error ${String(error)}`);
    return;
  }
  throw new Error(message);
}

gate("LEASH TEE sibling-read gate", () => {
  it("allows an agent ledger while denying a sibling", async () => {
    const baseEndpoint = requiredEnv("SOLANA_RPC_URL");
    const teeEndpoint = requiredEnv("MB_TEE_RPC_URL").replace(/\/$/, "");
    const controller = controllerKeypair();
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
    const [receipt] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(RECEIPT_SEED), session.toBuffer()],
      program.programId
    );
    const [terminal] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(TERMINAL_SEED), session.toBuffer()],
      program.programId
    );
    const policyPermission = permissionPdaFromAccount(policy);
    const sessionPermission = permissionPdaFromAccount(session);
    const receiptPermission = permissionPdaFromAccount(receipt);
    const amount = new anchor.BN(76123);
    const amountBytes = amount.toArrayLike(Buffer, "le", 8);
    let subscriptionId: number | undefined;
    let ownSubscriptionId: number | undefined;
    let ownSubscriptionSeen = false;
    let subscriptionLeaked = false;

    await verifyTeeRpcIntegrity(teeEndpoint);
    await base.sendAndConfirm(
      new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: controller.publicKey,
          toPubkey: agent.publicKey,
          lamports: 10_000_000,
        }),
        web3.SystemProgram.transfer({
          fromPubkey: controller.publicKey,
          toPubkey: sibling.publicKey,
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
        controller: controller.publicKey,
        session,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([agent, controller])
      .rpc();
    await program.methods
      .createSettlementReceipt(
        agent.publicKey,
        agent.publicKey,
        controller.publicKey,
        program.programId
      )
      .accountsPartial({
        controller: controller.publicKey,
        policy,
        session,
        receipt,
        terminal,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([controller])
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
    const wrongValidator = web3.Keypair.generate().publicKey;
    await mustFailWith(
      program.methods
        .delegatePolicy(policyId)
        .accountsPartial({
          controller: controller.publicKey,
          policy,
          validator: wrongValidator,
        })
        .signers([controller])
        .rpc(),
      "InvalidPolicy",
      "arbitrary validator was accepted"
    );
    await program.methods
      .delegatePolicy(policyId)
      .accountsPartial({
        controller: controller.publicKey,
        policy,
        validator: TEE_VALIDATOR,
      })
      .signers([controller])
      .rpc();
    await mustFailWith(
      program.methods
        .delegateReceipt(session)
        .accountsPartial({
          controller: sibling.publicKey,
          receipt,
          validator: TEE_VALIDATOR,
        })
        .signers([sibling])
        .rpc(),
      "UnauthorizedSettlement",
      "sibling controller delegated the receipt"
    );
    await program.methods
      .delegateReceipt(session)
      .accountsPartial({
        controller: controller.publicKey,
        receipt,
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
        .initPolicyPermission([agent.publicKey])
        .accountsPartial({
          controller: controller.publicKey,
          policy,
          permission: policyPermission,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          ephemeralVault: VAULT_ID,
          systemProgram: web3.SystemProgram.programId,
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
    await send(
      controllerEr,
      await program.methods
        .initReceiptPermission()
        .accountsPartial({
          controller: controller.publicKey,
          receipt,
          permission: receiptPermission,
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
      ownSubscriptionId = await agentEr.connection.onAccountChange(
        session,
        () => {
          ownSubscriptionSeen = true;
        },
        "confirmed"
      );
      subscriptionId = await siblingEr.connection.onAccountChange(
        session,
        () => {
          subscriptionLeaked = true;
        },
        "confirmed"
      );
    } catch (error) {
      throw new Error(`subscription RPC is unavailable: ${String(error)}`);
    }
    await send(
      controllerEr,
      await program.methods
        .configurePolicy(
          1,
          program.programId,
          ACTION_DISCRIMINATOR,
          PAYLOAD_HASH,
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
    const issueSignature = await send(
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
    const ownBatch = await agentEr.connection.getMultipleAccountsInfo([
      session,
    ]);
    if (!ownBatch[0]) throw new Error("agent batch read was unavailable");
    if (siblingBatch.some(Boolean))
      throw new Error("sibling batch read the agent ledger");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!ownSubscriptionSeen)
      throw new Error(
        "agent subscription positive control did not observe the ledger"
      );
    if (subscriptionLeaked)
      throw new Error("sibling subscription returned the reservation");
    if (ownSubscriptionId !== undefined)
      await agentEr.connection.removeAccountChangeListener(ownSubscriptionId);
    if (subscriptionId !== undefined)
      await siblingEr.connection.removeAccountChangeListener(subscriptionId);
    const transaction = await siblingEr.connection.getTransaction(
      issueSignature,
      { maxSupportedTransactionVersion: 0 }
    );
    if (!transaction) throw new Error("sibling transaction RPC returned null");
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
        sibling.publicKey,
        program.programId,
        controller.publicKey
      )
      .accountsPartial({ agent: sibling.publicKey, policy, session })
      .transaction();
    simulation.feePayer = sibling.publicKey;
    const simulated = await siblingEr.connection.simulateTransaction(
      simulation,
      [sibling],
      [session]
    );
    if (!simulated) throw new Error("sibling simulation RPC returned null");
    if (!simulated.value.err)
      throw new Error("sibling simulation unexpectedly accepted the ledger");
    const simulationError = JSON.stringify(simulated.value.err).toLowerCase();
    if (
      !simulationError.includes("permission") &&
      !simulationError.includes("2001")
    )
      throw new Error(
        `sibling simulation returned an unexpected error: ${JSON.stringify(
          simulated.value.err
        )}`
      );
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

    while ((await controllerEr.connection.getSlot()) <= expiresAt.toNumber())
      await new Promise((resolve) => setTimeout(resolve, 500));
    await send(
      controllerEr,
      await program.methods
        .expirePermit()
        .accountsPartial({
          policy,
          session,
          receipt,
          terminal,
          controller: controller.publicKey,
        })
        .transaction()
    );
    await send(
      controllerEr,
      await program.methods
        .commitExpiry()
        .accountsPartial({
          policy,
          session,
          receipt,
          terminal,
          controller: controller.publicKey,
          permission: receiptPermission,
          ephemeralVault: VAULT_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
        })
        .transaction()
    );

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
    writeArtifact("leash-per-gate.json", {
      gate: "sibling-read",
      status: "passed",
      ownLedgerVisible: true,
      baseLedgerSecretBytes: false,
      siblingDirectVisible: false,
      siblingBatchVisible: false,
      siblingSubscriptionLeaked: false,
      siblingTransactionSecretBytes: false,
      siblingSimulationSecretBytes: false,
    });
  });
});
