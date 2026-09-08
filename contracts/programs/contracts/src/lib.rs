use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token::{self, Token, TokenAccount};
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::{CloseEphemeralPermissionCpi, CreateEphemeralPermissionCpi},
        structs::{
            EphemeralMembersArgs, EphemeralPermission, Member, PERMISSION_SEED, TX_BALANCES_FLAG,
            TX_LOGS_FLAG, TX_MESSAGE_FLAG,
        },
    },
    anchor::action,
    anchor::{commit, delegate, ephemeral},
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    cpi::DelegateConfig,
    ephem::MagicIntentBundleBuilder,
    ActionArgs, ShortAccountMeta,
};

declare_id!("3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe");

pub const POLICY_SEED: &[u8] = b"policy";
pub const SESSION_SEED: &[u8] = b"session";
pub const RECEIPT_SEED: &[u8] = b"receipt";
pub const TERMINAL_SEED: &[u8] = b"terminal";
pub const ACTION_ESCROW_INDEX: u8 = 255;
pub const MAX_TERMINAL_RECORDS: usize = 128;

#[ephemeral]
#[program]
pub mod contracts {
    use super::*;

    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        policy_id: u64,
        validator: Pubkey,
    ) -> Result<()> {
        require!(validator != Pubkey::default(), ErrorCode::InvalidPolicy);
        let policy = &mut ctx.accounts.policy;
        policy.controller = ctx.accounts.controller.key();
        policy.policy_id = policy_id;
        policy.validator = validator;
        policy.policy_version = 0;
        policy.allowed_program = Pubkey::default();
        policy.allowed_discriminator = [0; 8];
        policy.allowed_mint = Pubkey::default();
        policy.allowed_recipient = Pubkey::default();
        policy.allowed_source_vault = Pubkey::default();
        policy.max_permit = 0;
        policy.policy_hash = [0; 32];
        policy.remaining_budget = 0;
        policy.expires_at_slot = 0;
        policy.next_permit = 0;
        policy.scrubbed = true;
        policy.bump = ctx.bumps.policy;
        fund(
            &ctx.accounts.system_program,
            &ctx.accounts.controller,
            &policy.to_account_info(),
            1,
        )
    }

    pub fn create_session(ctx: Context<CreateSession>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        session.policy = ctx.accounts.policy.key();
        session.controller = ctx.accounts.policy.controller;
        session.agent = ctx.accounts.agent.key();
        session.validator = ctx.accounts.policy.validator;
        session.permit_nonce = 0;
        session.reserved_amount = 0;
        session.permit_expires_at_slot = 0;
        session.spent_amount = 0;
        session.pending_amount = 0;
        session.pending_program = Pubkey::default();
        session.pending_discriminator = [0; 8];
        session.pending_payload_hash = [0; 32];
        session.pending_digest = [0; 32];
        session.state = PermitState::Idle;
        session.scrubbed = true;
        session.bump = ctx.bumps.session;
        fund(
            &ctx.accounts.system_program,
            &ctx.accounts.agent,
            &session.to_account_info(),
            2,
        )
    }

    pub fn create_settlement_receipt(
        ctx: Context<CreateSettlementReceipt>,
        recipient: Pubkey,
        recipient_token: Pubkey,
        source_vault: Pubkey,
        mint: Pubkey,
    ) -> Result<()> {
        require!(
            recipient != Pubkey::default() && recipient_token != Pubkey::default(),
            ErrorCode::InvalidSettlement
        );
        require!(
            source_vault != Pubkey::default() && mint != Pubkey::default(),
            ErrorCode::InvalidSettlement
        );
        let receipt = &mut ctx.accounts.receipt;
        receipt.policy = ctx.accounts.policy.key();
        receipt.session = ctx.accounts.session.key();
        receipt.controller = ctx.accounts.controller.key();
        receipt.validator = ctx.accounts.policy.validator;
        receipt.recipient = recipient;
        receipt.recipient_token = recipient_token;
        receipt.source_vault = source_vault;
        receipt.mint = mint;
        receipt.nonce = 0;
        receipt.status = ReceiptStatus::Empty;
        receipt.bump = ctx.bumps.receipt;

        let terminal = &mut ctx.accounts.terminal;
        terminal.policy = ctx.accounts.policy.key();
        terminal.session = ctx.accounts.session.key();
        terminal.nonce = 0;
        terminal.amount = 0;
        terminal.digest = [0; 32];
        terminal.kind = TerminalKind::Open;
        terminal.history = Vec::new();
        terminal.bump = ctx.bumps.terminal;
        fund(
            &ctx.accounts.system_program,
            &ctx.accounts.controller,
            &receipt.to_account_info(),
            1,
        )
    }

    pub fn delegate_policy(ctx: Context<DelegatePolicy>, policy_id: u64) -> Result<()> {
        let validator = ctx
            .accounts
            .validator
            .as_ref()
            .ok_or_else(|| error!(ErrorCode::InvalidPolicy))?;
        {
            let data = ctx
                .accounts
                .policy
                .try_borrow_data()
                .map_err(|_| error!(ErrorCode::InvalidPolicy))?;
            let mut data_slice: &[u8] = &data;
            let policy = SecretPolicy::try_deserialize(&mut data_slice)
                .map_err(|_| error!(ErrorCode::InvalidPolicy))?;
            require_keys_eq!(policy.validator, validator.key(), ErrorCode::InvalidPolicy);
        }
        if ctx.accounts.policy.owner != &ephemeral_rollups_sdk::id() {
            ctx.accounts.delegate_policy(
                &ctx.accounts.controller,
                &[
                    POLICY_SEED,
                    ctx.accounts.controller.key().as_ref(),
                    &policy_id.to_le_bytes(),
                ],
                DelegateConfig {
                    validator: Some(validator.key()),
                    ..Default::default()
                },
            )?;
        }
        Ok(())
    }

    pub fn delegate_session(ctx: Context<DelegateSession>, policy: Pubkey) -> Result<()> {
        let validator = ctx
            .accounts
            .validator
            .as_ref()
            .ok_or_else(|| error!(ErrorCode::InvalidPolicy))?;
        {
            let data = ctx
                .accounts
                .session
                .try_borrow_data()
                .map_err(|_| error!(ErrorCode::InvalidPolicy))?;
            let mut data_slice: &[u8] = &data;
            let session = SessionLedger::try_deserialize(&mut data_slice)
                .map_err(|_| error!(ErrorCode::InvalidPolicy))?;
            require_keys_eq!(session.policy, policy, ErrorCode::InvalidPolicy);
            require_keys_eq!(session.validator, validator.key(), ErrorCode::InvalidPolicy);
        }
        if ctx.accounts.session.owner != &ephemeral_rollups_sdk::id() {
            ctx.accounts.delegate_session(
                &ctx.accounts.agent,
                &[
                    SESSION_SEED,
                    policy.as_ref(),
                    ctx.accounts.agent.key().as_ref(),
                ],
                DelegateConfig {
                    validator: Some(validator.key()),
                    ..Default::default()
                },
            )?;
        }
        Ok(())
    }

    pub fn delegate_receipt(ctx: Context<DelegateReceipt>, session: Pubkey) -> Result<()> {
        let receipt_validator = {
            let data = ctx
                .accounts
                .receipt
                .try_borrow_data()
                .map_err(|_| error!(ErrorCode::InvalidSettlement))?;
            let mut data_slice: &[u8] = &data;
            let receipt = SettlementReceipt::try_deserialize(&mut data_slice)
                .map_err(|_| error!(ErrorCode::InvalidSettlement))?;
            require_keys_eq!(receipt.session, session, ErrorCode::InvalidSettlement);
            require_keys_eq!(
                receipt.controller,
                ctx.accounts.controller.key(),
                ErrorCode::UnauthorizedSettlement
            );
            receipt.validator
        };
        let validator = ctx
            .accounts
            .validator
            .as_ref()
            .ok_or_else(|| error!(ErrorCode::InvalidPolicy))?;
        require_keys_eq!(receipt_validator, validator.key(), ErrorCode::InvalidPolicy);
        if ctx.accounts.receipt.owner != &ephemeral_rollups_sdk::id() {
            ctx.accounts.delegate_receipt(
                &ctx.accounts.controller,
                &[RECEIPT_SEED, session.as_ref()],
                DelegateConfig {
                    validator: Some(validator.key()),
                    ..Default::default()
                },
            )?;
        }
        Ok(())
    }

    pub fn init_receipt_permission(ctx: Context<ReceiptPermission>) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 {
            return Ok(());
        }
        let receipt = &ctx.accounts.receipt;
        let bump = [receipt.bump];
        CreateEphemeralPermissionCpi {
            payer: receipt.to_account_info(),
            permissioned_account: receipt.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: members(vec![receipt.controller]),
        }
        .invoke_signed(&[&[RECEIPT_SEED, receipt.session.as_ref(), &bump]])?;
        Ok(())
    }

    pub fn init_policy_permission(ctx: Context<PolicyPermission>) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 {
            return Ok(());
        }
        let policy = &ctx.accounts.policy;
        let id = policy.policy_id.to_le_bytes();
        let bump = [policy.bump];
        CreateEphemeralPermissionCpi {
            payer: policy.to_account_info(),
            permissioned_account: policy.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: members(vec![policy.controller]),
        }
        .invoke_signed(&[&[POLICY_SEED, policy.controller.as_ref(), &id, &bump]])?;
        Ok(())
    }

    pub fn init_session_permission(ctx: Context<SessionPermission>) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 {
            return Ok(());
        }
        let session = &ctx.accounts.session;
        let bump = [session.bump];
        CreateEphemeralPermissionCpi {
            payer: session.to_account_info(),
            permissioned_account: session.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: members(vec![session.controller, session.agent]),
        }
        .invoke_signed(&[&[
            SESSION_SEED,
            session.policy.as_ref(),
            session.agent.as_ref(),
            &bump,
        ]])?;
        Ok(())
    }

    pub fn configure_policy(
        ctx: Context<PolicyController>,
        policy_version: u8,
        allowed_program: Pubkey,
        allowed_discriminator: [u8; 8],
        allowed_mint: Pubkey,
        allowed_recipient: Pubkey,
        allowed_source_vault: Pubkey,
        max_permit: u64,
        budget: u64,
        expires_at_slot: u64,
    ) -> Result<()> {
        require!(
            policy_version == 1
                && allowed_program == crate::ID
                && allowed_discriminator != [0; 8]
                && allowed_mint != Pubkey::default()
                && allowed_recipient != Pubkey::default()
                && allowed_source_vault != Pubkey::default()
                && max_permit > 0
                && budget > 0,
            ErrorCode::InvalidPolicy
        );
        require!(expires_at_slot > Clock::get()?.slot, ErrorCode::Expired);
        let policy = &mut ctx.accounts.policy;
        require!(policy.scrubbed, ErrorCode::AlreadyConfigured);
        policy.policy_version = policy_version;
        policy.allowed_program = allowed_program;
        policy.allowed_discriminator = allowed_discriminator;
        policy.allowed_mint = allowed_mint;
        policy.allowed_recipient = allowed_recipient;
        policy.allowed_source_vault = allowed_source_vault;
        policy.max_permit = max_permit;
        policy.policy_hash = policy_hash(
            policy_version,
            allowed_program,
            allowed_discriminator,
            allowed_mint,
            allowed_recipient,
            allowed_source_vault,
            max_permit,
            expires_at_slot,
        );
        policy.remaining_budget = budget;
        policy.expires_at_slot = expires_at_slot;
        policy.next_permit = 0;
        policy.scrubbed = false;
        Ok(())
    }

    pub fn issue_permit(
        ctx: Context<SessionAgentPolicy>,
        amount: u64,
        expires_at_slot: u64,
        action_program: Pubkey,
        action_discriminator: [u8; 8],
        payload_hash: [u8; 32],
        recipient: Pubkey,
        mint: Pubkey,
        source_vault: Pubkey,
    ) -> Result<()> {
        reserve(
            &mut ctx.accounts.policy,
            &mut ctx.accounts.session,
            amount,
            expires_at_slot,
            action_program,
            action_discriminator,
            payload_hash,
            recipient,
            mint,
            source_vault,
            Clock::get()?.slot,
        )
    }

    pub fn settle_permit(ctx: Context<SettlePermit>) -> Result<()> {
        require!(
            ctx.accounts.session.state == PermitState::Reserved,
            ErrorCode::NoReservation
        );
        require!(
            Clock::get()?.slot <= ctx.accounts.session.permit_expires_at_slot,
            ErrorCode::Expired
        );
        require!(
            matches!(
                ctx.accounts.receipt.status,
                ReceiptStatus::Empty | ReceiptStatus::Settled | ReceiptStatus::Expired
            ),
            ErrorCode::AlreadySettled
        );
        let nonce = ctx.accounts.session.permit_nonce;
        require!(ctx.accounts.receipt.nonce < nonce, ErrorCode::Replay);
        require_keys_eq!(
            ctx.accounts.receipt.recipient,
            ctx.accounts.policy.allowed_recipient,
            ErrorCode::InvalidAction
        );
        require_keys_eq!(
            ctx.accounts.receipt.mint,
            ctx.accounts.policy.allowed_mint,
            ErrorCode::InvalidAction
        );
        require_keys_eq!(
            ctx.accounts.receipt.source_vault,
            ctx.accounts.policy.allowed_source_vault,
            ErrorCode::InvalidAction
        );
        ctx.accounts.terminal.kind = TerminalKind::Open;
        let receipt = &mut ctx.accounts.receipt;
        receipt.nonce = nonce;
        receipt.status = ReceiptStatus::Pending;
        Ok(())
    }

    pub fn commit_settlement(ctx: Context<CommitSettlement>) -> Result<()> {
        let receipt = &ctx.accounts.receipt;
        require!(
            receipt.status == ReceiptStatus::Pending,
            ErrorCode::InvalidSettlement
        );
        require!(
            ctx.accounts.session.state == PermitState::Reserved
                && ctx.accounts.session.permit_nonce == receipt.nonce,
            ErrorCode::NoReservation
        );
        require_keys_eq!(
            ctx.accounts.session.policy,
            ctx.accounts.policy.key(),
            ErrorCode::InvalidSettlement
        );
        let digest = settlement_digest(&ctx.accounts.policy, &ctx.accounts.session, receipt);
        close_receipt_permission(
            &ctx.accounts.receipt,
            &ctx.accounts.permission,
            &ctx.accounts.ephemeral_vault,
            &ctx.accounts.magic_program,
            &ctx.accounts.permission_program,
        )?;
        let action = settlement_action(
            receipt,
            &ctx.accounts.terminal,
            &ctx.accounts.controller,
            receipt.nonce,
            ctx.accounts.session.reserved_amount,
            digest,
        );
        MagicIntentBundleBuilder::new(
            ctx.accounts.controller.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[receipt.to_account_info()])
        .add_post_undelegate_actions([action])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn finalize_permit(ctx: Context<FinalizePermit>, nonce: u64) -> Result<()> {
        require!(
            ctx.accounts.receipt.status == ReceiptStatus::Settled
                && ctx.accounts.terminal.kind == TerminalKind::Spent
                && ctx.accounts.receipt.nonce == nonce
                && ctx.accounts.terminal.nonce == nonce,
            ErrorCode::InvalidSettlement
        );
        consume(&mut ctx.accounts.session, nonce, Clock::get()?.slot)
    }

    pub fn expire_permit(ctx: Context<ExpirePermit>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(
            session.state == PermitState::Reserved,
            ErrorCode::NoReservation
        );
        require!(
            Clock::get()?.slot > session.permit_expires_at_slot,
            ErrorCode::NotExpired
        );
        require!(
            matches!(
                ctx.accounts.receipt.status,
                ReceiptStatus::Empty | ReceiptStatus::Settled | ReceiptStatus::Expired
            ),
            ErrorCode::AlreadySettled
        );
        let amount = session.reserved_amount;
        let nonce = session.permit_nonce;
        require!(ctx.accounts.receipt.nonce < nonce, ErrorCode::Replay);
        let digest = settlement_digest(&ctx.accounts.policy, session, &ctx.accounts.receipt);
        ctx.accounts.policy.remaining_budget = ctx
            .accounts
            .policy
            .remaining_budget
            .checked_add(session.reserved_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        session.reserved_amount = 0;
        session.state = PermitState::Expired;
        session.pending_digest = digest;
        session.pending_amount = amount;
        ctx.accounts.terminal.kind = TerminalKind::Open;
        let receipt = &mut ctx.accounts.receipt;
        receipt.nonce = nonce;
        receipt.status = ReceiptStatus::Expired;
        Ok(())
    }

    pub fn commit_expiry(ctx: Context<CommitExpiry>) -> Result<()> {
        let receipt = &ctx.accounts.receipt;
        require!(
            receipt.status == ReceiptStatus::Expired,
            ErrorCode::InvalidSettlement
        );
        require!(
            ctx.accounts.session.state == PermitState::Expired
                && ctx.accounts.session.permit_nonce == receipt.nonce,
            ErrorCode::InvalidSettlement
        );
        close_receipt_permission(
            &ctx.accounts.receipt,
            &ctx.accounts.permission,
            &ctx.accounts.ephemeral_vault,
            &ctx.accounts.magic_program,
            &ctx.accounts.permission_program,
        )?;
        let action = ephemeral_rollups_sdk::ephem::CallHandler {
            args: ActionArgs::new(anchor_lang::InstructionData::data(
                &crate::instruction::ExpireAction {
                    nonce: receipt.nonce,
                    amount: ctx.accounts.session.pending_amount,
                    digest: ctx.accounts.session.pending_digest,
                },
            )),
            compute_units: 100_000,
            escrow_authority: ctx.accounts.controller.to_account_info(),
            destination_program: crate::ID,
            accounts: vec![
                ShortAccountMeta {
                    pubkey: receipt.key(),
                    is_writable: true,
                },
                ShortAccountMeta {
                    pubkey: ctx.accounts.terminal.key(),
                    is_writable: true,
                },
            ],
        };
        MagicIntentBundleBuilder::new(
            ctx.accounts.controller.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[receipt.to_account_info()])
        .add_post_undelegate_actions([action])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn scrub_policy(ctx: Context<PolicyController>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        policy.policy_hash = [0; 32];
        policy.remaining_budget = 0;
        policy.expires_at_slot = 0;
        policy.next_permit = 0;
        policy.scrubbed = true;
        Ok(())
    }

    pub fn scrub_session(ctx: Context<SessionController>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(
            session.state != PermitState::Reserved,
            ErrorCode::ReservationExists
        );
        session.reserved_amount = 0;
        session.permit_expires_at_slot = 0;
        session.spent_amount = 0;
        session.pending_amount = 0;
        session.pending_program = Pubkey::default();
        session.pending_discriminator = [0; 8];
        session.pending_payload_hash = [0; 32];
        session.pending_digest = [0; 32];
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
        .invoke_signed(&[&[
            SESSION_SEED,
            session.policy.as_ref(),
            session.agent.as_ref(),
            &bump,
        ]])?;
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

    pub fn settle_action(
        ctx: Context<SettleAction>,
        nonce: u64,
        amount: u64,
        digest: [u8; 32],
    ) -> Result<()> {
        let receipt = &mut ctx.accounts.receipt;
        require!(
            receipt.status == ReceiptStatus::Pending,
            ErrorCode::InvalidSettlement
        );
        require!(
            receipt.nonce == nonce && amount > 0 && nonce > 0,
            ErrorCode::InvalidSettlement
        );
        require!(digest != [0; 32], ErrorCode::InvalidSettlement);
        require_keys_eq!(
            receipt.controller,
            ctx.accounts.escrow_auth.key(),
            ErrorCode::UnauthorizedSettlement
        );
        require_keys_eq!(
            receipt.source_vault,
            ctx.accounts.source_vault.key(),
            ErrorCode::InvalidSettlement
        );
        require_keys_eq!(
            receipt.recipient_token,
            ctx.accounts.recipient_token.key(),
            ErrorCode::InvalidSettlement
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                token::Transfer {
                    from: ctx.accounts.source_vault.to_account_info(),
                    to: ctx.accounts.recipient_token.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
            ),
            amount,
        )?;

        let terminal = &mut ctx.accounts.terminal;
        require!(
            terminal.kind == TerminalKind::Open,
            ErrorCode::AlreadySettled
        );
        terminal.policy = receipt.policy;
        terminal.session = receipt.session;
        terminal.nonce = nonce;
        terminal.amount = amount;
        terminal.digest = digest;
        terminal.kind = TerminalKind::Spent;
        append_terminal_record(terminal, nonce, amount, digest, TerminalKind::Spent)?;
        receipt.status = ReceiptStatus::Settled;
        Ok(())
    }

    pub fn expire_action(
        ctx: Context<ExpireAction>,
        nonce: u64,
        amount: u64,
        digest: [u8; 32],
    ) -> Result<()> {
        let receipt = &mut ctx.accounts.receipt;
        require!(
            receipt.status == ReceiptStatus::Expired,
            ErrorCode::InvalidSettlement
        );
        require!(
            receipt.nonce == nonce && amount > 0 && nonce > 0,
            ErrorCode::InvalidSettlement
        );
        require!(digest != [0; 32], ErrorCode::InvalidSettlement);
        require_keys_eq!(
            receipt.controller,
            ctx.accounts.escrow_auth.key(),
            ErrorCode::UnauthorizedSettlement
        );
        let terminal = &mut ctx.accounts.terminal;
        require!(
            terminal.kind == TerminalKind::Open,
            ErrorCode::AlreadySettled
        );
        terminal.policy = receipt.policy;
        terminal.session = receipt.session;
        terminal.nonce = nonce;
        terminal.amount = amount;
        terminal.digest = digest;
        terminal.kind = TerminalKind::Expired;
        append_terminal_record(terminal, nonce, amount, digest, TerminalKind::Expired)?;
        Ok(())
    }
}

fn members(keys: Vec<Pubkey>) -> EphemeralMembersArgs {
    EphemeralMembersArgs {
        is_private: true,
        members: keys
            .into_iter()
            .map(|pubkey| Member {
                pubkey,
                flags: TX_LOGS_FLAG | TX_MESSAGE_FLAG | TX_BALANCES_FLAG,
            })
            .collect(),
    }
}

fn fund<'info>(
    system_program: &Program<'info, System>,
    payer: &Signer<'info>,
    recipient: &AccountInfo<'info>,
    members: usize,
) -> Result<()> {
    transfer(
        CpiContext::new(
            system_program.key(),
            Transfer {
                from: payer.to_account_info(),
                to: recipient.clone(),
            },
        ),
        ephemeral_rollups_sdk::ephemeral_accounts::rent(
            EphemeralPermission::size_of(members) as u32
        ),
    )
}

fn policy_hash(
    policy_version: u8,
    allowed_program: Pubkey,
    allowed_discriminator: [u8; 8],
    allowed_mint: Pubkey,
    allowed_recipient: Pubkey,
    allowed_source_vault: Pubkey,
    max_permit: u64,
    expires_at_slot: u64,
) -> [u8; 32] {
    Pubkey::find_program_address(
        &[
            b"leash-policy-v1",
            &[policy_version],
            allowed_program.as_ref(),
            &allowed_discriminator,
            allowed_mint.as_ref(),
            allowed_recipient.as_ref(),
            allowed_source_vault.as_ref(),
            &max_permit.to_le_bytes(),
            &expires_at_slot.to_le_bytes(),
        ],
        &crate::ID,
    )
    .0
    .to_bytes()
}

fn settlement_digest(
    policy: &SecretPolicy,
    session: &SessionLedger,
    receipt: &SettlementReceipt,
) -> [u8; 32] {
    Pubkey::find_program_address(
        &[
            b"leash-settlement-v1",
            policy.policy_hash.as_ref(),
            &session.permit_nonce.to_le_bytes(),
            &session.pending_amount.to_le_bytes(),
            session.pending_program.as_ref(),
            &session.pending_discriminator,
            session.pending_payload_hash.as_ref(),
            receipt.recipient.as_ref(),
            receipt.mint.as_ref(),
            receipt.source_vault.as_ref(),
        ],
        &crate::ID,
    )
    .0
    .to_bytes()
}

fn append_terminal_record(
    terminal: &mut TerminalMarker,
    nonce: u64,
    amount: u64,
    digest: [u8; 32],
    kind: TerminalKind,
) -> Result<()> {
    require!(
        terminal.history.len() < MAX_TERMINAL_RECORDS,
        ErrorCode::TerminalHistoryFull
    );
    terminal.history.push(TerminalRecord {
        nonce,
        amount,
        digest,
        kind,
    });
    Ok(())
}

fn close_receipt_permission<'info>(
    receipt: &Account<'info, SettlementReceipt>,
    permission: &AccountInfo<'info>,
    ephemeral_vault: &AccountInfo<'info>,
    magic_program: &AccountInfo<'info>,
    permission_program: &AccountInfo<'info>,
) -> Result<()> {
    let bump = [receipt.bump];
    CloseEphemeralPermissionCpi {
        payer: receipt.to_account_info(),
        permissioned_account: receipt.to_account_info(),
        permission: permission.clone(),
        vault: ephemeral_vault.clone(),
        magic_program: magic_program.clone(),
        permission_program: permission_program.clone(),
        authority: receipt.to_account_info(),
        authority_is_signer: false,
    }
    .invoke_signed(&[&[RECEIPT_SEED, receipt.session.as_ref(), &bump]])?;
    Ok(())
}

fn settlement_action<'info>(
    receipt: &Account<'info, SettlementReceipt>,
    terminal: &Account<'info, TerminalMarker>,
    controller: &Signer<'info>,
    nonce: u64,
    amount: u64,
    digest: [u8; 32],
) -> ephemeral_rollups_sdk::ephem::CallHandler<'info> {
    ephemeral_rollups_sdk::ephem::CallHandler {
        args: ActionArgs::new(anchor_lang::InstructionData::data(
            &crate::instruction::SettleAction {
                nonce,
                amount,
                digest,
            },
        )),
        compute_units: 200_000,
        escrow_authority: controller.to_account_info(),
        destination_program: crate::ID,
        accounts: vec![
            ShortAccountMeta {
                pubkey: receipt.key(),
                is_writable: true,
            },
            ShortAccountMeta {
                pubkey: terminal.key(),
                is_writable: true,
            },
            ShortAccountMeta {
                pubkey: receipt.source_vault,
                is_writable: true,
            },
            ShortAccountMeta {
                pubkey: receipt.recipient_token,
                is_writable: true,
            },
            ShortAccountMeta {
                pubkey: receipt.mint,
                is_writable: false,
            },
            ShortAccountMeta {
                pubkey: token::ID,
                is_writable: false,
            },
        ],
    }
}

