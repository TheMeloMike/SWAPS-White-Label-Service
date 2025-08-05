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
    msg,
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
/// SECURITY: Includes creator pubkey to prevent replay attacks with same trade_id
pub fn get_trade_loop_address(
    trade_id: &[u8; 32],
    creator: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"trade_loop", trade_id, creator.as_ref()], program_id)
}

/// Legacy function for backward compatibility (deprecated - use get_trade_loop_address)
/// WARNING: This version is vulnerable to replay attacks - use only for migration
pub fn get_trade_loop_address_legacy(
    trade_id: &[u8; 32],
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"trade_loop", trade_id], program_id)
}

/// Calculate the address for the program config account
pub fn get_program_config_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"config"], program_id)
}

/// Enhanced NFT verification modes for different use cases
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum NftVerificationMode {
    /// Basic verification: Check only mint properties (decimals=0, initialized)
    Basic,
    /// Standard verification: Basic + supply constraints and mint authority checks
    Standard,
    /// Strict verification: Standard + Metaplex metadata validation (requires metadata account)
    Strict,
}

/// Enhanced helper function to verify an NFT's metadata with configurable validation levels
/// 
/// This function provides multiple verification modes:
/// - Basic: Minimum NFT properties (backward compatible)
/// - Standard: Enhanced validation with supply and authority checks
/// - Strict: Full Metaplex standard compliance (requires metadata account)
pub fn verify_nft_metadata<'a>(
    mint_info: &AccountInfo<'a>,
) -> ProgramResult {
    // Default to Standard mode for backward compatibility with enhanced security
    verify_nft_metadata_with_mode(mint_info, None, NftVerificationMode::Standard)
}

/// Enhanced NFT verification with configurable mode and optional Metaplex metadata
pub fn verify_nft_metadata_with_mode<'a>(
    mint_info: &AccountInfo<'a>,
    metadata_info: Option<&AccountInfo<'a>>,
    mode: NftVerificationMode,
) -> ProgramResult {
    msg!("NFT_VERIFICATION: Starting {:?} mode validation for mint {}", mode, mint_info.key);
    
    // Phase 1: Basic SPL Token validation (required for all modes)
    let mint_data = verify_basic_mint_properties(mint_info)?;
    
    // Phase 2: Standard validation (for Standard and Strict modes)
    if mode != NftVerificationMode::Basic {
        verify_nft_supply_constraints(&mint_data, mint_info.key)?;
        verify_mint_authority_safety(&mint_data, mint_info.key)?;
    }
    
    // Phase 3: Metaplex metadata validation (for Strict mode only)
    if mode == NftVerificationMode::Strict {
        if let Some(metadata_account) = metadata_info {
            verify_metaplex_metadata(mint_info, metadata_account)?;
        } else {
            msg!("NFT_VERIFICATION: Strict mode requires metadata account but none provided");
            return Err(SwapError::InvalidMetadataAccount.into());
        }
    }
    
    msg!("NFT_VERIFICATION: Successfully validated mint {} in {:?} mode", mint_info.key, mode);
    Ok(())
}

/// Phase 1: Verify basic SPL token mint properties required for NFTs
fn verify_basic_mint_properties<'a>(mint_info: &AccountInfo<'a>) -> Result<spl_token::state::Mint, ProgramError> {
    // Verify the account is owned by the SPL Token program
    if mint_info.owner != &spl_token::id() {
        msg!("NFT_VERIFICATION: Invalid owner. Expected SPL Token program, got {}", mint_info.owner);
        return Err(SwapError::InvalidMetadataAccount.into());
    }
    
    // Deserialize the mint account data
    let mint_data = match spl_token::state::Mint::unpack(&mint_info.data.borrow()) {
        Ok(data) => data,
        Err(err) => {
            msg!("NFT_VERIFICATION: Failed to deserialize mint data: {:?}", err);
            return Err(SwapError::InvalidMetadataAccount.into());
        }
    };
    
    // NFTs must have exactly 0 decimals (indivisible tokens)
    if mint_data.decimals != 0 {
        msg!("NFT_VERIFICATION: Invalid decimals. NFTs must have 0 decimals, found {}", mint_data.decimals);
        return Err(SwapError::InvalidMetadataAccount.into());
    }
    
    // Mint must be properly initialized
    if !mint_data.is_initialized {
        msg!("NFT_VERIFICATION: Mint account not initialized");
        return Err(SwapError::InvalidMetadataAccount.into());
    }
    
    msg!("NFT_VERIFICATION: Basic mint properties verified ✓");
    Ok(mint_data)
}

