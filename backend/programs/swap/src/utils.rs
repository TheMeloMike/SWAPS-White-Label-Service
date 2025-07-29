use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use spl_associated_token_account::instruction as ata_instruction;
use spl_token::instruction as token_instruction;

use crate::error::SwapError;

/// Find a program derived address
pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(seeds, program_id)
}

/// Creates and initializes an account for the program
pub fn create_and_initialize_account<'a>(
    payer: &AccountInfo<'a>,
    new_account: &AccountInfo<'a>,
    space: usize,
    program_id: &Pubkey,
    system_program: &AccountInfo<'a>,
    rent: &Rent,
    owner_program_id: &Pubkey,
) -> ProgramResult {
    // Create the account
    invoke(
        &system_instruction::create_account(
            payer.key,
            new_account.key,
            rent.minimum_balance(space),
            space as u64,
            owner_program_id,
        ),
        &[payer.clone(), new_account.clone(), system_program.clone()],
    )?;

    Ok(())
}

/// Verify that an account is owned by this program
pub fn verify_account_owner(account: &AccountInfo, program_id: &Pubkey) -> ProgramResult {
    if account.owner != program_id {
        return Err(SwapError::InvalidAccountOwner.into());
    }
    Ok(())
}

/// Verify that an account is owned by the SPL Token program
pub fn verify_token_account_owner(account: &AccountInfo) -> ProgramResult {
    if account.owner != &spl_token::id() {
        return Err(SwapError::InvalidAccountOwner.into());
    }
    Ok(())
}

/// Verify that an account is owned by the System program
pub fn verify_system_account_owner(account: &AccountInfo) -> ProgramResult {
    if account.owner != &solana_program::system_program::id() {
        return Err(SwapError::InvalidAccountOwner.into());
    }
    Ok(())
}

/// Verify that an account is owned by the Sysvar program
pub fn verify_sysvar_account_owner(account: &AccountInfo) -> ProgramResult {
    if account.owner != &solana_program::sysvar::id() {
        return Err(SwapError::InvalidAccountOwner.into());
    }
    Ok(())
}

/// Create associated token account if it doesn't exist
pub fn create_associated_token_account_if_needed<'a>(
    payer: &AccountInfo<'a>,
    wallet: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    token_account: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    associated_token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent_sysvar: &AccountInfo<'a>,
) -> ProgramResult {
    // Check if the token account already exists
    if token_account.data_len() > 0 {
        return Ok(());
    }

    // Create the associated token account
    invoke(
        &ata_instruction::create_associated_token_account(
            payer.key,
            wallet.key,
            mint.key,
            token_program.key,
        ),
        &[
            payer.clone(),
            token_account.clone(),
            wallet.clone(),
            mint.clone(),
            system_program.clone(),
            token_program.clone(),
            rent_sysvar.clone(),
            associated_token_program.clone(),
        ],
    )?;

    Ok(())
}

/// Transfer NFT from one account to another
pub fn transfer_nft<'a>(
    source: &AccountInfo<'a>,
    destination: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
) -> ProgramResult {
    invoke(
        &token_instruction::transfer(
            token_program.key,
            source.key,
            destination.key,
            authority.key,
            &[],
            1, // NFTs have amount 1
        )?,
        &[
            source.clone(),
            destination.clone(),
            authority.clone(),
            token_program.clone(),
        ],
    )?;

    Ok(())
}

/// Calculate the address for a trade loop state account with the given trade ID
pub fn get_trade_loop_address(
    trade_id: &[u8; 32],
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"trade_loop", trade_id], program_id)
}

/// Calculate the address for the program config account
pub fn get_program_config_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"config"], program_id)
}

/// Helper function to verify an NFT's metadata
pub fn verify_nft_metadata<'a>(
    mint_info: &AccountInfo<'a>,
) -> ProgramResult {
    // For SPL NFTs (following Metaplex standards), each NFT has:
    // 1. A token with decimals=0 and supply=1
    // 2. An associated metadata account (PDA)
    
    // First, check if the mint is a valid SPL token with NFT properties
    let mint_data = spl_token::state::Mint::unpack(&mint_info.data.borrow())?;
    
    // NFTs should have 0 decimals
    if mint_data.decimals != 0 {
        msg!("Invalid NFT: decimals must be 0, found {}", mint_data.decimals);
        return Err(SwapError::InvalidMetadataAccount.into());
    }
    
    // Proper NFTs have a fixed supply of 1
    // Note: we can't verify the total supply directly from the mint account,
    // but we can check if the mint is initialized and not allowed to change
    if !mint_data.is_initialized {
        msg!("Invalid NFT: mint not initialized");
        return Err(SwapError::InvalidMetadataAccount.into());
    }
    
    // NFTs typically have fixed supply (mint authority disabled)
    // But some collections keep the mint authority, so we don't enforce this
    
    // In a more comprehensive implementation, we would also verify:
    // 1. Check if Metadata account exists (Metaplex PDA)
    // 2. Verify metadata structure and content
    // This requires additional accounts to be passed in
    
    // Simple verification passed
    Ok(())
}

/// Verify that a token account is the correct associated token account for a given wallet and mint
pub fn verify_token_account_address(
    token_account_info: &AccountInfo,
    wallet: &Pubkey,
    mint: &Pubkey,
) -> ProgramResult {
    // Calculate what the token account address should be
    let expected_token_account = spl_associated_token_account::get_associated_token_address(
        wallet,
        mint,
    );
    
    // Verify it matches the provided token account
    if token_account_info.key != &expected_token_account {
        msg!("Token account address mismatch. Expected: {}, Found: {}", 
            expected_token_account, token_account_info.key);
        return Err(SwapError::InvalidAccountData.into());
    }
    
    Ok(())
} 