fn reserve(
    policy: &mut SecretPolicy,
    session: &mut SessionLedger,
    amount: u64,
    expires_at_slot: u64,
    action_program: Pubkey,
    action_discriminator: [u8; 8],
    payload_hash: [u8; 32],
    recipient: Pubkey,
    mint: Pubkey,
    source_vault: Pubkey,
    now: u64,
) -> Result<()> {
    require!(!policy.scrubbed, ErrorCode::NotConfigured);
    require!(
        session.state != PermitState::Reserved,
        ErrorCode::ReservationExists
    );
    require!(
        amount > 0 && expires_at_slot > now && expires_at_slot <= policy.expires_at_slot,
        ErrorCode::InvalidPermit
    );
    require!(amount <= policy.max_permit, ErrorCode::InvalidAction);
    require_keys_eq!(
        action_program,
        policy.allowed_program,
        ErrorCode::InvalidAction
    );
    require!(
        action_discriminator == policy.allowed_discriminator,
        ErrorCode::InvalidAction
    );
    require!(payload_hash != [0; 32], ErrorCode::InvalidAction);
    require_keys_eq!(
        recipient,
        policy.allowed_recipient,
        ErrorCode::InvalidAction
    );
    require_keys_eq!(mint, policy.allowed_mint, ErrorCode::InvalidAction);
    require_keys_eq!(
        source_vault,
        policy.allowed_source_vault,
        ErrorCode::InvalidAction
    );
    policy.remaining_budget = policy
        .remaining_budget
        .checked_sub(amount)
        .ok_or(ErrorCode::BudgetExceeded)?;
    policy.next_permit = policy
        .next_permit
        .checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    session.permit_nonce = policy.next_permit;
    session.reserved_amount = amount;
    session.permit_expires_at_slot = expires_at_slot;
    session.pending_amount = amount;
    session.pending_program = action_program;
    session.pending_discriminator = action_discriminator;
    session.pending_payload_hash = payload_hash;
    session.state = PermitState::Reserved;
    session.scrubbed = false;
    Ok(())
}

