import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
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
import type { Contracts } from "../target/types/contracts";
import { requiredEnv, writeArtifact } from "./artifact.js";

const POLICY_SEED = "policy";
const SESSION_SEED = "session";
const RECEIPT_SEED = "receipt";
const TERMINAL_SEED = "terminal";
const ACTION_ESCROW_INDEX = 255;
const VAULT_ID = new web3.PublicKey(
  "MagicVau1t999999999999999999999999999999999"
);
const TEE_VALIDATOR = new web3.PublicKey(requiredEnv("MB_TEE_VALIDATOR"));
const ACTION_DISCRIMINATOR = [10, 58, 136, 98, 207, 113, 239, 90];
const PAYLOAD_HASH = Array(32).fill(8);
const gate =
  process.env.LEASH_SETTLEMENT_TEST === "1" ? describe : describe.skip;

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
  expected: string | string[],
  message: string
) {
  try {
    await action;
  } catch (error) {
    const text = String(error).toLowerCase();
    const expectedValues = Array.isArray(expected) ? expected : [expected];
    if (!expectedValues.some((value) => text.includes(value.toLowerCase())))
      throw new Error(`${message}: unexpected error ${String(error)}`);
    return;
  }
  throw new Error(message);
}

gate("LEASH Magic Action settlement gate", () => {
  it("pays once through the authenticated action and leaves a terminal marker", async () => {
    const baseEndpoint = requiredEnv("SOLANA_RPC_URL");
    const teeEndpoint = requiredEnv("MB_TEE_RPC_URL").replace(/\/$/, "");
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
    const amount = new anchor.BN(1_500_000);

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

    const mint = await createMint(
      base.connection,
      controller,
      controller.publicKey,
      null,
      6
    );
    const sourceVault = await getOrCreateAssociatedTokenAccount(
      base.connection,
      controller,
      mint,
      escrow,
      true
    );
    const recipientToken = await getOrCreateAssociatedTokenAccount(
      base.connection,
      controller,
      mint,
      agent.publicKey
    );
    await mintTo(
      base.connection,
      controller,
      mint,
      sourceVault.address,
      controller,
      1_000_000
    );
    await send(
      base,
      new web3.Transaction().add(
        createTopUpEscrowInstruction(
          escrow,
          controller.publicKey,
          controller.publicKey,
          20_000_000,
          ACTION_ESCROW_INDEX
        )
      )
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
        recipientToken.address,
        sourceVault.address,
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
    await program.methods
      .delegateReceipt(session)
      .accountsPartial({
        controller: controller.publicKey,
        receipt,
        validator: TEE_VALIDATOR,
      })
      .signers([controller])
      .rpc();
    await new Promise((resolve) => setTimeout(resolve, 3_000));

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
      (await controllerEr.connection.getSlot()) + 500
    );
    await send(
      controllerEr,
      await program.methods
        .configurePolicy(
          1,
          program.programId,
          ACTION_DISCRIMINATOR,
          PAYLOAD_HASH,
          mint,
          agent.publicKey,
          sourceVault.address,
          amount,
          amount,
          expiresAt
        )
        .accountsPartial({ controller: controller.publicKey, policy })
        .transaction()
    );
    const policyBeforeForbidden = await controllerEr.connection.getAccountInfo(
      policy
    );
    const sessionBeforeForbidden = await agentEr.connection.getAccountInfo(
      session
    );
    if (!policyBeforeForbidden || !sessionBeforeForbidden)
      throw new Error("private state snapshot was unavailable");
    await mustFailWith(
      send(
        agentEr,
        await program.methods
          .issuePermit(
            amount,
            expiresAt,
            web3.Keypair.generate().publicKey,
            ACTION_DISCRIMINATOR,
            PAYLOAD_HASH,
            agent.publicKey,
            mint,
            sourceVault.address
          )
          .accountsPartial({ agent: agent.publicKey, policy, session })
          .transaction()
      ),
      "InvalidAction",
      "wrong destination program was accepted"
    );
    await mustFailWith(
      send(
        agentEr,
        await program.methods
          .issuePermit(
            amount,
            expiresAt,
            program.programId,
            ACTION_DISCRIMINATOR,
            PAYLOAD_HASH,
            web3.Keypair.generate().publicKey,
            mint,
            sourceVault.address
          )
          .accountsPartial({ agent: agent.publicKey, policy, session })
          .transaction()
      ),
      "InvalidAction",
      "wrong recipient was accepted"
    );
    await mustFailWith(
      send(
        agentEr,
        await program.methods
          .issuePermit(
            amount.addn(1),
            expiresAt,
            program.programId,
            ACTION_DISCRIMINATOR,
            PAYLOAD_HASH,
            agent.publicKey,
            mint,
            sourceVault.address
          )
          .accountsPartial({ agent: agent.publicKey, policy, session })
          .transaction()
      ),
      "InvalidAction",
      "over-limit amount was accepted"
    );
    const policyAfterForbidden = await controllerEr.connection.getAccountInfo(
      policy
    );
    const sessionAfterForbidden = await agentEr.connection.getAccountInfo(
      session
    );
    if (
      !policyAfterForbidden ||
      !sessionAfterForbidden ||
      !policyBeforeForbidden.data.equals(policyAfterForbidden.data) ||
      !sessionBeforeForbidden.data.equals(sessionAfterForbidden.data)
    )
      throw new Error("forbidden action mutated private state");
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
          mint,
          sourceVault.address
        )
        .accountsPartial({ agent: agent.publicKey, policy, session })
        .transaction()
    );

    await mustFailWith(
      send(
        base,
        await program.methods
          .settleAction(new anchor.BN(1), amount, Array(32).fill(1))
          .accountsPartial({
            receipt,
            terminal,
            sourceVault: sourceVault.address,
            recipientToken: recipientToken.address,
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
            sourceProgram: program.programId,
            escrowAuth: controller.publicKey,
            escrow,
          })
          .transaction()
      ),
      "signature",
      "direct Magic Action invocation unexpectedly succeeded"
    );

    const before = (await getAccount(base.connection, recipientToken.address))
      .amount;
    const settleSignature = await send(
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
        .transaction()
    );
    const controllerReceipt = await controllerEr.connection.getAccountInfo(
      receipt
    );
    if (!controllerReceipt)
      throw new Error("controller could not read the pending receipt");
    const baseReceipt = await base.connection.getAccountInfo(receipt);
    if (baseReceipt) {
      const publicState = program.coder.accounts.decode(
        "settlementReceipt",
        baseReceipt.data
      );
      if (
        publicState.nonce.toNumber() !== 0 ||
        publicState.status.empty === undefined
      )
        throw new Error("base RPC observed pending receipt state");
    }
    if (await siblingEr.connection.getAccountInfo(receipt))
      throw new Error("sibling token read the pending receipt");
    if (
      (await siblingEr.connection.getMultipleAccountsInfo([receipt])).some(
        Boolean
      )
    )
      throw new Error("sibling batch read the pending receipt");
    let receiptSubscriptionLeaked = false;
    let receiptSubscriptionId: number | undefined;
    try {
      receiptSubscriptionId = await siblingEr.connection.onAccountChange(
        receipt,
        () => {
          receiptSubscriptionLeaked = true;
        },
        "confirmed"
      );
    } catch (error) {
      throw new Error(
        `receipt subscription RPC is unavailable: ${String(error)}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    if (receiptSubscriptionLeaked)
      throw new Error("sibling subscription returned the pending receipt");
    if (receiptSubscriptionId !== undefined)
      await siblingEr.connection.removeAccountChangeListener(
        receiptSubscriptionId
      );
    const pendingTransaction = await siblingEr.connection.getTransaction(
      settleSignature,
      { maxSupportedTransactionVersion: 0 }
    );
    if (!pendingTransaction)
      throw new Error(
        "sibling transaction RPC returned null for receipt commit"
      );
    if (
      pendingTransaction.transaction.message.compiledInstructions.some(
        (instruction) =>
          Buffer.from(instruction.data).indexOf(
            amount.toArrayLike(Buffer, "le", 8)
          ) >= 0
      )
    )
      throw new Error("sibling transaction RPC returned pending receipt data");
    await mustFailWith(
      send(
        siblingEr,
        await program.methods
          .settlePermit()
          .accountsPartial({
            policy,
            session,
            receipt,
            terminal,
            controller: sibling.publicKey,
          })
          .transaction()
      ),
      ["permission", "2001"],
      "sibling wrote the pending receipt"
    );
    await mustFailWith(
      send(
        siblingEr,
        await program.methods
          .delegateReceipt(session)
          .accountsPartial({
            controller: sibling.publicKey,
            receipt,
            validator: TEE_VALIDATOR,
          })
          .transaction()
      ),
      ["permission", "2001", "6015"],
      "sibling delegated the pending receipt"
    );
    const receiptSimulation = await program.methods
      .settlePermit()
      .accountsPartial({
        policy,
        session,
        receipt,
        terminal,
        controller: sibling.publicKey,
      })
      .transaction();
    receiptSimulation.feePayer = sibling.publicKey;
    const simulatedReceipt = await siblingEr.connection.simulateTransaction(
      receiptSimulation,
      [sibling],
      [receipt]
    );
    if (!simulatedReceipt || !simulatedReceipt.value.err)
      throw new Error("sibling simulation unexpectedly accepted the receipt");
    if (
      !JSON.stringify(simulatedReceipt.value.err)
        .toLowerCase()
        .includes("permission") &&
      !JSON.stringify(simulatedReceipt.value.err).toLowerCase().includes("2001")
    )
      throw new Error(
        `sibling receipt simulation returned an unexpected error: ${JSON.stringify(
          simulatedReceipt.value.err
        )}`
      );
    const failedSettleSignature = await send(
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
        .transaction()
    );
    let schedulerSignature: string | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const scheduled = await controllerEr.connection.getTransaction(
        failedSettleSignature,
        { maxSupportedTransactionVersion: 0 }
      );
      const line = scheduled?.meta?.logMessages?.find((entry) =>
        entry.startsWith("ScheduledCommitSent signature: ")
      );
      if (line) {
        schedulerSignature = line.split(": ").pop();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (!schedulerSignature)
      throw new Error(
        `Magic Action finalization was not scheduled; schedule=${failedSettleSignature}`
      );

    let actionFailed = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const finalized = await controllerEr.connection.getTransaction(
        schedulerSignature,
        { maxSupportedTransactionVersion: 0 }
      );
      const logs = finalized?.meta?.logMessages || [];
      if (logs.some((entry) => entry.includes("patched error["))) {
        actionFailed = true;
        break;
      }
      if (logs.some((entry) => entry.includes("signature[0]:"))) break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (!actionFailed)
      throw new Error("underfunded Magic Action unexpectedly succeeded");

    const markerAfterFailure = await program.account.terminalMarker.fetch(
      terminal
    );
    const balanceAfterFailure = (
      await getAccount(base.connection, recipientToken.address)
    ).amount;
    if (
      markerAfterFailure.kind.open === undefined ||
      balanceAfterFailure !== before
    )
      throw new Error("failed payment changed public settlement state");

    const reservedInfo = await agentEr.connection.getAccountInfo(session);
    if (!reservedInfo)
      throw new Error("agent ledger disappeared after failure");
    const reserved = program.coder.accounts.decode(
      "sessionLedger",
      reservedInfo.data
    );
    if (reserved.state.reserved === undefined)
      throw new Error("failed payment consumed the private reservation");

    await mintTo(
      base.connection,
      controller,
      mint,
      sourceVault.address,
      controller,
      1_000_000
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
    await new Promise((resolve) => setTimeout(resolve, 3_000));
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
    await send(
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
        .transaction()
    );

    let settled = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const marker = await program.account.terminalMarker.fetchNullable(
        terminal
      );
      const balance = (
        await getAccount(base.connection, recipientToken.address)
      ).amount;
      if (
        marker?.kind?.spent !== undefined &&
        balance === before + BigInt(amount.toString())
      ) {
        settled = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (!settled)
      throw new Error("Magic Action retry did not settle the receipt");
    const publicReceipt = await program.account.settlementReceipt.fetch(
      receipt
    );
    if (
      Object.prototype.hasOwnProperty.call(publicReceipt, "amount") ||
      Object.prototype.hasOwnProperty.call(publicReceipt, "digest")
    )
      throw new Error("public settlement receipt contains private fields");

    await send(
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
        .transaction()
    );
    const spentInfo = await agentEr.connection.getAccountInfo(session);
    if (!spentInfo) throw new Error("agent ledger disappeared after success");
    const spent = program.coder.accounts.decode(
      "sessionLedger",
      spentInfo.data
    );
    if (spent.state.spent === undefined)
      throw new Error("successful payment did not consume the reservation");

    await mustFailWith(
      send(
        base,
        await program.methods
          .settleAction(new anchor.BN(1), amount, Array(32).fill(1))
          .accountsPartial({
            receipt,
            terminal,
            sourceVault: sourceVault.address,
            recipientToken: recipientToken.address,
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

    await program.methods
      .resetTerminal()
      .accountsPartial({ receipt, terminal, controller: controller.publicKey })
      .signers([controller])
      .rpc();
    const reopenedMarker = await program.account.terminalMarker.fetch(terminal);
    if (
      reopenedMarker.kind.open === undefined ||
      reopenedMarker.history.length !== 1
    )
      throw new Error("terminal reset did not preserve its bounded history");

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
    writeArtifact("leash-settlement-gate.json", {
      gate: "authenticated-settlement",
      status: "passed",
      failedActionPreservedReservation: true,
      retryPaidOnce: true,
      replayRejected: true,
      publicReceiptHasAmount: false,
      publicReceiptHasDigest: false,
    });
  });
});