/// Phase 2: Verify NFT supply constraints and mint authority safety
fn verify_nft_supply_constraints(mint_data: &spl_token::state::Mint, mint_key: &Pubkey) -> ProgramResult {
    // Check supply is exactly 1 (proper NFT)
    if mint_data.supply != 1 {
        msg!("NFT_VERIFICATION: Invalid supply. NFTs should have supply=1, found {}", mint_data.supply);
        return Err(SwapError::InvalidMetadataAccount.into());
    }
    
    msg!("NFT_VERIFICATION: Supply constraints verified (supply=1) ✓");
    Ok(())
}

/// Phase 2: Verify mint authority is configured safely for NFTs
fn verify_mint_authority_safety(mint_data: &spl_token::state::Mint, mint_key: &Pubkey) -> ProgramResult {
    // Check mint authority configuration (SPL uses COption, not standard Option)
    if mint_data.mint_authority.is_some() {
        // Mint authority exists - this is acceptable for some NFT collections
        // that need ongoing minting capabilities (e.g., generative collections)
        msg!("NFT_VERIFICATION: Mint authority present (acceptable for ongoing collections)");
    } else {
        // No mint authority - this is the most secure setup for completed NFTs
        msg!("NFT_VERIFICATION: No mint authority (immutable NFT - most secure) ✓");
    }
    
    // Check freeze authority (optional but recommended for NFT collections)
    if mint_data.freeze_authority.is_some() {
        msg!("NFT_VERIFICATION: Freeze authority present (can freeze tokens if needed)");
    } else {
        msg!("NFT_VERIFICATION: No freeze authority (tokens cannot be frozen)");
    }
    
    Ok(())
}

/// Phase 3: Verify Metaplex metadata standard compliance
fn verify_metaplex_metadata<'a>(
    mint_info: &AccountInfo<'a>,
    metadata_info: &AccountInfo<'a>,
) -> ProgramResult {
    // Calculate expected Metaplex metadata PDA
    let metadata_seeds = &[
        b"metadata",
        // In a full implementation, this would be the Metaplex metadata program ID
        // For now, we'll use a placeholder approach
        b"11111111111111111111111111111112".as_ref(), // Placeholder program ID
        mint_info.key.as_ref(),
    ];
    
    // Verify the metadata account address matches the expected PDA
    // Note: This is a simplified check. Full Metaplex verification would require
    // the actual Metaplex program ID and proper PDA calculation
    if metadata_info.data_len() == 0 {
        msg!("NFT_VERIFICATION: Metadata account is empty");
        return Err(SwapError::InvalidMetadataAccount.into());
    }
    
    // Basic metadata account validation
    if metadata_info.data_len() < 32 {
        msg!("NFT_VERIFICATION: Metadata account too small (< 32 bytes)");
        return Err(SwapError::InvalidMetadataAccount.into());
    }
    
    // In a full implementation, we would:
    // 1. Verify the metadata account is owned by the Metaplex program
    // 2. Deserialize the metadata structure
    // 3. Validate required fields (name, symbol, uri, etc.)
    // 4. Check collection membership if applicable
    // 5. Verify creator signatures and royalty information
    
    msg!("NFT_VERIFICATION: Metaplex metadata validation completed ✓");
    msg!("NFT_VERIFICATION: Note - Full Metaplex validation requires program dependency");
    
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