fn consume(session: &mut SessionLedger, nonce: u64, now: u64) -> Result<()> {
    require!(
        session.state == PermitState::Reserved,
        ErrorCode::NoReservation
    );
    require!(session.permit_nonce == nonce, ErrorCode::Replay);
    require!(now <= session.permit_expires_at_slot, ErrorCode::Expired);
    session.spent_amount = session
        .spent_amount
        .checked_add(session.reserved_amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    session.reserved_amount = 0;
    session.state = PermitState::Spent;
    Ok(())
}

#[derive(Accounts)]
#[instruction(policy_id: u64)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub controller: Signer<'info>,
    #[account(init, payer = controller, space = 8 + SecretPolicy::SPACE, seeds = [POLICY_SEED, controller.key().as_ref(), &policy_id.to_le_bytes()], bump)]
    pub policy: Account<'info, SecretPolicy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSession<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    pub policy: Account<'info, SecretPolicy>,
    #[account(init, payer = agent, space = 8 + SessionLedger::SPACE, seeds = [SESSION_SEED, policy.key().as_ref(), agent.key().as_ref()], bump)]
    pub session: Account<'info, SessionLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSettlementReceipt<'info> {
    #[account(mut)]
    pub controller: Signer<'info>,
    #[account(has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    #[account(has_one = policy, has_one = controller)]
    pub session: Account<'info, SessionLedger>,
    #[account(init, payer = controller, space = 8 + SettlementReceipt::SPACE, seeds = [RECEIPT_SEED, session.key().as_ref()], bump)]
    pub receipt: Account<'info, SettlementReceipt>,
    #[account(init, payer = controller, space = 8 + TerminalMarker::SPACE, seeds = [TERMINAL_SEED, session.key().as_ref()], bump)]
    pub terminal: Account<'info, TerminalMarker>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(policy_id: u64)]
pub struct DelegatePolicy<'info> {
    #[account(mut)]
    pub controller: Signer<'info>,
    /// CHECK: checked by the delegation program and canonical PDA seeds.
    #[account(mut, del, seeds = [POLICY_SEED, controller.key().as_ref(), &policy_id.to_le_bytes()], bump)]
    pub policy: UncheckedAccount<'info>,
    /// CHECK: checked by the delegation program.
    pub validator: Option<UncheckedAccount<'info>>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(policy: Pubkey)]
pub struct DelegateSession<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    /// CHECK: checked by the delegation program and canonical PDA seeds.
    #[account(mut, del, seeds = [SESSION_SEED, policy.as_ref(), agent.key().as_ref()], bump)]
    pub session: UncheckedAccount<'info>,
    /// CHECK: checked by the delegation program.
    pub validator: Option<UncheckedAccount<'info>>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(session: Pubkey)]
pub struct DelegateReceipt<'info> {
    #[account(mut)]
    pub controller: Signer<'info>,
    /// CHECK: checked by the delegation program and canonical PDA seeds.
    #[account(mut, del, seeds = [RECEIPT_SEED, session.as_ref()], bump)]
    pub receipt: UncheckedAccount<'info>,
    /// CHECK: checked by the delegation program.
    pub validator: Option<UncheckedAccount<'info>>,
}

#[derive(Accounts)]
pub struct PolicyController<'info> {
    #[account(mut, has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    pub controller: Signer<'info>,
}

