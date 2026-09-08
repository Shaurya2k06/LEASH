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
const MAX_LOBBY_PLAYERS: usize = 16;
const MAX_PROJECTILES: usize = 32;
const MAX_TICK: u32 = 72_000;
const MAX_FUTURE_TICKS: u32 = 2;
const MAX_AXIS: i16 = 100;
const AIM_DIRECTIONS: u8 = 8;
pub const LOBBY_SEED: &[u8] = b"lobby";
pub const MATCH_SEED: &[u8] = b"match";
pub const SPONSOR_SEED: &[u8] = b"sponsor";
pub const WORLD_SEED: &[u8] = b"world";
pub const INPUT_SEED: &[u8] = b"input";
pub const VIEW_SEED: &[u8] = b"view";
pub const RESULT_SEED: &[u8] = b"result";
pub const RATING_SEED: &[u8] = b"rating";
pub const SETTLEMENT_SEED: &[u8] = b"settlement";
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
        prize_mint: Pubkey,
        prize_amount: u64,
    ) -> Result<()> {
        require!(
            max_tick > 0
                && max_tick <= MAX_TICK
                && prize_mint != Pubkey::default()
                && prize_amount > 0,
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
        match_config.prize_mint = prize_mint;
        match_config.prize_amount = prize_amount;
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
        seeds = [MATCH_SEED, &match_id.to_le_bytes()],
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
        seeds = [INPUT_SEED, match_config.key().as_ref(), player.key().as_ref()],
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
        seeds = [INPUT_SEED, match_config.key().as_ref(), player.key().as_ref()],
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
    pub prize_mint: Pubkey,
    pub prize_amount: u64,
    pub bump: u8,
}

impl MatchConfig {
    pub const SPACE: usize = 8 + 32 + 8 + (32 * MAX_PLAYERS) + 1 + 1 + 4 + 4 + 32 + 32 + 8 + 1;
}

#[account]
pub struct LobbyQueue {
    pub players: [Pubkey; MAX_LOBBY_PLAYERS],
    pub player_count: u8,
    pub bump: u8,
}

impl LobbyQueue {
    pub const SPACE: usize = 8 + (32 * MAX_LOBBY_PLAYERS) + 1 + 1;
}

#[account]
pub struct MatchSponsor {
    pub match_config: Pubkey,
    pub authority: Pubkey,
    pub bump: u8,
}

impl MatchSponsor {
    pub const SPACE: usize = 8 + 32 + 32 + 1;
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct PlayerState {
    pub x: i32,
    pub y: i32,
    pub velocity_x: i16,
    pub velocity_y: i16,
    pub health: u16,
    pub cooldown_ticks: u16,
    pub aim: u8,
    pub alive: bool,
}

impl PlayerState {
    pub const SPACE: usize = 4 + 4 + 2 + 2 + 2 + 2 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct ProjectileState {
    pub active: bool,
    pub owner_index: u8,
    pub x: i32,
    pub y: i32,
    pub velocity_x: i16,
    pub velocity_y: i16,
    pub damage: u16,
    pub remaining_ticks: u16,
}

impl ProjectileState {
    pub const SPACE: usize = 1 + 1 + 4 + 4 + 2 + 2 + 2 + 2;
}

#[account]
pub struct World {
    pub match_config: Pubkey,
    pub authority: Pubkey,
    pub tick: u32,
    pub phase: MatchPhase,
    pub players: [PlayerState; MAX_PLAYERS],
    pub projectiles: [ProjectileState; MAX_PROJECTILES],
    pub scores: [u16; MAX_PLAYERS],
    pub secret_salt: [u8; 32],
    pub scrubbed: bool,
    pub bump: u8,
}

impl World {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 4
        + 1
        + (PlayerState::SPACE * MAX_PLAYERS)
        + (ProjectileState::SPACE * MAX_PROJECTILES)
        + (2 * MAX_PLAYERS)
        + 32
        + 1
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct VisibleEntity {
    pub visible: bool,
    pub player_index: u8,
    pub x: i32,
    pub y: i32,
    pub health: u16,
}

impl VisibleEntity {
    pub const SPACE: usize = 1 + 1 + 4 + 4 + 2;
}

#[account]
pub struct PlayerView {
    pub match_config: Pubkey,
    pub player: Pubkey,
    pub tick: u32,
    pub own_state: PlayerState,
    pub visible_players: [VisibleEntity; MAX_PLAYERS - 1],
    pub bump: u8,
}

impl PlayerView {
    pub const SPACE: usize =
        8 + 32 + 32 + 4 + PlayerState::SPACE + (VisibleEntity::SPACE * (MAX_PLAYERS - 1)) + 1;
}

#[account]
pub struct MatchResult {
    pub match_config: Pubkey,
    pub winner: Pubkey,
    pub scores: [u16; MAX_PLAYERS],
    pub final_tick: u32,
    pub rules_hash: [u8; 32],
    pub result_digest: [u8; 32],
    pub settlement_id: [u8; 32],
    pub settled: bool,
    pub bump: u8,
}

impl MatchResult {
    pub const SPACE: usize = 8 + 32 + 32 + (2 * MAX_PLAYERS) + 4 + 32 + 32 + 32 + 1 + 1;
}

#[account]
pub struct PlayerRating {
    pub player: Pubkey,
    pub games: u32,
    pub wins: u32,
    pub rating: i32,
    pub last_settled_match: Pubkey,
    pub bump: u8,
}

impl PlayerRating {
    pub const SPACE: usize = 8 + 32 + 4 + 4 + 4 + 32 + 1;
}

#[account]
pub struct SettlementMarker {
    pub settlement_id: [u8; 32],
    pub match_config: Pubkey,
    pub result_digest: [u8; 32],
    pub bump: u8,
}

impl SettlementMarker {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 1;
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
    Funded,
    Delegated,
    Ready,
    Running,
    Finished,
    Committing,
    Settled,
    Closed,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The match configuration is invalid.")]
    InvalidMatchConfig,
    #[msg("The signer is not authorized for this operation.")]
    Unauthorized,
    #[msg("The signer cannot read this player view.")]
    UnauthorizedView,
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
    #[msg("The match settlement caller is not authorized.")]
    UnauthorizedSettlement,
    #[msg("The match result has already been settled.")]
    AlreadySettled,
    #[msg("The result does not match the finished private state.")]
    InvalidResult,
    #[msg("An arithmetic operation overflowed.")]
    ArithmeticOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_accounts_are_fixed_size() {
        assert_eq!(World::SPACE, 767);
        assert_eq!(PlayerView::SPACE, 131);
        assert_eq!(InputInbox::SPACE, 92);
        assert_eq!(MatchResult::SPACE, 182);
    }
}
