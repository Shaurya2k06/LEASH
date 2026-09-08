import { PublicKey } from "@solana/web3.js";
import { requiredEnv } from "./artifact";

const PROGRAM_ID = new PublicKey(requiredEnv("LEASH_PROGRAM_ID"));

describe("LEASH PDA layout", () => {
  it("derives isolated policy and agent session addresses", () => {
    const controller = PublicKey.unique();
    const agent = PublicKey.unique();
    const policyId = Buffer.alloc(8);
    policyId.writeBigUInt64LE(1n);
    const [policy] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), controller.toBuffer(), policyId],
      PROGRAM_ID
    );
    const [session] = PublicKey.findProgramAddressSync(
      [Buffer.from("session"), policy.toBuffer(), agent.toBuffer()],
      PROGRAM_ID
    );
    if (policy.equals(session))
      throw new Error("policy and session must differ");
  });
});