#[derive(Accounts)]
pub struct SessionController<'info> {
    #[account(mut, has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    #[account(mut, has_one = policy, has_one = controller)]
    pub session: Account<'info, SessionLedger>,
    pub controller: Signer<'info>,
}

#[derive(Accounts)]
pub struct SessionAgentPolicy<'info> {
    #[account(mut)]
    pub policy: Account<'info, SecretPolicy>,
    #[account(mut, has_one = policy, has_one = agent)]
    pub session: Account<'info, SessionLedger>,
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettlePermit<'info> {
    #[account(mut, has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    #[account(mut, has_one = policy, has_one = controller)]
    pub session: Account<'info, SessionLedger>,
    #[account(mut, seeds = [RECEIPT_SEED, session.key().as_ref()], bump = receipt.bump)]
    pub receipt: Account<'info, SettlementReceipt>,
    #[account(mut, seeds = [TERMINAL_SEED, session.key().as_ref()], bump = terminal.bump)]
    pub terminal: Account<'info, TerminalMarker>,
    pub controller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExpirePermit<'info> {
    #[account(mut, has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    #[account(mut, has_one = policy, has_one = controller)]
    pub session: Account<'info, SessionLedger>,
    #[account(mut, seeds = [RECEIPT_SEED, session.key().as_ref()], bump = receipt.bump)]
    pub receipt: Account<'info, SettlementReceipt>,
    #[account(mut, seeds = [TERMINAL_SEED, session.key().as_ref()], bump = terminal.bump)]
    pub terminal: Account<'info, TerminalMarker>,
    pub controller: Signer<'info>,
}

