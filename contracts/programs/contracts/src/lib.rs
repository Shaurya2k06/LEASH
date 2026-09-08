use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::{CloseEphemeralPermissionCpi, CreateEphemeralPermissionCpi},
        structs::{
            EphemeralMembersArgs, EphemeralPermission, Member, PERMISSION_SEED, TX_BALANCES_FLAG,
            TX_LOGS_FLAG, TX_MESSAGE_FLAG,
        },
    },
    anchor::{commit, delegate, ephemeral},
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    cpi::DelegateConfig,
    ephem::MagicIntentBundleBuilder,
};

declare_id!("3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe");

const MAX_PLAYERS: usize = 4;
const MAX_TICK: u32 = 72_000;
const MAX_FUTURE_TICKS: u32 = 2;
const MAX_AXIS: i16 = 100;
const AIM_DIRECTIONS: u8 = 8;
pub const PROBE_SEED: &[u8] = b"probe";

#[ephemeral]
#[program]
pub mod contracts {
    use super::*;

    pub fn create_match(
        ctx: Context<CreateMatch>,
        match_id: u64,
        max_tick: u32,
        rules_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            max_tick > 0 && max_tick <= MAX_TICK,
            ErrorCode::InvalidMatchConfig
        );

        let match_config = &mut ctx.accounts.match_config;
        match_config.authority = ctx.accounts.authority.key();
        match_config.match_id = match_id;
        match_config.players = [Pubkey::default(); MAX_PLAYERS];
        match_config.player_count = 0;
        match_config.phase = MatchPhase::Created;
        match_config.tick = 0;
        match_config.max_tick = max_tick;
        match_config.rules_hash = rules_hash;
        match_config.bump = ctx.bumps.match_config;
        Ok(())
    }

    pub fn join_match(ctx: Context<JoinMatch>) -> Result<()> {
        let match_config = &mut ctx.accounts.match_config;
        require!(
            match_config.phase == MatchPhase::Created,
            ErrorCode::WrongPhase
        );
        require!(
            match_config.player_count < MAX_PLAYERS as u8,
            ErrorCode::MatchFull
        );

        let player = ctx.accounts.player.key();
        require!(
            !match_config.players[..match_config.player_count as usize].contains(&player),
            ErrorCode::DuplicatePlayer
        );

        let slot = match_config.player_count as usize;
        match_config.players[slot] = player;
        match_config.player_count += 1;
        if match_config.player_count == MAX_PLAYERS as u8 {
            match_config.phase = MatchPhase::Ready;
        }

        let input = &mut ctx.accounts.input;
        input.match_config = match_config.key();
        input.player = player;
        input.last_sequence = 0;
        input.pending = false;
        input.target_tick = 0;
        input.move_x = 0;
        input.move_y = 0;
        input.aim = 0;
        input.fire = false;
        input.bump = ctx.bumps.input;
        Ok(())
    }

    pub fn start_match(ctx: Context<StartMatch>) -> Result<()> {
        let match_config = &mut ctx.accounts.match_config;
        require!(
            match_config.phase == MatchPhase::Ready,
            ErrorCode::WrongPhase
        );
        match_config.phase = MatchPhase::Running;
        Ok(())
    }

    pub fn submit_input(
        ctx: Context<SubmitInput>,
        sequence: u64,
        target_tick: u32,
        move_x: i16,
        move_y: i16,
        aim: u8,
        fire: bool,
    ) -> Result<()> {
        let match_config = &ctx.accounts.match_config;
        require!(
            match_config.phase == MatchPhase::Running,
            ErrorCode::WrongPhase
        );
        require!(
            sequence > 0 && sequence > ctx.accounts.input.last_sequence,
            ErrorCode::Replay
        );
        require!(
            target_tick > match_config.tick
                && target_tick <= match_config.tick.saturating_add(MAX_FUTURE_TICKS),
            ErrorCode::TickOutOfRange
        );
        require!(
            (-MAX_AXIS..=MAX_AXIS).contains(&move_x) && (-MAX_AXIS..=MAX_AXIS).contains(&move_y),
            ErrorCode::InvalidInput
        );
        require!(aim < AIM_DIRECTIONS, ErrorCode::InvalidInput);
        require!(!ctx.accounts.input.pending, ErrorCode::InputPending);

        let input = &mut ctx.accounts.input;
        input.last_sequence = sequence;
        input.pending = true;
        input.target_tick = target_tick;
        input.move_x = move_x;
        input.move_y = move_y;
        input.aim = aim;
        input.fire = fire;
        Ok(())
    }

    // Phase 1 gate: gameplay cannot advance until a private World can be updated
    // without granting the crank or another player raw-world read access.
    pub fn advance_tick(_ctx: Context<AdvanceTick>) -> Result<()> {
        err!(ErrorCode::PrivateStateNotReady)
    }

    pub fn initialize_probe(ctx: Context<InitializeProbe>, secret: u64) -> Result<()> {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.probe.to_account_info(),
                },
            ),
            ephemeral_rollups_sdk::ephemeral_accounts::rent(EphemeralPermission::size_of(1) as u32),
        )?;

        let probe = &mut ctx.accounts.probe;
        probe.authority = ctx.accounts.authority.key();
        probe.secret = secret;
        probe.bump = ctx.bumps.probe;
        Ok(())
    }

    pub fn delegate_probe(ctx: Context<DelegateProbe>) -> Result<()> {
        if ctx.accounts.probe.owner != &ephemeral_rollups_sdk::id() {
            let validator = ctx.accounts.validator.as_ref();
            ctx.accounts.delegate_probe(
                &ctx.accounts.authority,
                &[PROBE_SEED, ctx.accounts.authority.key().as_ref()],
                DelegateConfig {
                    validator: validator.map(|account| account.key()),
                    ..Default::default()
                },
            )?;
        }
        Ok(())
    }

    pub fn init_probe_permission(ctx: Context<ProbePermissionContext>) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 {
            return Ok(());
        }

        let signers = [
            PROBE_SEED,
            ctx.accounts.probe.authority.as_ref(),
            &[ctx.accounts.probe.bump],
        ];
        CreateEphemeralPermissionCpi {
            payer: ctx.accounts.probe.to_account_info(),
            permissioned_account: ctx.accounts.probe.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: EphemeralMembersArgs {
                is_private: true,
                members: vec![Member {
                    flags: TX_LOGS_FLAG | TX_MESSAGE_FLAG | TX_BALANCES_FLAG,
                    pubkey: ctx.accounts.probe.authority,
                }],
            },
        }
        .invoke_signed(&[&signers])?;
        Ok(())
    }

    pub fn write_probe(ctx: Context<ProbeAuthority>, secret: u64) -> Result<()> {
        ctx.accounts.probe.secret = secret;
        Ok(())
    }

    pub fn scrub_probe(ctx: Context<ProbeAuthority>) -> Result<()> {
        ctx.accounts.probe.secret = 0;
        Ok(())
    }

    pub fn close_probe_permission(ctx: Context<ProbePermissionContext>) -> Result<()> {
        let signers = [
            PROBE_SEED,
            ctx.accounts.probe.authority.as_ref(),
            &[ctx.accounts.probe.bump],
        ];
        CloseEphemeralPermissionCpi {
            payer: ctx.accounts.probe.to_account_info(),
            permissioned_account: ctx.accounts.probe.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            authority: ctx.accounts.probe.to_account_info(),
            authority_is_signer: false,
        }
        .invoke_signed(&[&signers])?;
        Ok(())
    }

    pub fn undelegate_probe(ctx: Context<UndelegateProbe>) -> Result<()> {
        require!(ctx.accounts.probe.secret == 0, ErrorCode::ProbeNotScrubbed);
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.probe.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct CreateMatch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = MatchConfig::SPACE,
        seeds = [b"match", authority.key().as_ref(), &match_id.to_le_bytes()],
        bump
    )]
    pub match_config: Account<'info, MatchConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub match_config: Account<'info, MatchConfig>,
    #[account(
        init,
        payer = player,
        space = InputInbox::SPACE,
        seeds = [b"input", match_config.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub input: Account<'info, InputInbox>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartMatch<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub match_config: Account<'info, MatchConfig>,
}

