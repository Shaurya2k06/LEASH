import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import {
  createMint,
  createMintToInstruction,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  createTopUpEscrowInstruction,
  escrowPdaFromEscrowAuthority,
  getAuthToken,
  permissionPdaFromAccount,
  verifyTeeRpcIntegrity,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as nacl from "tweetnacl";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Contracts } from "../target/types/contracts";
import {
  controllerKeypair,
  hasEnumVariant,
  requiredEnv,
} from "../tests/artifact.js";

const POLICY_SEED = "policy";
const SESSION_SEED = "session";
const RECEIPT_SEED = "receipt";
const TERMINAL_SEED = "terminal";
const ACTION_ESCROW_INDEX = 255;
const VAULT_ID = new web3.PublicKey(
  "MagicVau1t999999999999999999999999999999999"
);
const ACTION_DISCRIMINATOR = [10, 58, 136, 98, 207, 113, 239, 90];
const PAYLOAD_HASH = Array(32).fill(8);

type DemoStep = {
  id: string;
  label: string;
  phase: "base" | "private" | "tee" | "public";
  status: "confirmed" | "passed";
  detail?: string;
  signature?: string;
  explorerUrl?: string;
  relatedSignatures?: Array<{
    label: string;
    signature: string;
    explorerUrl: string;
  }>;
  accounts?: Array<{ address: string; explorerUrl: string }>;
};

function emitDemoEvent(type: string, value: Record<string, unknown> = {}) {
  console.log(`LEASH_DEMO_EVENT ${JSON.stringify({ type, ...value })}`);
}