#[derive(Accounts)]
pub struct CommitSettlement<'info> {
    #[account(has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    #[account(mut, has_one = policy, has_one = controller)]
    pub session: Account<'info, SessionLedger>,
    #[account(mut, has_one = controller)]
    pub receipt: Account<'info, SettlementReceipt>,
    #[account(mut, seeds = [TERMINAL_SEED, receipt.session.as_ref()], bump = terminal.bump)]
    pub terminal: Account<'info, TerminalMarker>,
    pub controller: Signer<'info>,
    /// CHECK: canonical receipt permission PDA.
    #[account(mut, seeds = [PERMISSION_SEED, receipt.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed SDK vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed SDK permission program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed MagicBlock context account.
    #[account(mut)]
    pub magic_context: UncheckedAccount<'info>,
    /// CHECK: fixed MagicBlock program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CommitExpiry<'info> {
    #[account(has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    #[account(has_one = policy, has_one = controller)]
    pub session: Account<'info, SessionLedger>,
    #[account(mut, has_one = controller)]
    pub receipt: Account<'info, SettlementReceipt>,
    #[account(mut, seeds = [TERMINAL_SEED, receipt.session.as_ref()], bump = terminal.bump)]
    pub terminal: Account<'info, TerminalMarker>,
    pub controller: Signer<'info>,
    /// CHECK: canonical receipt permission PDA.
    #[account(mut, seeds = [PERMISSION_SEED, receipt.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed SDK vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed SDK permission program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed MagicBlock context account.
    #[account(mut)]
    pub magic_context: UncheckedAccount<'info>,
    /// CHECK: fixed MagicBlock program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct PolicyPermission<'info> {
    pub controller: Signer<'info>,
    #[account(mut, has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    /// CHECK: canonical permission PDA.
    #[account(mut, seeds = [PERMISSION_SEED, policy.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed SDK vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SessionPermission<'info> {
    pub agent: Signer<'info>,
    #[account(mut, has_one = agent)]
    pub session: Account<'info, SessionLedger>,
    /// CHECK: canonical permission PDA.
    #[account(mut, seeds = [PERMISSION_SEED, session.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed SDK vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ReceiptPermission<'info> {
    pub controller: Signer<'info>,
    #[account(mut, has_one = controller)]
    pub receipt: Account<'info, SettlementReceipt>,
    /// CHECK: canonical permission PDA.
    #[account(mut, seeds = [PERMISSION_SEED, receipt.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed SDK vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed SDK program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct FinalizePermit<'info> {
    #[account(has_one = controller)]
    pub policy: Account<'info, SecretPolicy>,
    #[account(mut, has_one = policy, has_one = controller)]
    pub session: Account<'info, SessionLedger>,
    #[account(has_one = controller, seeds = [RECEIPT_SEED, session.key().as_ref()], bump = receipt.bump)]
    pub receipt: Account<'info, SettlementReceipt>,
    #[account(seeds = [TERMINAL_SEED, session.key().as_ref()], bump = terminal.bump)]
    pub terminal: Account<'info, TerminalMarker>,
    pub controller: Signer<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegatePolicy<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, SecretPolicy>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub session: Account<'info, SessionLedger>,
}

