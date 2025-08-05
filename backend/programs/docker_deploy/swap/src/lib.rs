use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    program_pack::{IsInitialized, Pack},
    sysvar::{rent::Rent, Sysvar},
};
use borsh::{BorshDeserialize, BorshSerialize};

// Local modules
pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;
pub mod utils;

// Export current program's error types
pub use error::SwapError;

// Program entrypoint's implementation
entrypoint!(process_instruction);

// Program entrypoint
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("NFT Swap Program Entrypoint");
    
    // Decode instruction data
    let instruction = instruction::SwapInstruction::unpack(instruction_data)?;
    
    // Process the instruction
    processor::process_instruction(program_id, accounts, instruction)
} 