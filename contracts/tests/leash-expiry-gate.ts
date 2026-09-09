import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
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
import {
  accountRef,
  controllerKeypair,
  hasEnumVariant,
  requiredEnv,
  transactionRef,
  writeArtifact,
} from "./artifact.js";

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
const gate = process.env.LEASH_EXPIRY_TEST === "1" ? describe : describe.skip;
const transactions: Array<ReturnType<typeof transactionRef>> = [];

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
  transactions.push(transactionRef(signature));
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

gate("LEASH expiry terminal gate", () => {
  it("publishes expiry and prevents a later payment race", async () => {
    transactions.length = 0;
    const baseEndpoint = requiredEnv("SOLANA_RPC_URL");
    const teeEndpoint = requiredEnv("MB_TEE_RPC_URL").replace(/\/$/, "");
    const controller = controllerKeypair();
    const agent = web3.Keypair.generate();
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
    const amount = new anchor.BN(42);

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
        agent.publicKey,
        controller.publicKey,
        controller.publicKey
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
    const policyExpiry = new anchor.BN(
      (await controllerEr.connection.getSlot()) + 300
    );
    const permitExpiry = new anchor.BN(
      (await controllerEr.connection.getSlot()) + 50
    );
    await send(
      controllerEr,
      await program.methods
        .configurePolicy(
          1,
          program.programId,
          ACTION_DISCRIMINATOR,
          PAYLOAD_HASH,
          controller.publicKey,
          agent.publicKey,
          controller.publicKey,
          amount,
          amount,
          policyExpiry
        )
        .accountsPartial({ controller: controller.publicKey, policy })
        .transaction()
    );
    await send(
      agentEr,
      await program.methods
        .issuePermit(
          amount,
          permitExpiry,
          program.programId,
          ACTION_DISCRIMINATOR,
          PAYLOAD_HASH,
          agent.publicKey,
          controller.publicKey,
          controller.publicKey
        )
        .accountsPartial({ agent: agent.publicKey, policy, session })
        .transaction()
    );

    for (let attempt = 0; attempt < 120; attempt += 1) {
      if ((await controllerEr.connection.getSlot()) > permitExpiry.toNumber())
        break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if ((await controllerEr.connection.getSlot()) <= permitExpiry.toNumber())
      throw new Error("permit did not reach expiry during the gate");

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

    let expired = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const marker = await program.account.terminalMarker.fetchNullable(
        terminal
      );
      if (hasEnumVariant(marker?.kind, "expired")) {
        expired = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (!expired)
      throw new Error("expiry action did not publish its terminal marker");
    const publicReceipt = await program.account.settlementReceipt.fetch(
      receipt
    );
    if (
      Object.prototype.hasOwnProperty.call(publicReceipt, "amount") ||
      Object.prototype.hasOwnProperty.call(publicReceipt, "digest")
    )
      throw new Error("public expiry receipt contains private fields");

    await mustFailWith(
      send(
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
      ),
      "NoReservation",
      "expired permit was accepted for settlement"
    );
    await mustFailWith(
      send(
        base,
        await program.methods
          .expireAction(new anchor.BN(1), amount, Array(32).fill(1))
          .accountsPartial({
            receipt,
            terminal,
            sourceProgram: program.programId,
            escrowAuth: controller.publicKey,
            escrow,
          })
          .transaction()
      ),
      "signature",
      "expired terminal marker was replayable"
    );

    await program.methods
      .resetTerminal()
      .accountsPartial({ receipt, terminal, controller: controller.publicKey })
      .signers([controller])
      .rpc();
    const reopenedMarker = await program.account.terminalMarker.fetch(terminal);
    if (
      !hasEnumVariant(reopenedMarker.kind, "open") ||
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
    writeArtifact("leash-expiry-gate.json", {
      gate: "expiry-terminal",
      status: "passed",
      expiredTerminalPublished: true,
      settlementAfterExpiryRejected: true,
      expiryReplayRejected: true,
      publicReceiptHasAmount: false,
      publicReceiptHasDigest: false,
      transactions,
      accounts: [
        accountRef(policy, "Policy"),
        accountRef(session, "Session ledger"),
        accountRef(receipt, "Settlement receipt"),
        accountRef(terminal, "Terminal marker"),
      ],
    });
  });
});
