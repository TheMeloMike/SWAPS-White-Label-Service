use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    program_error::ProgramError,
    pubkey::Pubkey,
};
use crate::error::SwapError;

/// Instructions supported by the NFT Swap program
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub enum SwapInstruction {
    /// Initializes a new trade loop
    ///
    /// Accounts expected:
    /// 0. `[signer]` The account initializing the trade loop (payer)
    /// 1. `[writable]` The trade loop state account
    /// 2. `[]` Rent sysvar
    /// 3. `[]` System program
    InitializeTradeLoop {
        /// Unique identifier for the trade loop
        trade_id: [u8; 32],
        /// The total number of steps in this trade loop
        step_count: u8,
        /// Timeout in seconds from initialization
        timeout_seconds: u64,
    },

    /// Adds a step to an existing trade loop
    ///
    /// Accounts expected:
    /// 0. `[signer]` The account adding the step (must match the 'from' address)
    /// 1. `[writable]` The trade loop state account
    /// 2. `[]` Token program
    /// 3+ Token accounts for verification (for each NFT mint):
    ///     - NFT mint address
    ///     - Sender's token account for this NFT (must own the NFT)
    AddTradeStep {
        /// The index of this step in the trade loop (0-based)
        step_index: u8,
        /// The recipient of the NFT(s) in this step
        to: Pubkey,
        /// The mint addresses of NFTs being transferred
        nft_mints: Vec<Pubkey>,
    },

    /// Approves a trade step (as the sender)
    ///
    /// Accounts expected:
    /// 0. `[signer]` The sender approving the trade
    /// 1. `[writable]` The trade loop state account
    /// 2. `[]` Clock sysvar
    ApproveTradeStep {
        /// The index of the step to approve
        step_index: u8,
    },

    /// Executes a single trade step (transfers NFTs)
    ///
    /// Accounts expected:
    /// 0. `[signer]` The account executing the trade (can be anyone once approved)
    /// 1. `[writable]` The trade loop state account
    /// 2. `[]` The sender's wallet
    /// 3. `[]` The recipient's wallet
    /// 4. `[]` Token program
    /// 5. `[]` Associated token program
    /// 6+ NFT accounts and token accounts (varies based on step) in pairs:
    ///     - NFT mint address
    ///     - Sender's token account for this NFT
    ///     - Recipient's token account for this NFT (will be created if needed)
    ExecuteTradeStep {
        /// The index of the step to execute
        step_index: u8,
    },

    /// Executes an atomic multi-step trade (executes multiple steps at once)
    ///
    /// Accounts expected:
    /// 0. `[signer]` The account executing the trade (can be anyone once all approved)
    /// 1. `[writable]` The trade loop state account
    /// Many accounts required for each step - specific structure varies based on trade loop composition
    ExecuteFullTradeLoop {},

    /// Cancels a trade loop
    ///
    /// Accounts expected:
    /// 0. `[signer]` Any participant in the trade loop
    /// 1. `[writable]` The trade loop state account
    CancelTradeLoop {},

    /// Initializes the program configuration
    ///
    /// Accounts expected:
    /// 0. `[signer]` The upgrade authority (payer)
    /// 1. `[writable]` The program config account
    /// 2. `[]` Rent sysvar
    /// 3. `[]` System program
    InitializeProgramConfig {
        /// Optional: multisig governance address for decentralized upgrades
        governance: Option<Pubkey>,
    },

    /// Updates the program configuration
    ///
    /// Accounts expected:
    /// 0. `[signer]` The current upgrade authority
    /// 1. `[writable]` The program config account 
    UpdateProgramConfig {
        /// New upgrade authority (None to keep the same)
        new_upgrade_authority: Option<Pubkey>,
        /// New governance address (None to keep the same)
        new_governance: Option<Pubkey>,
        /// New pause state (None to keep the same)
        new_paused_state: Option<bool>,
    },

    /// Updates the program to a new implementation
    ///
    /// Accounts expected:
    /// 0. `[signer]` The upgrade authority
    /// 1. `[writable]` The program data account
    /// 2. `[]` The program account
    /// 3. `[]` The buffer containing the new program
    /// 4. `[]` Rent sysvar
    /// 5. `[]` Clock sysvar
    /// 6. `[]` BPF Loader Upgradeable program
    UpgradeProgram {
        /// New program version
        new_program_version: u32,
    },
}

impl SwapInstruction {
    /// Unpacks a byte buffer into a SwapInstruction
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(SwapError::InvalidInstructionData)?;
        
        Ok(match tag {
            0 => {
                let trade_id: [u8; 32] = rest[..32].try_into().map_err(|_| SwapError::InvalidInstructionData)?;
                let step_count = rest[32];
                let timeout_seconds = u64::from_le_bytes(rest[33..41].try_into().map_err(|_| SwapError::InvalidInstructionData)?);
                
                Self::InitializeTradeLoop {
                    trade_id,
                    step_count,
                    timeout_seconds,
                }
            },
            1 => Self::AddTradeStep {
                step_index: rest[0],
                to: Pubkey::new(&rest[1..33]),
                nft_mints: Self::unpack_pubkey_vector(&rest[33..])?,
            },
            2 => Self::ApproveTradeStep {
                step_index: rest[0],
            },
            3 => Self::ExecuteTradeStep {
                step_index: rest[0],
            },
            4 => Self::ExecuteFullTradeLoop {},
            5 => Self::CancelTradeLoop {},
            6 => Self::UpgradeProgram {
                new_program_version: u32::from_le_bytes(rest[0..4].try_into().map_err(|_| SwapError::InvalidInstructionData)?),
            },
            7 => {
                let has_governance = rest[0] != 0;
                
                if has_governance {
                    Self::InitializeProgramConfig {
                        governance: Some(Pubkey::new(&rest[1..33])),
                    }
                } else {
                    Self::InitializeProgramConfig {
                        governance: None,
                    }
                }
            },
            8 => {
                let mut offset = 0;
                
                let has_new_authority = rest[offset] != 0;
                offset += 1;
                
                let new_upgrade_authority = if has_new_authority {
                    let pubkey = Pubkey::new(&rest[offset..offset+32]);
                    offset += 32;
                    Some(pubkey)
                } else {
                    None
                };
                
                let has_new_governance = rest[offset] != 0;
                offset += 1;
                
                let new_governance = if has_new_governance {
                    let pubkey = Pubkey::new(&rest[offset..offset+32]);
                    offset += 32;
                    Some(pubkey)
                } else {
                    None
                };
                
                let has_new_paused_state = rest[offset] != 0;
                offset += 1;
                
                let new_paused_state = if has_new_paused_state {
                    Some(rest[offset] != 0)
                } else {
                    None
                };
                
                Self::UpdateProgramConfig {
                    new_upgrade_authority,
                    new_governance,
                    new_paused_state,
                }
            },
            _ => return Err(SwapError::InvalidInstructionData.into()),
        })
    }

    /// Helper function to unpack a vector of Pubkeys
    fn unpack_pubkey_vector(input: &[u8]) -> Result<Vec<Pubkey>, ProgramError> {
        let count = input[0] as usize;
        if input.len() < 1 + (count * 32) {
            return Err(SwapError::InvalidInstructionData.into());
        }
        
        let mut pubkeys = Vec::with_capacity(count);
        for i in 0..count {
            let start = 1 + (i * 32);
            let end = start + 32;
            pubkeys.push(Pubkey::new(&input[start..end]));
        }
        
        Ok(pubkeys)
    }
} 