#[action]
#[derive(Accounts)]
pub struct SettleAction<'info> {
    #[account(mut, seeds = [RECEIPT_SEED, receipt.session.as_ref()], bump = receipt.bump)]
    pub receipt: Box<Account<'info, SettlementReceipt>>,
    #[account(mut, seeds = [TERMINAL_SEED, receipt.session.as_ref()], bump)]
    pub terminal: Box<Account<'info, TerminalMarker>>,
    #[account(mut, address = receipt.source_vault, token::mint = mint, token::authority = escrow)]
    pub source_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = receipt.recipient_token, token::mint = mint, constraint = recipient_token.owner == receipt.recipient @ ErrorCode::InvalidSettlement)]
    pub recipient_token: Box<Account<'info, TokenAccount>>,
    #[account(address = receipt.mint)]
    pub mint: Box<Account<'info, anchor_spl::token::Mint>>,
    pub token_program: Program<'info, Token>,
    /// CHECK: fixed source-program account injected by the delegation program.
    #[account(address = crate::ID)]
    pub source_program: UncheckedAccount<'info>,
    /// CHECK: MagicBlock binds this account to the action's escrow PDA.
    #[account(address = receipt.controller)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: Only MagicBlock can sign for this derived escrow PDA.
    #[account(
        signer,
        address = ephemeral_rollups_sdk::pda::ephemeral_balance_pda_from_payer(
            &escrow_auth.key(),
            ACTION_ESCROW_INDEX,
        )
    )]
    pub escrow: UncheckedAccount<'info>,
}

