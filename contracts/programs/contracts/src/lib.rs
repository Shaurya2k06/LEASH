use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::{CloseEphemeralPermissionCpi, CreateEphemeralPermissionCpi},
        structs::{EphemeralMembersArgs, EphemeralPermission, Member, PERMISSION_SEED, TX_BALANCES_FLAG, TX_LOGS_FLAG, TX_MESSAGE_FLAG},
    },
    anchor::{commit, delegate, ephemeral},
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    cpi::DelegateConfig,
    ephem::MagicIntentBundleBuilder,
};

declare_id!("3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe");

pub const POLICY_SEED: &[u8] = b"policy";
pub const SESSION_SEED: &[u8] = b"session";

#[ephemeral]
#[program]
pub mod contracts {
    use super::*;

    pub fn create_policy(ctx: Context<CreatePolicy>, policy_id: u64) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        policy.controller = ctx.accounts.controller.key();
        policy.policy_id = policy_id;
        policy.policy_hash = [0; 32];
        policy.remaining_budget = 0;
        policy.expires_at_slot = 0;
        policy.next_permit = 0;
        policy.scrubbed = true;
        policy.bump = ctx.bumps.policy;
        fund(&ctx.accounts.system_program, &ctx.accounts.controller, &policy.to_account_info(), 1)
    }

    pub fn create_session(ctx: Context<CreateSession>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        session.policy = ctx.accounts.policy.key();
        session.controller = ctx.accounts.policy.controller;
        session.agent = ctx.accounts.agent.key();
        session.permit_nonce = 0;
        session.reserved_amount = 0;
        session.permit_expires_at_slot = 0;
        session.spent_amount = 0;
        session.state = PermitState::Idle;
        session.scrubbed = true;
        session.bump = ctx.bumps.session;
        fund(&ctx.accounts.system_program, &ctx.accounts.agent, &session.to_account_info(), 2)
    }

    pub fn delegate_policy(ctx: Context<DelegatePolicy>, policy_id: u64) -> Result<()> {
        if ctx.accounts.policy.owner != &ephemeral_rollups_sdk::id() {
            ctx.accounts.delegate_policy(
                &ctx.accounts.controller,
                &[POLICY_SEED, ctx.accounts.controller.key().as_ref(), &policy_id.to_le_bytes()],
                DelegateConfig { validator: ctx.accounts.validator.as_ref().map(|v| v.key()), ..Default::default() },
            )?;
        }
        Ok(())
    }

    pub fn delegate_session(ctx: Context<DelegateSession>, policy: Pubkey) -> Result<()> {
        if ctx.accounts.session.owner != &ephemeral_rollups_sdk::id() {
            ctx.accounts.delegate_session(
                &ctx.accounts.agent,
                &[SESSION_SEED, policy.as_ref(), ctx.accounts.agent.key().as_ref()],
                DelegateConfig { validator: ctx.accounts.validator.as_ref().map(|v| v.key()), ..Default::default() },
            )?;
        }
        Ok(())
    }

    pub fn init_policy_permission(ctx: Context<PolicyPermission>) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 { return Ok(()); }
        let policy = &ctx.accounts.policy;
        let id = policy.policy_id.to_le_bytes();
        let bump = [policy.bump];
        CreateEphemeralPermissionCpi {
            payer: policy.to_account_info(), permissioned_account: policy.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(), vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(), permission_program: ctx.accounts.permission_program.to_account_info(),
            args: members(vec![policy.controller]),
        }.invoke_signed(&[&[POLICY_SEED, policy.controller.as_ref(), &id, &bump]])?;
        Ok(())
    }

    pub fn init_session_permission(ctx: Context<SessionPermission>) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 { return Ok(()); }
        let session = &ctx.accounts.session;
        let bump = [session.bump];
        CreateEphemeralPermissionCpi {
            payer: session.to_account_info(), permissioned_account: session.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(), vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(), permission_program: ctx.accounts.permission_program.to_account_info(),
            args: members(vec![session.controller, session.agent]),
        }.invoke_signed(&[&[SESSION_SEED, session.policy.as_ref(), session.agent.as_ref(), &bump]])?;
        Ok(())
    }

    pub fn configure_policy(ctx: Context<PolicyController>, hash: [u8; 32], budget: u64, expires_at_slot: u64) -> Result<()> {
        require!(hash != [0; 32] && budget > 0, ErrorCode::InvalidPolicy);
        require!(expires_at_slot > Clock::get()?.slot, ErrorCode::Expired);
        let policy = &mut ctx.accounts.policy;
        require!(policy.scrubbed, ErrorCode::AlreadyConfigured);
        policy.policy_hash = hash;
        policy.remaining_budget = budget;
        policy.expires_at_slot = expires_at_slot;
        policy.next_permit = 0;
        policy.scrubbed = false;
        Ok(())
    }

    pub fn issue_permit(ctx: Context<SessionController>, amount: u64, expires_at_slot: u64) -> Result<()> {
        reserve(&mut ctx.accounts.policy, &mut ctx.accounts.session, amount, expires_at_slot, Clock::get()?.slot)
    }

    pub fn consume_permit(ctx: Context<SessionAgent>, nonce: u64) -> Result<()> {
        consume(&mut ctx.accounts.session, nonce, Clock::get()?.slot)
    }

    pub fn expire_permit(ctx: Context<SessionController>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(session.state == PermitState::Reserved, ErrorCode::NoReservation);
        require!(Clock::get()?.slot > session.permit_expires_at_slot, ErrorCode::NotExpired);
        ctx.accounts.policy.remaining_budget = ctx.accounts.policy.remaining_budget.checked_add(session.reserved_amount).ok_or(ErrorCode::ArithmeticOverflow)?;
        session.reserved_amount = 0;
        session.state = PermitState::Expired;
        Ok(())
    }

    pub fn scrub_policy(ctx: Context<PolicyController>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        policy.policy_hash = [0; 32]; policy.remaining_budget = 0; policy.expires_at_slot = 0; policy.next_permit = 0; policy.scrubbed = true;
        Ok(())
    }

    pub fn scrub_session(ctx: Context<SessionController>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        session.reserved_amount = 0;
        session.permit_expires_at_slot = 0;
        session.spent_amount = 0;
        session.state = PermitState::Idle;
        session.scrubbed = true;
        Ok(())
    }

    pub fn close_policy_permission(ctx: Context<PolicyPermission>) -> Result<()> {
        let policy = &ctx.accounts.policy;
        let id = policy.policy_id.to_le_bytes();
        let bump = [policy.bump];
        CloseEphemeralPermissionCpi {
            payer: policy.to_account_info(),
            permissioned_account: policy.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            authority: policy.to_account_info(),
            authority_is_signer: false,
        }
        .invoke_signed(&[&[POLICY_SEED, policy.controller.as_ref(), &id, &bump]])?;
        Ok(())
    }

    pub fn close_session_permission(ctx: Context<SessionPermission>) -> Result<()> {
        let session = &ctx.accounts.session;
        let bump = [session.bump];
        CloseEphemeralPermissionCpi {
            payer: session.to_account_info(),
            permissioned_account: session.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            authority: session.to_account_info(),
            authority_is_signer: false,
        }
        .invoke_signed(&[&[SESSION_SEED, session.policy.as_ref(), session.agent.as_ref(), &bump]])?;
        Ok(())
    }

    pub fn undelegate_policy(ctx: Context<UndelegatePolicy>) -> Result<()> {
        require!(ctx.accounts.policy.scrubbed, ErrorCode::NotScrubbed);
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.policy.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn undelegate_session(ctx: Context<UndelegateSession>) -> Result<()> {
        require!(ctx.accounts.session.scrubbed, ErrorCode::NotScrubbed);
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.session.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

fn members(keys: Vec<Pubkey>) -> EphemeralMembersArgs {
    EphemeralMembersArgs { is_private: true, members: keys.into_iter().map(|pubkey| Member { pubkey, flags: TX_LOGS_FLAG | TX_MESSAGE_FLAG | TX_BALANCES_FLAG }).collect() }
}

fn fund<'info>(system_program: &Program<'info, System>, payer: &Signer<'info>, recipient: &AccountInfo<'info>, members: usize) -> Result<()> {
    transfer(CpiContext::new(system_program.key(), Transfer { from: payer.to_account_info(), to: recipient.clone() }), ephemeral_rollups_sdk::ephemeral_accounts::rent(EphemeralPermission::size_of(members) as u32))
}

fn reserve(policy: &mut SecretPolicy, session: &mut SessionLedger, amount: u64, expires_at_slot: u64, now: u64) -> Result<()> {
    require!(!policy.scrubbed, ErrorCode::NotConfigured);
    require!(session.state != PermitState::Reserved, ErrorCode::ReservationExists);
    require!(amount > 0 && expires_at_slot > now && expires_at_slot <= policy.expires_at_slot, ErrorCode::InvalidPermit);
    policy.remaining_budget = policy.remaining_budget.checked_sub(amount).ok_or(ErrorCode::BudgetExceeded)?;
    policy.next_permit = policy.next_permit.checked_add(1).ok_or(ErrorCode::ArithmeticOverflow)?;
    session.permit_nonce = policy.next_permit;
    session.reserved_amount = amount;
    session.permit_expires_at_slot = expires_at_slot;
    session.state = PermitState::Reserved;
    session.scrubbed = false;
    Ok(())
}

fn consume(session: &mut SessionLedger, nonce: u64, now: u64) -> Result<()> {
    require!(session.state == PermitState::Reserved, ErrorCode::NoReservation);
    require!(session.permit_nonce == nonce, ErrorCode::Replay);
    require!(now <= session.permit_expires_at_slot, ErrorCode::Expired);
    session.spent_amount = session.spent_amount.checked_add(session.reserved_amount).ok_or(ErrorCode::ArithmeticOverflow)?;
    session.reserved_amount = 0;
    session.state = PermitState::Spent;
    Ok(())
}

#[derive(Accounts)]
#[instruction(policy_id: u64)]
pub struct CreatePolicy<'info> {
    #[account(mut)] pub controller: Signer<'info>,
    #[account(init, payer = controller, space = 8 + SecretPolicy::SPACE, seeds = [POLICY_SEED, controller.key().as_ref(), &policy_id.to_le_bytes()], bump)] pub policy: Account<'info, SecretPolicy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSession<'info> {
    #[account(mut)] pub agent: Signer<'info>,
    pub policy: Account<'info, SecretPolicy>,
    #[account(init, payer = agent, space = 8 + SessionLedger::SPACE, seeds = [SESSION_SEED, policy.key().as_ref(), agent.key().as_ref()], bump)] pub session: Account<'info, SessionLedger>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(policy_id: u64)]
pub struct DelegatePolicy<'info> {
    #[account(mut)] pub controller: Signer<'info>,
    /// CHECK: checked by the delegation program and canonical PDA seeds.
    #[account(mut, del, seeds = [POLICY_SEED, controller.key().as_ref(), &policy_id.to_le_bytes()], bump)] pub policy: UncheckedAccount<'info>,
    /// CHECK: checked by the delegation program.
    pub validator: Option<UncheckedAccount<'info>>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(policy: Pubkey)]
pub struct DelegateSession<'info> {
    #[account(mut)] pub agent: Signer<'info>,
    /// CHECK: checked by the delegation program and canonical PDA seeds.
    #[account(mut, del, seeds = [SESSION_SEED, policy.as_ref(), agent.key().as_ref()], bump)] pub session: UncheckedAccount<'info>,
    /// CHECK: checked by the delegation program.
    pub validator: Option<UncheckedAccount<'info>>,
}