const sleep = (milliseconds: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const explorerTx = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

const explorerAccount = (address: web3.PublicKey) =>
  `https://explorer.solana.com/address/${address.toBase58()}?cluster=devnet`;

const accountRef = (address: web3.PublicKey) => ({
  address: address.toBase58(),
  explorerUrl: explorerAccount(address),
});

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
      `${signature}: ${JSON.stringify(confirmation.value.err)} ${
        failed?.meta?.logMessages?.join(" ") || "no logs"
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
    if (String(error).toLowerCase().includes(expected.toLowerCase())) return;
    throw new Error(`${message}: unexpected error ${String(error)}`);
  }
  throw new Error(message);
}

function addStep(
  steps: DemoStep[],
  id: string,
  label: string,
  phase: DemoStep["phase"],
  signature?: string,
  detail?: string,
  accounts?: web3.PublicKey[]
) {
  const step: DemoStep = {
    id,
    label,
    phase,
    status: "confirmed",
    ...(detail ? { detail } : {}),
    ...(signature ? { signature, explorerUrl: explorerTx(signature) } : {}),
    ...(accounts?.length ? { accounts: accounts.map(accountRef) } : {}),
  };
  steps.push(step);
  emitDemoEvent("step", { step });
}

async function recordRpc(
  steps: DemoStep[],
  id: string,
  label: string,
  phase: DemoStep["phase"],
  action: () => Promise<string>,
  detail?: string,
  accounts?: web3.PublicKey[]
) {
  const signature = await action();
  addStep(steps, id, label, phase, signature, detail, accounts);
  return signature;
}

async function recordTransaction(
  steps: DemoStep[],
  id: string,
  label: string,
  phase: DemoStep["phase"],
  provider: anchor.AnchorProvider,
  transaction: web3.Transaction,
  detail?: string,
  accounts?: web3.PublicKey[]
) {
  const signature = await send(provider, transaction);
  addStep(steps, id, label, phase, signature, detail, accounts);
  return signature;
}

async function scheduledSignatures(
  provider: anchor.AnchorProvider,
  signature: string
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const transaction = await provider.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    const line = transaction?.meta?.logMessages?.find((entry) =>
      entry.startsWith("ScheduledCommitSent signature: ")
    );
    if (line) {
      const executionSignature = line.split(": ").pop();
      if (!executionSignature) break;
      for (let actionAttempt = 0; actionAttempt < 30; actionAttempt += 1) {
        const execution = await provider.connection.getTransaction(
          executionSignature,
          { maxSupportedTransactionVersion: 0 }
        );
        const actionLine = execution?.meta?.logMessages?.find((entry) =>
          entry.startsWith("ScheduledCommitSent signature[0]: ")
        );
        if (actionLine) {
          return {
            executionSignature,
            actionSignature: actionLine.split(": ").pop(),
          };
        }
        await sleep(1_000);
      }
      return { executionSignature };
    }
    await sleep(1_000);
  }
  throw new Error(`Magic Action finalization was not scheduled: ${signature}`);
}

async function waitForSpent(
  base: anchor.AnchorProvider,
  program: Program<Contracts>,
  terminal: web3.PublicKey,
  recipientToken: web3.PublicKey,
  before: bigint,
  expectedAmount: bigint
) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const marker = await program.account.terminalMarker.fetchNullable(terminal);
    const balance = (await getAccount(base.connection, recipientToken)).amount;
    if (
      hasEnumVariant(marker?.kind, "spent") &&
      balance === before + expectedAmount
    )
      return;
    await sleep(1_000);
  }
  throw new Error("Magic Action did not settle the demo receipt");
}

function writeDemo(value: Record<string, unknown>) {
  const output = resolve(
    process.env.LEASH_DEMO_OUTPUT || "artifacts/leash-demo.json"
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`LEASH demo artifact: ${output}`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const steps: DemoStep[] = [];
  emitDemoEvent("startup", { stage: "environment" });
  const baseEndpoint = requiredEnv("SOLANA_RPC_URL");
  const teeEndpoint = requiredEnv("MB_TEE_RPC_URL").replace(/\/$/, "");
  const teeValidator = new web3.PublicKey(requiredEnv("MB_TEE_VALIDATOR"));
  emitDemoEvent("startup", { stage: "wallet" });
  const controller = controllerKeypair();
  const agent = web3.Keypair.generate();
  const sibling = web3.Keypair.generate();
  emitDemoEvent("startup", { stage: "provider" });
  const base = new anchor.AnchorProvider(
    new web3.Connection(baseEndpoint, { commitment: "confirmed" }),
    new anchor.Wallet(controller)
  );
  anchor.setProvider(base);
  emitDemoEvent("startup", { stage: "idl" });
  const program = anchor.workspace.Contracts as Program<Contracts>;
  emitDemoEvent("startup", { stage: "program" });
  const configuredProgram = new web3.PublicKey(requiredEnv("LEASH_PROGRAM_ID"));
  if (!program.programId.equals(configuredProgram))
    throw new Error("LEASH_PROGRAM_ID does not match the checked-in IDL");
  emitDemoEvent("started", {
    startedAt,
    network: "solana-devnet",
    program: {
      id: program.programId.toBase58(),
      explorerUrl: explorerAccount(program.programId),
    },
  });
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
    [Buffer.from(SESSION_SEED), policy.toBuffer(), agent.publicKey.toBuffer()],
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
  const escrow = escrowPdaFromEscrowAuthority(
    controller.publicKey,
    ACTION_ESCROW_INDEX
  );
  const amount = new anchor.BN(1_000_000);
  let mint: web3.PublicKey | undefined;
  let sourceVault: web3.PublicKey | undefined;
  let recipientToken: web3.PublicKey | undefined;

  const accounts = [
    program.programId,
    controller.publicKey,
    agent.publicKey,
    policy,
    session,
    receipt,
    terminal,
    escrow,
  ];

  try {
    await verifyTeeRpcIntegrity(teeEndpoint);
    addStep(
      steps,
      "verify-tee",
      "Verify TEE RPC integrity",
      "tee",
      undefined,
      "Authenticated MagicBlock endpoint accepted"
    );

    await recordTransaction(
      steps,
      "fund-participants",
      "Fund agent and privacy sibling",
      "base",
      base,
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
      "Controller funds the demo identities",
      [controller.publicKey, agent.publicKey, sibling.publicKey]
    );

    mint = await createMint(
      base.connection,
      controller,
      controller.publicKey,
      null,
      6
    );
    const source = await getOrCreateAssociatedTokenAccount(
      base.connection,
      controller,
      mint,
      escrow,
      true
    );
    const recipient = await getOrCreateAssociatedTokenAccount(
      base.connection,
      controller,
      mint,
      agent.publicKey
    );
    sourceVault = source.address;
    recipientToken = recipient.address;
    accounts.push(mint, sourceVault, recipientToken);
    addStep(
      steps,
      "create-assets",
      "Create escrow mint and token accounts",
      "base",
      undefined,
      "Public settlement accounts are ready",
      [mint, sourceVault, recipientToken]
    );
    await recordTransaction(
      steps,
      "fund-escrow",
      "Fund escrow for settlement",
      "base",
      base,
      new web3.Transaction().add(
        createMintToInstruction(
          mint,
          sourceVault,
          controller.publicKey,
          2_000_000
        )
      ),
      "Escrow holds enough tokens for one permitted action",
      [sourceVault]
    );
    await recordTransaction(
      steps,
      "top-up-escrow",
      "Top up Magic escrow",
      "base",
      base,
      new web3.Transaction().add(
        createTopUpEscrowInstruction(
          escrow,
          controller.publicKey,
          controller.publicKey,
          20_000_000,
          ACTION_ESCROW_INDEX
        )
      ),
      "Action execution budget is available",
      [escrow]
    );

    await recordRpc(
      steps,
      "create-policy",
      "Create private policy",
      "base",
      () =>
        program.methods
          .createPolicy(policyId, teeValidator)
          .accountsPartial({
            controller: controller.publicKey,
            policy,
            systemProgram: web3.SystemProgram.programId,
          })
          .signers([controller])
          .rpc(),
      "Policy authority is the controller",
      [policy]
    );
    await recordRpc(
      steps,
      "create-session",
      "Create agent session ledger",
      "base",
      () =>
        program.methods
          .createSession()
          .accountsPartial({
            agent: agent.publicKey,
            policy,
            controller: controller.publicKey,
            session,
            systemProgram: web3.SystemProgram.programId,
          })
          .signers([agent, controller])
          .rpc(),
      "Agent and controller co-sign the session",
      [session]
    );
    await recordRpc(
      steps,
      "create-receipt",
      "Create sanitized settlement receipt",
      "base",
      () =>
        program.methods
          .createSettlementReceipt(
            agent.publicKey,
            recipientToken,
            sourceVault,
            mint
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
          .rpc(),
      "Public receipt stores routing state only until settlement",
      [receipt, terminal]
    );
    await recordRpc(
      steps,
      "delegate-session",
      "Delegate session to TEE",
      "base",
      () =>
        program.methods
          .delegateSession(policy)
          .accountsPartial({
            agent: agent.publicKey,
            session,
            validator: teeValidator,
          })
          .signers([agent])
          .rpc(),
      "Session execution moves behind the TEE boundary",
      [session]
    );
    await recordRpc(
      steps,
      "delegate-policy",
      "Delegate policy to TEE",
      "base",
      () =>
        program.methods
          .delegatePolicy(policyId)
          .accountsPartial({
            controller: controller.publicKey,
            policy,
            validator: teeValidator,
          })
          .signers([controller])
          .rpc(),
      "Policy configuration is private",
      [policy]
    );
    await recordRpc(
      steps,
      "delegate-receipt",
      "Delegate receipt to TEE",
      "base",
      () =>
        program.methods
          .delegateReceipt(session)
          .accountsPartial({
            controller: controller.publicKey,
            receipt,
            validator: teeValidator,
          })
          .signers([controller])
          .rpc(),
      "Pending amount and digest stay private",
      [receipt]
    );
    await sleep(3_000);

    const controllerEr = await providerFor(teeEndpoint, controller);
    const agentEr = await providerFor(teeEndpoint, agent);
    const siblingEr = await providerFor(teeEndpoint, sibling);
    await recordTransaction(
      steps,
      "init-policy-permission",
      "Initialize private policy permission",
      "private",
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
        .transaction(),
      "Only controller and agent identities are authorized",
      [policyPermission]
    );
    await recordTransaction(
      steps,
      "init-session-permission",
      "Initialize private session permission",
      "private",
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
        .transaction(),
      "Agent ledger is readable only by its authorized identity",
      [sessionPermission]
    );
    await recordTransaction(
      steps,
      "init-receipt-permission",
      "Initialize private receipt permission",
      "private",
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
        .transaction(),
      "Controller can read the private pending receipt",
      [receiptPermission]
    );
    const expiresAt = new anchor.BN(
      (await controllerEr.connection.getSlot()) + 500
    );
    await recordTransaction(
      steps,
      "configure-policy",
      "Configure typed spending policy",
      "private",
      controllerEr,
      await program.methods
        .configurePolicy(
          1,
          program.programId,
          ACTION_DISCRIMINATOR,
          PAYLOAD_HASH,
          mint,
          agent.publicKey,
          sourceVault,
          amount,
          amount,
          expiresAt
        )
        .accountsPartial({ controller: controller.publicKey, policy })
        .transaction(),
      "One exact action type, recipient, mint, vault, amount, and expiry",
      [policy]
    );
    await recordTransaction(
      steps,
      "issue-permit",
      "Issue exact action permit",
      "private",
      agentEr,
      await program.methods
        .issuePermit(
          amount,
          expiresAt,
          program.programId,
          ACTION_DISCRIMINATOR,
          PAYLOAD_HASH,
          agent.publicKey,
          mint,
          sourceVault
        )
        .accountsPartial({ agent: agent.publicKey, policy, session })
        .transaction(),
      "Reservation is private and bound to the typed action",
      [session]
    );

    const ownPrivateState = await agentEr.connection.getAccountInfo(session);
    const siblingPrivateState = await siblingEr.connection.getAccountInfo(
      session
    );
    if (!ownPrivateState || siblingPrivateState)
      throw new Error("private session visibility check failed");
    addStep(
      steps,
      "privacy-check",
      "Verify private session visibility",
      "private",
      undefined,
      "Authorized agent read succeeded; sibling read returned no state",
      [session]
    );

    await recordTransaction(
      steps,
      "settle-permit",
      "Commit private permit to receipt",
      "private",
      controllerEr,
      await program.methods
        .settlePermit()
        .accountsPartial({
          policy,
          session,
          receipt,
          terminal,
          controller: controller.publicKey,
        })
        .transaction(),
      "Pending settlement remains hidden from base RPC",
      [receipt, terminal]
    );
    const recipientBalanceBefore = (
      await getAccount(base.connection, recipientToken)
    ).amount;
    const commitSignature = await recordTransaction(
      steps,
      "commit-settlement",
      "Schedule authenticated Magic Action",
      "private",
      controllerEr,
      await program.methods
        .commitSettlement()
        .accountsPartial({
          receipt,
          terminal,
          policy,
          session,
          controller: controller.publicKey,
          permission: receiptPermission,
          ephemeralVault: VAULT_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
        })
        .transaction(),
      "TEE authenticates the action before scheduling it",
      [receipt, terminal, escrow, sourceVault, recipientToken]
    );
    const scheduled = await scheduledSignatures(controllerEr, commitSignature);
    const actionSignature =
      scheduled.actionSignature || scheduled.executionSignature;
    addStep(
      steps,
      "magic-action",
      "Execute authenticated token transfer",
      "public",
      actionSignature,
      "Magic Action finalized the recipient transfer",
      [terminal, recipientToken]
    );
    if (scheduled.actionSignature) {
      steps[steps.length - 1].relatedSignatures = [
        {
          label: "TEE execution transaction",
          signature: scheduled.executionSignature,
          explorerUrl: explorerTx(scheduled.executionSignature),
        },
      ];
    }
    await waitForSpent(
      base,
      program,
      terminal,
      recipientToken,
      recipientBalanceBefore,
      BigInt(amount.toString())
    );
    const publicReceipt = await program.account.settlementReceipt.fetch(
      receipt
    );
    if (
      Object.prototype.hasOwnProperty.call(publicReceipt, "amount") ||
      Object.prototype.hasOwnProperty.call(publicReceipt, "digest")
    )
      throw new Error("public settlement receipt contains private fields");
    addStep(
      steps,
      "public-receipt-check",
      "Verify sanitized public receipt",
      "public",
      undefined,
      "Final receipt exposes routing/status only; amount and digest are absent",
      [receipt]
    );
    await recordTransaction(
      steps,
      "finalize-permit",
      "Finalize private permit as spent",
      "private",
      controllerEr,
      await program.methods
        .finalizePermit(new anchor.BN(1))
        .accountsPartial({
          policy,
          session,
          receipt,
          terminal,
          controller: controller.publicKey,
        })
        .transaction(),
      "Reservation is consumed exactly once",
      [session, terminal]
    );
    await mustFailWith(
      send(
        base,
        await program.methods
          .settleAction(new anchor.BN(1), amount, Array(32).fill(1))
          .accountsPartial({
            receipt,
            terminal,
            sourceVault,
            recipientToken,
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
            sourceProgram: program.programId,
            escrowAuth: controller.publicKey,
            escrow,
          })
          .transaction()
      ),
      "signature",
      "replayed Magic Action unexpectedly succeeded"
    );
    addStep(
      steps,
      "replay-rejected",
      "Reject replayed Magic Action",
      "public",
      undefined,
      "The same nonce cannot be paid twice",
      [terminal]
    );

    await recordTransaction(
      steps,
      "scrub-session",
      "Scrub private session state",
      "private",
      controllerEr,
      await program.methods
        .scrubSession()
        .accountsPartial({ controller: controller.publicKey, policy, session })
        .transaction(),
      "Private ledger is scrubbed before undelegation",
      [session]
    );
    await recordTransaction(
      steps,
      "scrub-policy",
      "Scrub private policy state",
      "private",
      controllerEr,
      await program.methods
        .scrubPolicy()
        .accountsPartial({ controller: controller.publicKey, policy })
        .transaction(),
      "Private policy state is scrubbed",
      [policy]
    );
    await recordTransaction(
      steps,
      "close-permissions",
      "Close TEE permission accounts",
      "private",
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
        .transaction(),
      "Session permission closed",
      [sessionPermission]
    );
    await recordTransaction(
      steps,
      "close-policy-permission",
      "Close policy permission account",
      "private",
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
        .transaction(),
      "Policy permission closed",
      [policyPermission]
    );
    await recordTransaction(
      steps,
      "undelegate-session",
      "Return session to base chain",
      "base",
      agentEr,
      await program.methods
        .undelegateSession()
        .accountsPartial({ payer: agent.publicKey, session })
        .transaction(),
      "Session lifecycle is complete",
      [session]
    );
    await recordTransaction(
      steps,
      "undelegate-policy",
      "Return policy to base chain",
      "base",
      controllerEr,
      await program.methods
        .undelegatePolicy()
        .accountsPartial({ payer: controller.publicKey, policy })
        .transaction(),
      "Policy lifecycle is complete",
      [policy]
    );

    writeDemo({
      status: "passed",
      mode: "authenticated-settlement",
      network: "solana-devnet",
      program: {
        id: program.programId.toBase58(),
        explorerUrl: explorerAccount(program.programId),
      },
      startedAt,
      finishedAt: new Date().toISOString(),
      actionLatencyMeasured: false,
      privacy: {
        authorizedAgentRead: true,
        siblingReadDenied: true,
        privateReservationValuesPublished: false,
      },
      settlement: {
        status: "spent",
        replayAttempted: true,
        replayRejected: true,
        privateAmountPublished: false,
      },
      accounts: {
        controller: accountRef(controller.publicKey),
        agent: accountRef(agent.publicKey),
        policy: accountRef(policy),
        session: accountRef(session),
        receipt: accountRef(receipt),
        terminal: accountRef(terminal),
        mint: accountRef(mint),
        sourceVault: accountRef(sourceVault),
        recipientToken: accountRef(recipientToken),
      },
      steps,
    });
  } catch (error) {
    writeDemo({
      status: "failed",
      mode: "authenticated-settlement",
      network: "solana-devnet",
      program: { id: program.programId.toBase58() },
      startedAt,
      finishedAt: new Date().toISOString(),
      failedStep: steps.length ? steps[steps.length - 1].id : "initialization",
      error: String(error),
      steps,
    });
    throw error;
  }
}

main().catch(() => (process.exitCode = 1));
