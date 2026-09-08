use anchor_lang::prelude::*;

declare_id!("3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe");

const MAX_PLAYERS: usize = 4;
const MAX_TICK: u32 = 72_000;
const MAX_FUTURE_TICKS: u32 = 2;
const MAX_AXIS: i16 = 100;
const AIM_DIRECTIONS: u8 = 8;

#[program]
pub mod contracts {
    use super::*;

    pub fn create_match(
        ctx: Context<CreateMatch>,
        match_id: u64,
        max_tick: u32,
        rules_hash: [u8; 32],
    ) -> Result<()> {
        require!(max_tick > 0 && max_tick <= MAX_TICK, ErrorCode::InvalidMatchConfig);

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
        require!(match_config.phase == MatchPhase::Created, ErrorCode::WrongPhase);
        require!(match_config.player_count < MAX_PLAYERS as u8, ErrorCode::MatchFull);

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
        require!(match_config.phase == MatchPhase::Ready, ErrorCode::WrongPhase);
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
        require!(match_config.phase == MatchPhase::Running, ErrorCode::WrongPhase);
        require!(sequence > 0 && sequence > ctx.accounts.input.last_sequence, ErrorCode::Replay);
        require!(
            target_tick > match_config.tick
                && target_tick <= match_config.tick.saturating_add(MAX_FUTURE_TICKS),
            ErrorCode::TickOutOfRange
        );
        require!(
            (-MAX_AXIS..=MAX_AXIS).contains(&move_x)
                && (-MAX_AXIS..=MAX_AXIS).contains(&move_y),
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

    // Intentionally blocked until the PER no-reader gate is proven. A public World
    // account here would make the stealth claim false, so gameplay cannot advance yet.
    pub fn advance_tick(_ctx: Context<AdvanceTick>) -> Result<()> {
        err!(ErrorCode::PrivateStateNotReady)
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
}