#[derive(Accounts)]
pub struct PolicyController<'info> {
    #[account(mut, has_one = controller)] pub policy: Account<'info, SecretPolicy>,
    pub controller: Signer<'info>,
}

#[derive(Accounts)]
pub struct SessionController<'info> {
    #[account(mut, has_one = controller)] pub policy: Account<'info, SecretPolicy>,
    #[account(mut, has_one = policy, has_one = controller)] pub session: Account<'info, SessionLedger>,
    pub controller: Signer<'info>,
}

#[derive(Accounts)]
pub struct SessionAgent<'info> {
    #[account(mut, has_one = agent)] pub session: Account<'info, SessionLedger>,
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct PolicyPermission<'info> {
    pub controller: Signer<'info>,
    #[account(mut, has_one = controller)] pub policy: Account<'info, SecretPolicy>,
    /// CHECK: canonical permission PDA.
    #[account(mut, seeds = [PERMISSION_SEED, policy.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)] pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = PERMISSION_PROGRAM_ID)] pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed SDK vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)] pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = MAGIC_PROGRAM_ID)] pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SessionPermission<'info> {
    pub agent: Signer<'info>,
    #[account(mut, has_one = agent)] pub session: Account<'info, SessionLedger>,
    /// CHECK: canonical permission PDA.
    #[account(mut, seeds = [PERMISSION_SEED, session.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)] pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = PERMISSION_PROGRAM_ID)] pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed SDK vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)] pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = MAGIC_PROGRAM_ID)] pub magic_program: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegatePolicy<'info> {
    #[account(mut)] pub payer: Signer<'info>,
    #[account(mut)] pub policy: Account<'info, SecretPolicy>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateSession<'info> {
    #[account(mut)] pub payer: Signer<'info>,
    #[account(mut)] pub session: Account<'info, SessionLedger>,
}

