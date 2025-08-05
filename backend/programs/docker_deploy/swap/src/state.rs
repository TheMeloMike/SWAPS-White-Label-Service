use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};
use std::collections::HashSet;

/// Program version for upgrades
pub const PROGRAM_VERSION: u32 = 1;

/// Maximum number of participants allowed in a single transaction
/// This is limited by Solana's account limit (64) and the accounts needed per step (5)
pub const MAX_PARTICIPANTS_PER_TRANSACTION: u8 = 11;

/// Maximum number of NFTs allowed per step
pub const MAX_NFTS_PER_STEP: u8 = 4;

/// Maximum timeout for trade loops (30 days in seconds)
pub const MAX_TIMEOUT_SECONDS: u64 = 30 * 24 * 60 * 60;

/// Current status of a trade step
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub enum StepStatus {
    /// Step has been created but not approved
    Created,
    /// Step has been approved by the sender
    Approved,
    /// Step has been executed (NFTs transferred)
    Executed,
}

/// Trade step in a trade loop
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct TradeStep {
    /// Sender wallet address (from)
    pub from: Pubkey,
    /// Recipient wallet address (to)
    pub to: Pubkey,
    /// NFT mint addresses to be transferred
    pub nft_mints: Vec<Pubkey>,
    /// Current status of this step
    pub status: StepStatus,
}

/// Trade loop state
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct TradeLoop {
    /// Is initialized
    pub is_initialized: bool,
    /// Unique identifier for this trade loop
    pub trade_id: [u8; 32],
    /// Unix timestamp when this trade loop was created
    pub created_at: u64,
    /// Unix timestamp when this trade loop expires
    pub expires_at: u64,
    /// Steps in the trade loop
    pub steps: Vec<TradeStep>,
    /// Authority that can cancel this trade loop (usually the creator)
    pub authority: Pubkey,
}

impl Sealed for TradeLoop {}

impl IsInitialized for TradeLoop {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl TradeLoop {
    /// Calculate space needed for this trade loop
    pub fn get_space(step_count: u8, max_nfts_per_step: u8) -> usize {
        // Base size: is_initialized(1) + trade_id(32) + created_at(8) + expires_at(8) + authority(32)
        let base_size = 1 + 32 + 8 + 8 + 32;
        
        // Vector header for steps: 4 bytes
        let steps_header_size = 4;
        
        // Each step: from(32) + to(32) + status(1) + vector header for nft_mints(4)
        let step_base_size = 32 + 32 + 1 + 4;
        
        // Each NFT mint: 32 bytes
        let nft_mint_size = 32;
        
        // Ensure we don't exceed the maximum participants
        let actual_step_count = std::cmp::min(step_count, MAX_PARTICIPANTS_PER_TRANSACTION);
        
        // Ensure we don't exceed the maximum NFTs per step
        let actual_max_nfts = std::cmp::min(max_nfts_per_step, MAX_NFTS_PER_STEP);
        
        // Total size
        base_size + steps_header_size + (actual_step_count as usize * (step_base_size + (actual_max_nfts as usize * nft_mint_size)))
    }
    
    /// Verify that the trade loop forms a valid cycle
    pub fn verify_loop(&self) -> bool {
        if self.steps.is_empty() {
            return false;
        }
        
        // Check that the loop closes - last recipient must be first sender
        if self.steps.last().unwrap().to != self.steps.first().unwrap().from {
            return false;
        }
        
        // Check that each step's recipient is the next step's sender
        for i in 0..self.steps.len() - 1 {
            if self.steps[i].to != self.steps[i + 1].from {
                return false;
            }
        }
        
        // Check that all participants in the loop are unique
        let mut unique_participants = HashSet::new();
        for step in &self.steps {
            unique_participants.insert(step.from);
        }
        
        // At least 2 unique participants required for a valid loop
        unique_participants.len() >= 2
    }
    
    /// Check if all steps are approved and ready for execution
    pub fn is_ready_for_execution(&self) -> bool {
        self.steps.iter().all(|step| step.status == StepStatus::Approved)
    }
    
    /// Check if the trade loop has expired
    pub fn is_expired(&self, current_time: u64) -> bool {
        current_time >= self.expires_at
    }
}

/// Program upgrade authority configuration
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct ProgramConfig {
    /// Is initialized
    pub is_initialized: bool,
    /// Current program version
    pub version: u32,
    /// Upgrade authority (can deploy new versions)
    pub upgrade_authority: Pubkey,
    /// Optional: A multi-sig governance account for decentralized upgrades
    pub governance: Option<Pubkey>,
    /// Whether the program is currently paused (emergency stop)
    pub paused: bool,
}

impl Sealed for ProgramConfig {}

impl IsInitialized for ProgramConfig {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
} 