#[derive(Accounts)]
pub struct SubmitInput<'info> {
    pub player: Signer<'info>,
    pub match_config: Account<'info, MatchConfig>,
    #[account(
        mut,
        seeds = [b"input", match_config.key().as_ref(), player.key().as_ref()],
        bump = input.bump,
        has_one = match_config,
        has_one = player
    )]
    pub input: Account<'info, InputInbox>,
}

#[derive(Accounts)]
pub struct AdvanceTick<'info> {
    pub submitter: Signer<'info>,
    pub match_config: Account<'info, MatchConfig>,
}

#[derive(Accounts)]
pub struct InitializeProbe<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PrivateProbe::SPACE,
        seeds = [PROBE_SEED, authority.key().as_ref()],
        bump
    )]
    pub probe: Account<'info, PrivateProbe>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateProbe<'info> {
    pub authority: Signer<'info>,
    /// CHECK: The probe PDA is checked by the delegation program.
    #[account(mut, del, seeds = [PROBE_SEED, authority.key().as_ref()], bump)]
    pub probe: UncheckedAccount<'info>,
    /// CHECK: Checked by the delegation program.
    pub validator: Option<UncheckedAccount<'info>>,
}

#[derive(Accounts)]
pub struct ProbeAuthority<'info> {
    #[account(mut, seeds = [PROBE_SEED, probe.authority.as_ref()], has_one = authority, bump = probe.bump)]
    pub probe: Account<'info, PrivateProbe>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ProbePermissionContext<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PROBE_SEED, probe.authority.as_ref()],
        has_one = authority,
        bump = probe.bump
    )]
    pub probe: Account<'info, PrivateProbe>,
    /// CHECK: Verified by the permission program using the canonical PDA.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, probe.key().as_ref()],
        bump,
        seeds::program = PERMISSION_PROGRAM_ID
    )]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Permission program address is fixed by the SDK.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: Ephemeral vault address is fixed by the SDK.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Magic program address is fixed by the SDK.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateProbe<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PROBE_SEED, probe.authority.as_ref()], bump = probe.bump)]
    pub probe: Account<'info, PrivateProbe>,
}