#[account]
pub struct SecretPolicy { pub controller: Pubkey, pub policy_id: u64, pub policy_hash: [u8; 32], pub remaining_budget: u64, pub expires_at_slot: u64, pub next_permit: u64, pub scrubbed: bool, pub bump: u8 }
impl SecretPolicy { pub const SPACE: usize = 32 + 8 + 32 + 8 + 8 + 8 + 1 + 1; }

#[account]
pub struct SessionLedger { pub policy: Pubkey, pub controller: Pubkey, pub agent: Pubkey, pub permit_nonce: u64, pub reserved_amount: u64, pub permit_expires_at_slot: u64, pub spent_amount: u64, pub state: PermitState, pub scrubbed: bool, pub bump: u8 }
impl SessionLedger { pub const SPACE: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1; }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PermitState { Idle, Reserved, Spent, Expired }

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid policy.")] InvalidPolicy,
    #[msg("Invalid permit.")] InvalidPermit,
    #[msg("Policy is already configured.")] AlreadyConfigured,
    #[msg("Policy is not configured.")] NotConfigured,
    #[msg("Budget exceeded.")] BudgetExceeded,
    #[msg("Reservation already exists.")] ReservationExists,
    #[msg("No reservation exists.")] NoReservation,
    #[msg("Permit expired.")] Expired,
    #[msg("Permit is not expired.")] NotExpired,
    #[msg("Permit replay.")] Replay,
    #[msg("Arithmetic overflow.")] ArithmeticOverflow,
    #[msg("Private state must be scrubbed before undelegation.")] NotScrubbed,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn policy() -> SecretPolicy { SecretPolicy { controller: Pubkey::default(), policy_id: 1, policy_hash: [1; 32], remaining_budget: 100, expires_at_slot: 100, next_permit: 0, scrubbed: false, bump: 0 } }
    fn session() -> SessionLedger { SessionLedger { policy: Pubkey::default(), controller: Pubkey::default(), agent: Pubkey::default(), permit_nonce: 0, reserved_amount: 0, permit_expires_at_slot: 0, spent_amount: 0, state: PermitState::Idle, scrubbed: true, bump: 0 } }
    #[test]
    fn permit_is_single_use() {
        let mut policy = policy(); let mut session = session();
        reserve(&mut policy, &mut session, 40, 20, 10).unwrap();
        assert_eq!(policy.remaining_budget, 60);
        assert!(consume(&mut session, 2, 11).is_err());
        consume(&mut session, 1, 11).unwrap();
        assert_eq!(session.spent_amount, 40);
        assert!(consume(&mut session, 1, 11).is_err());
    }
}
