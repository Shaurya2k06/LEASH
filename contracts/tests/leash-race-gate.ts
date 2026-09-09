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
const PERMISSION_VAULT = new web3.PublicKey(
  "MagicVau1t999999999999999999999999999999999"
);
const TEE_VALIDATOR = new web3.PublicKey(requiredEnv("MB_TEE_VALIDATOR"));
const ACTION_DISCRIMINATOR = [10, 58, 136, 98, 207, 113, 239, 90];
const PAYLOAD_HASH = Array(32).fill(8);
const AGENT_COUNT = 20;
const gate = process.env.LEASH_RACE_TEST === "1" ? describe : describe.skip;
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

gate("LEASH twenty-agent budget race gate", () => {
  it("allows exactly one reservation against the last budget", async () => {
    transactions.length = 0;
    const baseEndpoint = requiredEnv("SOLANA_RPC_URL");
    const teeEndpoint = requiredEnv("MB_TEE_RPC_URL").replace(/\/$/, "");
    const controller = controllerKeypair();
    const base = new anchor.AnchorProvider(
      new web3.Connection(baseEndpoint, { commitment: "confirmed" }),
      new anchor.Wallet(controller)
    );
    anchor.setProvider(base);
    const program = anchor.workspace.Contracts as Program<Contracts>;
    const policyId = new anchor.BN(Date.now());
    const amount = new anchor.BN(5_000);
    const agents = Array.from({ length: AGENT_COUNT }, () => {
      const agent = web3.Keypair.generate();
      return {
        agent,
        base: new anchor.AnchorProvider(
          base.connection,
          new anchor.Wallet(agent)
        ),
      };
    });
    const [policy] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(POLICY_SEED),
        controller.publicKey.toBuffer(),
        policyId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const sessions = agents.map(
      ({ agent }) =>
        web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from(SESSION_SEED),
            policy.toBuffer(),
            agent.publicKey.toBuffer(),
          ],
          program.programId
        )[0]
    );
    const receipts = sessions.map(
      (session) =>
        web3.PublicKey.findProgramAddressSync(
          [Buffer.from(RECEIPT_SEED), session.toBuffer()],
          program.programId
        )[0]
    );
    const terminals = sessions.map(
      (session) =>
        web3.PublicKey.findProgramAddressSync(
          [Buffer.from(TERMINAL_SEED), session.toBuffer()],
          program.programId
        )[0]
    );
    const policyPermission = permissionPdaFromAccount(policy);

    await verifyTeeRpcIntegrity(teeEndpoint);
    await base.sendAndConfirm(
      new web3.Transaction().add(
        ...agents.map(({ agent }) =>
          web3.SystemProgram.transfer({
            fromPubkey: controller.publicKey,
            toPubkey: agent.publicKey,
            lamports: 7_000_000,
          })
        )
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
    for (let index = 0; index < AGENT_COUNT; index += 1) {
      await program.methods
        .createSession()
        .accountsPartial({
          agent: agents[index].agent.publicKey,
          policy,
          controller: controller.publicKey,
          session: sessions[index],
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([agents[index].agent, controller])
        .rpc();
    }
    for (let index = 0; index < AGENT_COUNT; index += 1) {
      await program.methods
        .createSettlementReceipt(
          controller.publicKey,
          controller.publicKey,
          controller.publicKey,
          program.programId
        )
        .accountsPartial({
          controller: controller.publicKey,
          policy,
          session: sessions[index],
          receipt: receipts[index],
          terminal: terminals[index],
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([controller])
        .rpc();
    }
    for (let index = 0; index < AGENT_COUNT; index += 1) {
      await send(
        agents[index].base,
        await program.methods
          .delegateSession(policy)
          .accountsPartial({
            agent: agents[index].agent.publicKey,
            session: sessions[index],
            validator: TEE_VALIDATOR,
          })
          .transaction()
      );
    }
    await program.methods
      .delegatePolicy(policyId)
      .accountsPartial({
        controller: controller.publicKey,
        policy,
        validator: TEE_VALIDATOR,
      })
      .signers([controller])
      .rpc();
    await new Promise((resolve) => setTimeout(resolve, 4_000));

    const controllerEr = await providerFor(teeEndpoint, controller);
    const agentErs = await Promise.all(
      agents.map(({ agent }) => providerFor(teeEndpoint, agent))
    );
    await send(
      controllerEr,
      await program.methods
        .initPolicyPermission(agents.map(({ agent }) => agent.publicKey))
        .accountsPartial({
          controller: controller.publicKey,
          policy,
          permission: policyPermission,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          ephemeralVault: PERMISSION_VAULT,
          systemProgram: web3.SystemProgram.programId,
        })
        .transaction()
    );
    await Promise.all(
      agents.map(async ({ agent }, index) =>
        send(
          agentErs[index],
          await program.methods
            .initSessionPermission()
            .accountsPartial({
              agent: agent.publicKey,
              session: sessions[index],
              permission: permissionPdaFromAccount(sessions[index]),
              magicProgram: MAGIC_PROGRAM_ID,
              permissionProgram: PERMISSION_PROGRAM_ID,
              ephemeralVault: PERMISSION_VAULT,
            })
            .transaction()
        )
      )
    );

    const raceStartSlot = await controllerEr.connection.getSlot();
    const policyExpiresAt = new anchor.BN(raceStartSlot + 2_000);
    const permitExpiresAt = new anchor.BN(raceStartSlot + 1_999);
    await send(
      controllerEr,
      await program.methods
        .configurePolicy(
          1,
          program.programId,
          ACTION_DISCRIMINATOR,
          PAYLOAD_HASH,
          program.programId,
          controller.publicKey,
          controller.publicKey,
          amount,
          amount,
          policyExpiresAt
        )
        .accountsPartial({ controller: controller.publicKey, policy })
        .transaction()
    );
    const attempts = await Promise.all(
      sessions.map(async (session, index) => {
        try {
          await send(
            agentErs[index],
            await program.methods
              .issuePermit(
                amount,
                permitExpiresAt,
                program.programId,
                ACTION_DISCRIMINATOR,
                PAYLOAD_HASH,
                controller.publicKey,
                program.programId,
                controller.publicKey
              )
              .accountsPartial({
                agent: agents[index].agent.publicKey,
                policy,
                session,
              })
              .transaction()
          );
          return true;
        } catch (error) {
          if (!String(error).toLowerCase().includes("budgetexceeded"))
            throw new Error(
              `race loser ${index} failed for an unexpected reason: ${String(
                error
              )}`
            );
          return false;
        }
      })
    );
    if (attempts.filter(Boolean).length !== 1)
      throw new Error(
        `expected one successful race attempt, got ${
          attempts.filter(Boolean).length
        }`
      );

    const ledgers = await Promise.all(
      sessions.map(async (session) => {
        const info = await controllerEr.connection.getAccountInfo(session);
        if (!info) throw new Error("private session disappeared during race");
        return program.coder.accounts.decode("sessionLedger", info.data);
      })
    );
    const reserved = ledgers.filter((ledger) =>
      hasEnumVariant(ledger.state, "reserved")
    );
    if (reserved.length !== 1)
      throw new Error(`expected one reserved session, got ${reserved.length}`);
    if (!reserved.every((ledger) => ledger.reservedAmount.eq(amount)))
      throw new Error("winning reservation amount changed");
    if (
      ledgers.filter((ledger) => ledger.reservedAmount.isZero()).length !==
      AGENT_COUNT - 1
    )
      throw new Error("a losing race attempt mutated its reservation");

    const loserIndex = ledgers.findIndex((ledger) =>
      hasEnumVariant(ledger.state, "idle")
    );
    await mustFailWith(
      send(
        agentErs[loserIndex],
        await program.methods
          .issuePermit(
            new anchor.BN(1),
            policyExpiresAt,
            program.programId,
            ACTION_DISCRIMINATOR,
            PAYLOAD_HASH,
            controller.publicKey,
            program.programId,
            controller.publicKey
          )
          .accountsPartial({
            agent: agents[loserIndex].agent.publicKey,
            policy,
            session: sessions[loserIndex],
          })
          .transaction()
      ),
      "BudgetExceeded",
      "losing reservation did not return the exact budget error"
    );

    const winnerIndex = ledgers.findIndex((ledger) =>
      hasEnumVariant(ledger.state, "reserved")
    );
    const winnerReceipt = receipts[winnerIndex];
    const winnerTerminal = terminals[winnerIndex];
    const winnerPermission = permissionPdaFromAccount(winnerReceipt);
    await program.methods
      .delegateReceipt(sessions[winnerIndex])
      .accountsPartial({
        controller: controller.publicKey,
        receipt: winnerReceipt,
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
          receipt: winnerReceipt,
          permission: winnerPermission,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          ephemeralVault: PERMISSION_VAULT,
        })
        .transaction()
    );
    while (
      (await controllerEr.connection.getSlot()) <= permitExpiresAt.toNumber()
    )
      await new Promise((resolve) => setTimeout(resolve, 500));
    await send(
      controllerEr,
      await program.methods
        .expirePermit()
        .accountsPartial({
          policy,
          session: sessions[winnerIndex],
          receipt: winnerReceipt,
          terminal: winnerTerminal,
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
          session: sessions[winnerIndex],
          receipt: winnerReceipt,
          terminal: winnerTerminal,
          controller: controller.publicKey,
          permission: winnerPermission,
          ephemeralVault: PERMISSION_VAULT,
          permissionProgram: PERMISSION_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
        })
        .transaction()
    );

    await Promise.all(
      sessions.map(async (session) =>
        send(
          controllerEr,
          await program.methods
            .scrubSession()
            .accountsPartial({
              controller: controller.publicKey,
              policy,
              session,
            })
            .transaction()
        )
      )
    );
    await send(
      controllerEr,
      await program.methods
        .scrubPolicy()
        .accountsPartial({ controller: controller.publicKey, policy })
        .transaction()
    );
    await Promise.all(
      agents.map(async ({ agent }, index) =>
        send(
          agentErs[index],
          await program.methods
            .closeSessionPermission()
            .accountsPartial({
              agent: agent.publicKey,
              session: sessions[index],
              permission: permissionPdaFromAccount(sessions[index]),
              magicProgram: MAGIC_PROGRAM_ID,
              permissionProgram: PERMISSION_PROGRAM_ID,
              ephemeralVault: PERMISSION_VAULT,
            })
            .transaction()
        )
      )
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
          ephemeralVault: PERMISSION_VAULT,
        })
        .transaction()
    );
    await Promise.all(
      agents.map(async ({ agent }, index) =>
        send(
          agentErs[index],
          await program.methods
            .undelegateSession()
            .accountsPartial({
              payer: agent.publicKey,
              session: sessions[index],
            })
            .transaction()
        )
      )
    );
    await send(
      controllerEr,
      await program.methods
        .undelegatePolicy()
        .accountsPartial({ payer: controller.publicKey, policy })
        .transaction()
    );
    writeArtifact("leash-race-gate.json", {
      gate: "twenty-session-budget-race",
      status: "passed",
      contenders: AGENT_COUNT,
      successfulReservations: attempts.filter(Boolean).length,
      losingReservations: attempts.filter((attempt) => !attempt).length,
      exactBudgetPreserved: true,
      transactions,
      accounts: [
        accountRef(policy, "Policy"),
        accountRef(sessions[winnerIndex], "Winning session ledger"),
        accountRef(winnerReceipt, "Winning settlement receipt"),
        accountRef(winnerTerminal, "Winning terminal marker"),
      ],
    });
  });
});