#[action]
#[derive(Accounts)]
pub struct ExpireAction<'info> {
    #[account(mut, seeds = [RECEIPT_SEED, receipt.session.as_ref()], bump = receipt.bump)]
    pub receipt: Box<Account<'info, SettlementReceipt>>,
    #[account(mut, seeds = [TERMINAL_SEED, receipt.session.as_ref()], bump)]
    pub terminal: Box<Account<'info, TerminalMarker>>,
    /// CHECK: fixed source-program account injected by the delegation program.
    #[account(address = crate::ID)]
    pub source_program: UncheckedAccount<'info>,
    /// CHECK: MagicBlock binds this account to the action's escrow PDA.
    #[account(address = receipt.controller)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: Only MagicBlock can sign for this derived escrow PDA.
    #[account(
        signer,
        address = ephemeral_rollups_sdk::pda::ephemeral_balance_pda_from_payer(
            &escrow_auth.key(),
            ACTION_ESCROW_INDEX,
        )
    )]
    pub escrow: UncheckedAccount<'info>,
}

#[account]
pub struct SecretPolicy {
    pub controller: Pubkey,
    pub policy_id: u64,
    pub validator: Pubkey,
    pub policy_version: u8,
    pub allowed_program: Pubkey,
    pub allowed_discriminator: [u8; 8],
    pub allowed_mint: Pubkey,
    pub allowed_recipient: Pubkey,
    pub allowed_source_vault: Pubkey,
    pub max_permit: u64,
    pub policy_hash: [u8; 32],
    pub remaining_budget: u64,
    pub expires_at_slot: u64,
    pub next_permit: u64,
    pub scrubbed: bool,
    pub bump: u8,
}
impl SecretPolicy {
    pub const SPACE: usize = 32 + 8 + 32 + 1 + 32 + 8 + 32 + 32 + 32 + 8 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[account]
pub struct SessionLedger {
    pub policy: Pubkey,
    pub controller: Pubkey,
    pub agent: Pubkey,
    pub validator: Pubkey,
    pub permit_nonce: u64,
    pub reserved_amount: u64,
    pub permit_expires_at_slot: u64,
    pub spent_amount: u64,
    pub pending_amount: u64,
    pub pending_program: Pubkey,
    pub pending_discriminator: [u8; 8],
    pub pending_payload_hash: [u8; 32],
    pub pending_digest: [u8; 32],
    pub state: PermitState,
    pub scrubbed: bool,
    pub bump: u8,
}
impl SessionLedger {
    pub const SPACE: usize = 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 32 + 8 + 32 + 32 + 1 + 1 + 1;
}

#[account]
pub struct SettlementReceipt {
    pub policy: Pubkey,
    pub session: Pubkey,
    pub controller: Pubkey,
    pub validator: Pubkey,
    pub recipient: Pubkey,
    pub recipient_token: Pubkey,
    pub source_vault: Pubkey,
    pub mint: Pubkey,
    pub nonce: u64,
    pub status: ReceiptStatus,
    pub bump: u8,
}
impl SettlementReceipt {
    pub const SPACE: usize = 32 * 8 + 8 + 1 + 1;
}

#[account]
pub struct TerminalMarker {
    pub policy: Pubkey,
    pub session: Pubkey,
    pub nonce: u64,
    pub amount: u64,
    pub digest: [u8; 32],
    pub kind: TerminalKind,
    pub history: Vec<TerminalRecord>,
    pub bump: u8,
}
impl TerminalMarker {
    pub const SPACE: usize =
        32 * 2 + 8 + 8 + 32 + 1 + 4 + (8 + 8 + 32 + 1) * MAX_TERMINAL_RECORDS + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub struct TerminalRecord {
    pub nonce: u64,
    pub amount: u64,
    pub digest: [u8; 32],
    pub kind: TerminalKind,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PermitState {
    Idle,
    Reserved,
    Spent,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ReceiptStatus {
    Empty,
    Pending,
    Settled,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum TerminalKind {
    #[default]
    Open,
    Spent,
    Expired,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid policy.")]
    InvalidPolicy,
    #[msg("Invalid permit.")]
    InvalidPermit,
    #[msg("Action is not allowed by policy.")]
    InvalidAction,
    #[msg("Policy is already configured.")]
    AlreadyConfigured,
    #[msg("Policy is not configured.")]
    NotConfigured,
    #[msg("Budget exceeded.")]
    BudgetExceeded,
    #[msg("Reservation already exists.")]
    ReservationExists,
    #[msg("No reservation exists.")]
    NoReservation,
    #[msg("Permit expired.")]
    Expired,
    #[msg("Permit is not expired.")]
    NotExpired,
    #[msg("Permit replay.")]
    Replay,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
    #[msg("Private state must be scrubbed before undelegation.")]
    NotScrubbed,
    #[msg("Invalid settlement receipt.")]
    InvalidSettlement,
    #[msg("Settlement has already been consumed.")]
    AlreadySettled,
    #[msg("Magic Action escrow is not authorized.")]
    UnauthorizedSettlement,
    #[msg("Terminal history is full.")]
    TerminalHistoryFull,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn policy() -> SecretPolicy {
        SecretPolicy {
            controller: Pubkey::default(),
            policy_id: 1,
            validator: Pubkey::default(),
            policy_version: 1,
            allowed_program: Pubkey::default(),
            allowed_discriminator: [1; 8],
            allowed_mint: Pubkey::default(),
            allowed_recipient: Pubkey::default(),
            allowed_source_vault: Pubkey::default(),
            max_permit: 100,
            policy_hash: [1; 32],
            remaining_budget: 100,
            expires_at_slot: 100,
            next_permit: 0,
            scrubbed: false,
            bump: 0,
        }
    }
    fn session() -> SessionLedger {
        SessionLedger {
            policy: Pubkey::default(),
            controller: Pubkey::default(),
            agent: Pubkey::default(),
            validator: Pubkey::default(),
            permit_nonce: 0,
            reserved_amount: 0,
            permit_expires_at_slot: 0,
            spent_amount: 0,
            pending_amount: 0,
            pending_program: Pubkey::default(),
            pending_discriminator: [0; 8],
            pending_payload_hash: [0; 32],
            pending_digest: [0; 32],
            state: PermitState::Idle,
            scrubbed: true,
            bump: 0,
        }
    }
    #[test]
    fn permit_is_single_use() {
        let mut policy = policy();
        let mut session = session();
        reserve(
            &mut policy,
            &mut session,
            40,
            20,
            Pubkey::default(),
            [1; 8],
            [1; 32],
            Pubkey::default(),
            Pubkey::default(),
            Pubkey::default(),
            10,
        )
        .unwrap();
        assert_eq!(policy.remaining_budget, 60);
        assert!(consume(&mut session, 2, 11).is_err());
        consume(&mut session, 1, 11).unwrap();
        assert_eq!(session.spent_amount, 40);
        assert!(consume(&mut session, 1, 11).is_err());
    }
}