#[account]
pub struct MatchConfig {
    pub authority: Pubkey,
    pub match_id: u64,
    pub players: [Pubkey; MAX_PLAYERS],
    pub player_count: u8,
    pub phase: MatchPhase,
    pub tick: u32,
    pub max_tick: u32,
    pub rules_hash: [u8; 32],
    pub bump: u8,
}

impl MatchConfig {
    pub const SPACE: usize = 8 + 32 + 8 + (32 * MAX_PLAYERS) + 1 + 1 + 4 + 4 + 32 + 1;
}

#[account]
pub struct InputInbox {
    pub match_config: Pubkey,
    pub player: Pubkey,
    pub last_sequence: u64,
    pub pending: bool,
    pub target_tick: u32,
    pub move_x: i16,
    pub move_y: i16,
    pub aim: u8,
    pub fire: bool,
    pub bump: u8,
}

impl InputInbox {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1 + 4 + 2 + 2 + 1 + 1 + 1;
}

#[account]
pub struct PrivateProbe {
    pub authority: Pubkey,
    pub secret: u64,
    pub bump: u8,
}

impl PrivateProbe {
    pub const SPACE: usize = 32 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MatchPhase {
    Created,
    Ready,
    Running,
    Finished,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The match configuration is invalid.")]
    InvalidMatchConfig,
    #[msg("The match is not in the required phase.")]
    WrongPhase,
    #[msg("The match already has four players.")]
    MatchFull,
    #[msg("The player is already in this match.")]
    DuplicatePlayer,
    #[msg("The input sequence is a replay or is invalid.")]
    Replay,
    #[msg("The input tick is outside the accepted future window.")]
    TickOutOfRange,
    #[msg("The input values are outside the allowed bounds.")]
    InvalidInput,
    #[msg("A previous input is still pending for this player.")]
    InputPending,
    #[msg("Private state is not wired until the PER no-reader gate passes.")]
    PrivateStateNotReady,
    #[msg("The private probe must be scrubbed before undelegation.")]
    ProbeNotScrubbed,
}
