use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    msg,
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

/// Instruction format version identifier
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub enum InstructionVersion {
    /// Legacy manual parsing (tags 0-8) - maintained for backward compatibility
    Legacy = 0,
    /// Modern Borsh-based parsing with full schema validation
    V1 = 1,
}

/// Modern versioned instruction wrapper for future extensibility
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct VersionedInstruction {
    pub version: InstructionVersion,
    pub instruction: SwapInstruction,
}

impl SwapInstruction {
    /// Modern unpacking with version detection and backward compatibility
    /// 
    /// This function automatically detects instruction format:
    /// - Legacy format: Manual byte slicing (tags 0-8)
    /// - V1 format: Full Borsh deserialization with schema validation
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        if input.is_empty() {
            return Err(SwapError::InvalidInstructionData.into());
        }

        // Check if this might be a modern versioned instruction
        if input.len() >= 2 && input[0] == 255 {
            // Modern versioned format: [255, version, ...borsh_data]
            return Self::unpack_versioned(&input[1..]);
        }

        // Fall back to legacy manual parsing for backward compatibility
        Self::unpack_legacy(input)
    }

    /// Unpack modern versioned instructions using Borsh
    fn unpack_versioned(input: &[u8]) -> Result<Self, ProgramError> {
        match VersionedInstruction::try_from_slice(input) {
            Ok(versioned) => {
                msg!("MODERN: Unpacked versioned instruction v{:?}", versioned.version);
                Ok(versioned.instruction)
            },
            Err(_) => {
                msg!("PARSE_ERROR: Failed to parse versioned instruction");
                Err(SwapError::InvalidInstructionData.into())
            }
        }
    }

    /// Legacy manual parsing for backward compatibility (DEPRECATED)
    /// 
    /// WARNING: This parsing method is error-prone and maintained only for
    /// backward compatibility. New clients should use versioned instructions.
    fn unpack_legacy(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(SwapError::InvalidInstructionData)?;
        
        msg!("LEGACY: Unpacking instruction with tag {}", tag);
        
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

    /// Pack instruction into bytes using modern versioned format
    /// 
    /// This creates a versioned instruction that can be safely evolved
    /// without breaking existing functionality.
    pub fn pack_versioned(&self) -> Vec<u8> {
        let versioned = VersionedInstruction {
            version: InstructionVersion::V1,
            instruction: self.clone(),
        };
        
        let mut packed = vec![255]; // Version marker
        packed.extend_from_slice(&versioned.try_to_vec().unwrap());
        
        msg!("MODERN: Packed versioned instruction v{:?}", versioned.version);
        packed
    }

    /// Legacy packing for backward compatibility (DEPRECATED)
    /// 
    /// WARNING: Use pack_versioned() for new code. This is maintained only
    /// for compatibility with existing clients.
    pub fn pack_legacy(&self) -> Vec<u8> {
        msg!("LEGACY: Using deprecated manual packing");
        
        match self {
            Self::InitializeTradeLoop { trade_id, step_count, timeout_seconds } => {
                let mut packed = vec![0]; // Tag 0
                packed.extend_from_slice(trade_id);
                packed.push(*step_count);
                packed.extend_from_slice(&timeout_seconds.to_le_bytes());
                packed
            },
            Self::AddTradeStep { step_index, to, nft_mints } => {
                let mut packed = vec![1]; // Tag 1
                packed.push(*step_index);
                packed.extend_from_slice(to.as_ref());
                packed.push(nft_mints.len() as u8);
                for mint in nft_mints {
                    packed.extend_from_slice(mint.as_ref());
                }
                packed
            },
            Self::ApproveTradeStep { step_index } => {
                vec![2, *step_index] // Tag 2
            },
            Self::ExecuteTradeStep { step_index } => {
                vec![3, *step_index] // Tag 3
            },
            Self::ExecuteFullTradeLoop {} => {
                vec![4] // Tag 4
            },
            Self::CancelTradeLoop {} => {
                vec![5] // Tag 5
            },
            Self::UpgradeProgram { new_program_version } => {
                let mut packed = vec![6]; // Tag 6
                packed.extend_from_slice(&new_program_version.to_le_bytes());
                packed
            },
            Self::InitializeProgramConfig { governance } => {
                let mut packed = vec![7]; // Tag 7
                if let Some(gov) = governance {
                    packed.push(1); // Has governance
                    packed.extend_from_slice(gov.as_ref());
                } else {
                    packed.push(0); // No governance
                }
                packed
            },
            Self::UpdateProgramConfig { new_upgrade_authority, new_governance, new_paused_state } => {
                let mut packed = vec![8]; // Tag 8
                
                // Handle new_upgrade_authority
                if let Some(authority) = new_upgrade_authority {
                    packed.push(1);
                    packed.extend_from_slice(authority.as_ref());
                } else {
                    packed.push(0);
                }
                
                // Handle new_governance
                if let Some(gov) = new_governance {
                    packed.push(1);
                    packed.extend_from_slice(gov.as_ref());
                } else {
                    packed.push(0);
                }
                
                // Handle new_paused_state
                if let Some(paused) = new_paused_state {
                    packed.push(1);
                    packed.push(if *paused { 1 } else { 0 });
                } else {
                    packed.push(0);
                }
                
                packed
            },
        }
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