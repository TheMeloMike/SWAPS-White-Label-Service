use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
    program_pack::Pack,
};

use crate::{
    error::SwapError,
    instruction::SwapInstruction,
    state::{ProgramConfig, StepStatus, TradeLoop, TradeStep, PROGRAM_VERSION, MAX_PARTICIPANTS_PER_TRANSACTION, MAX_TIMEOUT_SECONDS},
    utils,
};

/// Program state processor
pub struct Processor {}

impl Processor {
    /// Process InitializeTradeLoop instruction
    pub fn process_initialize_trade_loop(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        trade_id: [u8; 32],
        step_count: u8,
        timeout_seconds: u64,
    ) -> ProgramResult {
        // Check if the program is paused
        check_program_not_paused(program_id, accounts)?;
        
        // Enforce the maximum step count limit
        if step_count == 0 {
            msg!("Trade loop must have at least 1 step");
            return Err(SwapError::InvalidInstructionData.into());
        }
        
        if step_count > MAX_PARTICIPANTS_PER_TRANSACTION {
            msg!("Trade loop exceeds the maximum allowed steps ({}). Requested: {}", 
                 MAX_PARTICIPANTS_PER_TRANSACTION, step_count);
            return Err(SwapError::TooManyParticipants.into());
        }
        
        // Validate timeout to prevent excessively long timeouts
        if timeout_seconds > MAX_TIMEOUT_SECONDS {
            msg!("Timeout exceeds maximum allowed ({}). Requested: {}", 
                 MAX_TIMEOUT_SECONDS, timeout_seconds);
            return Err(SwapError::InvalidInstructionData.into());
        }
        
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let payer_info = next_account_info(account_info_iter)?;
        let trade_loop_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        
        // Check if the trade loop account already exists
        if trade_loop_info.data_len() > 0 {
            return Err(SwapError::InvalidAccountData.into());
        }
        
        // Verify signers
        if !payer_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Create space for trade loop with default max of 4 NFTs per step
        let space = TradeLoop::get_space(step_count, 4);
        
        // Create the trade loop account
        utils::create_and_initialize_account(
            payer_info,
            trade_loop_info,
            space,
            program_id,
            system_program_info,
            &Rent::from_account_info(rent_info)?,
            program_id,
        )?;
        
        // Get current timestamp
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
        
        // Calculate expiration time with overflow protection
        let expires_at = current_time.checked_add(timeout_seconds)
            .ok_or(SwapError::InvalidInstructionData)?;
        
        // Initialize the trade loop data
        let trade_loop = TradeLoop {
            is_initialized: true,
            trade_id,
            created_at: current_time,
            expires_at,
            steps: Vec::with_capacity(step_count as usize),
            authority: *payer_info.key,
        };
        
        // Serialize and store the trade loop data
        trade_loop.serialize(&mut *trade_loop_info.data.borrow_mut())?;
        
        msg!("Trade loop initialized with ID {:?}", trade_id);
        
        Ok(())
    }
    
    /// Process AddTradeStep instruction
    pub fn process_add_trade_step(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        step_index: u8,
        to: Pubkey,
        nft_mints: Vec<Pubkey>,
    ) -> ProgramResult {
        // Check if the program is paused
        check_program_not_paused(program_id, accounts)?;
        
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let from_info = next_account_info(account_info_iter)?;
        let trade_loop_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        
        // Verify signers
        if !from_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the token program is actually the token program
        if token_program_info.key != &spl_token::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Verify the trade loop account is owned by this program
        utils::verify_account_owner(trade_loop_info, program_id)?;
        
        // Deserialize the trade loop data
        let mut trade_loop = TradeLoop::try_from_slice(&trade_loop_info.data.borrow())?;
        
        // Ensure the trade loop is initialized
        if !trade_loop.is_initialized {
            return Err(SwapError::UninitializedAccount.into());
        }
        
        // Ensure the step index is valid
        if step_index as usize >= trade_loop.steps.capacity() {
            return Err(SwapError::InvalidInstructionData.into());
        }
        
        // Ensure there is at least one NFT to transfer
        if nft_mints.is_empty() {
            return Err(SwapError::InvalidInstructionData.into());
        }
        
        // Check for duplicate NFTs in the list
        let mut unique_nfts = std::collections::HashSet::new();
        for nft_mint in &nft_mints {
            if !unique_nfts.insert(*nft_mint) {
                msg!("Duplicate NFT mint found: {}", nft_mint);
                return Err(SwapError::InvalidInstructionData.into());
            }
        }
        
        // Verify that the sender owns all the NFTs they're committing to trade
        for nft_mint in &nft_mints {
            // Get accounts for this specific NFT
            let mint_info = next_account_info(account_info_iter)?;
            let source_token_account_info = next_account_info(account_info_iter)?;
            
            // Verify the mint account matches the expected mint
            if mint_info.key != nft_mint {
                return Err(SwapError::InvalidAccountData.into());
            }
            
            // Verify this is actually an NFT (metadata check)
            utils::verify_nft_metadata(mint_info)?;
            
            // Verify the token account is owned by the token program
            utils::verify_token_account_owner(source_token_account_info)?;
            
            // Verify the token account is the expected ATA for this wallet/mint
            utils::verify_token_account_address(source_token_account_info, from_info.key, mint_info.key)?;
            
            // Verify the token account belongs to the sender and contains the NFT
            let source_token_account = spl_token::state::Account::unpack(&source_token_account_info.data.borrow())?;
            
            if source_token_account.owner != *from_info.key {
                msg!("Token account {} is not owned by sender {}", source_token_account_info.key, from_info.key);
                return Err(SwapError::InvalidAccountOwner.into());
            }
            
            if source_token_account.mint != *mint_info.key {
                msg!("Token account {} does not match mint {}", source_token_account_info.key, mint_info.key);
                return Err(SwapError::InvalidAccountData.into());
            }
            
            // Verify the sender has the NFT (amount should be 1 for NFTs)
            if source_token_account.amount < 1 {
                msg!("Token account {} has insufficient balance for NFT {}", source_token_account_info.key, mint_info.key);
                return Err(SwapError::InsufficientFunds.into());
            }
        }
        
        // Create the new trade step
        let new_step = TradeStep {
            from: *from_info.key,
            to,
            nft_mints,
            status: StepStatus::Created,
        };
        
        // Add or replace the step at the specified index
        if step_index as usize >= trade_loop.steps.len() {
            trade_loop.steps.push(new_step);
        } else {
            trade_loop.steps[step_index as usize] = new_step;
        }
        
        // If we have added all expected steps, verify the loop forms a valid cycle
        if trade_loop.steps.len() == trade_loop.steps.capacity() {
            // Perform loop validation
            if !trade_loop.verify_loop() {
                msg!("Trade loop validation failed - not a valid cycle");
                return Err(SwapError::TradeLoopVerificationFailed.into());
            }
            msg!("All steps added, trade loop forms a valid cycle");
        }
        
        // Serialize and store the updated trade loop data
        trade_loop.serialize(&mut *trade_loop_info.data.borrow_mut())?;
        
        msg!("Added trade step {} from {} to {}", step_index, from_info.key, to);
        
        Ok(())
    }
    
    /// Process ApproveTradeStep instruction
    pub fn process_approve_trade_step(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        step_index: u8,
    ) -> ProgramResult {
        // Check if the program is paused
        check_program_not_paused(program_id, accounts)?;
        
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let sender_info = next_account_info(account_info_iter)?;
        let trade_loop_info = next_account_info(account_info_iter)?;
        let clock_info = next_account_info(account_info_iter)?;
        
        // Verify signers
        if !sender_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the trade loop account is owned by this program
        utils::verify_account_owner(trade_loop_info, program_id)?;
        
        // Deserialize the trade loop data
        let mut trade_loop = TradeLoop::try_from_slice(&trade_loop_info.data.borrow())?;
        
        // Ensure the trade loop is initialized
        if !trade_loop.is_initialized {
            return Err(SwapError::UninitializedAccount.into());
        }
        
        // Check if the trade loop has expired
        let clock = Clock::from_account_info(clock_info)?;
        if trade_loop.is_expired(clock.unix_timestamp as u64) {
            return Err(SwapError::TradeTimeoutExceeded.into());
        }
        
        // Ensure the step index is valid
        if step_index as usize >= trade_loop.steps.len() {
            return Err(SwapError::InvalidInstructionData.into());
        }
        
        // Get the step
        let step = &mut trade_loop.steps[step_index as usize];
        
        // Ensure the sender is the owner of this step
        if step.from != *sender_info.key {
            return Err(SwapError::InvalidAccountOwner.into());
        }
        
        // If already approved, just return success (idempotent)
        if step.status == StepStatus::Approved {
            msg!("Step {} already approved by {}", step_index, sender_info.key);
            return Ok(());
        }
        
        // Verify the step isn't already executed
        if step.status == StepStatus::Executed {
            return Err(SwapError::StepAlreadyExecuted.into());
        }
        
        // Update the step status to Approved
        step.status = StepStatus::Approved;
        
        // Serialize and store the updated trade loop data
        trade_loop.serialize(&mut *trade_loop_info.data.borrow_mut())?;
        
        msg!("FINAL APPROVAL: Step {} approved by {}. This approval cannot be revoked.", 
             step_index, sender_info.key);
        
        Ok(())
    }
    
    /// Process ExecuteTradeStep instruction
    pub fn process_execute_trade_step(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        step_index: u8,
    ) -> ProgramResult {
        // Check if the program is paused
        check_program_not_paused(program_id, accounts)?;
        
        let account_info_iter = &mut accounts.iter();
        
        // Get base accounts
        let executor_info = next_account_info(account_info_iter)?;
        let trade_loop_info = next_account_info(account_info_iter)?;
        let sender_info = next_account_info(account_info_iter)?;
        let recipient_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let associated_token_program_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;
        
        // Verify signers
        if !executor_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the trade loop account is owned by this program
        utils::verify_account_owner(trade_loop_info, program_id)?;
        
        // Verify the token program is actually the token program
        if token_program_info.key != &spl_token::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Verify the associated token program is actually the associated token program
        if associated_token_program_info.key != &spl_associated_token_account::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Verify the system program is actually the system program
        if system_program_info.key != &solana_program::system_program::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Deserialize the trade loop data
        let mut trade_loop = TradeLoop::try_from_slice(&trade_loop_info.data.borrow())?;
        
        // Ensure the trade loop is initialized
        if !trade_loop.is_initialized {
            return Err(SwapError::UninitializedAccount.into());
        }
        
        // Check if the trade loop has expired
        let clock = Clock::get()?;
        if trade_loop.is_expired(clock.unix_timestamp as u64) {
            return Err(SwapError::TradeTimeoutExceeded.into());
        }
        
        // Ensure the step index is valid
        if step_index as usize >= trade_loop.steps.len() {
            return Err(SwapError::InvalidInstructionData.into());
        }
        
        // Get the step
        let step = &mut trade_loop.steps[step_index as usize];
        
        // Ensure the step is approved
        if step.status != StepStatus::Approved {
            return Err(SwapError::MissingApprovals.into());
        }
        
        // Ensure the step hasn't already been executed
        if step.status == StepStatus::Executed {
            return Err(SwapError::StepAlreadyExecuted.into());
        }
        
        // Ensure the sender and recipient match the step
        if step.from != *sender_info.key {
            return Err(SwapError::InvalidAccountData.into());
        }
        
        if step.to != *recipient_info.key {
            return Err(SwapError::InvalidAccountData.into());
        }
        
        // Get the rent to check for rent exemption
        let rent = Rent::from_account_info(rent_info)?;
        
        // Process each NFT in the step
        for (i, nft_mint) in step.nft_mints.iter().enumerate() {
            // Get the accounts for this specific NFT
            let mint_info = next_account_info(account_info_iter)?;
            let source_token_account_info = next_account_info(account_info_iter)?;
            let destination_token_account_info = next_account_info(account_info_iter)?;
            
            // Verify that the mint account matches the expected mint
            if mint_info.key != nft_mint {
                return Err(SwapError::InvalidAccountData.into());
            }
            
            // Verify this is actually an NFT (metadata check)
            utils::verify_nft_metadata(mint_info)?;
            
            // Verify the token accounts are owned by the token program
            utils::verify_token_account_owner(source_token_account_info)?;
            
            // Verify the source token account is the expected ATA for this wallet/mint
            utils::verify_token_account_address(source_token_account_info, sender_info.key, mint_info.key)?;
            
            // For destination, we only verify if it exists
            if destination_token_account_info.data_len() > 0 {
                utils::verify_token_account_address(destination_token_account_info, recipient_info.key, mint_info.key)?;
            }
            
            // Create the destination token account if it doesn't exist
            if destination_token_account_info.data_len() == 0 {
                msg!("Creating token account for recipient");
                utils::create_associated_token_account_if_needed(
                    executor_info,
                    recipient_info,
                    mint_info,
                    destination_token_account_info,
                    token_program_info,
                    associated_token_program_info,
                    system_program_info,
                    rent_info,
                )?;
            }
            
            // Verify the token accounts are correctly associated with the sender and recipient
            let source_token_account = spl_token::state::Account::unpack(&source_token_account_info.data.borrow())?;
            
            if source_token_account.owner != *sender_info.key {
                return Err(SwapError::InvalidAccountOwner.into());
            }
            
            if source_token_account.mint != *mint_info.key {
                return Err(SwapError::InvalidAccountData.into());
            }
            
            // Verify the sender has the NFT (amount should be 1 for NFTs)
            if source_token_account.amount < 1 {
                return Err(SwapError::InsufficientFunds.into());
            }
            
            // Transfer the NFT to the recipient
            msg!("Transferring NFT {} from {} to {}", mint_info.key, sender_info.key, recipient_info.key);
            utils::transfer_nft(
                source_token_account_info,
                destination_token_account_info,
                sender_info,
                token_program_info,
            )?;
        }
        
        // Mark the step as executed
        step.status = StepStatus::Executed;
        
        // Update the trade loop state
        trade_loop.serialize(&mut *trade_loop_info.data.borrow_mut())?;
        
        msg!("Executed trade step {}", step_index);
        
        Ok(())
    }
    
    /// Process ExecuteFullTradeLoop instruction
    pub fn process_execute_full_trade_loop(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
    ) -> ProgramResult {
        // Check if the program is paused
        check_program_not_paused(program_id, accounts)?;
        
        let account_info_iter = &mut accounts.iter();
        
        // Get base accounts
        let executor_info = next_account_info(account_info_iter)?;
        let trade_loop_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let associated_token_program_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;
        let clock_info = next_account_info(account_info_iter)?;
        
        // Verify signers
        if !executor_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the trade loop account is owned by this program
        utils::verify_account_owner(trade_loop_info, program_id)?;
        
        // Verify the token program is actually the token program
        if token_program_info.key != &spl_token::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Verify the associated token program is actually the associated token program
        if associated_token_program_info.key != &spl_associated_token_account::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Verify the system program is actually the system program
        if system_program_info.key != &solana_program::system_program::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Deserialize the trade loop data
        let mut trade_loop = TradeLoop::try_from_slice(&trade_loop_info.data.borrow())?;
        
        // Ensure the trade loop is initialized
        if !trade_loop.is_initialized {
            return Err(SwapError::UninitializedAccount.into());
        }
        
        // Check if the trade loop has expired
        let clock = Clock::from_account_info(clock_info)?;
        if trade_loop.is_expired(clock.unix_timestamp as u64) {
            return Err(SwapError::TradeTimeoutExceeded.into());
        }
        
        // Verify the trade loop forms a valid cycle
        if !trade_loop.verify_loop() {
            return Err(SwapError::TradeLoopVerificationFailed.into());
        }
        
        // Ensure all steps are approved
        if !trade_loop.is_ready_for_execution() {
            return Err(SwapError::MissingApprovals.into());
        }
        
        // Verify the number of participants doesn't exceed the maximum
        if trade_loop.steps.len() > MAX_PARTICIPANTS_PER_TRANSACTION as usize {
            msg!("Trade loop exceeds the maximum allowed participants ({}). Actual: {}", 
                 MAX_PARTICIPANTS_PER_TRANSACTION, trade_loop.steps.len());
            return Err(SwapError::TooManyParticipants.into());
        }
        
        // Get the rent for creating token accounts if needed
        let rent = Rent::from_account_info(rent_info)?;
        
        // Process each step in the trade loop
        for (step_index, step) in trade_loop.steps.iter_mut().enumerate() {
            // Ensure the step hasn't already been executed
            if step.status == StepStatus::Executed {
                return Err(SwapError::StepAlreadyExecuted.into());
            }
            
            // Get participant accounts for this step
            let sender_info = next_account_info(account_info_iter)?;
            let recipient_info = next_account_info(account_info_iter)?;
            
            // Verify the participants match the expected step
            if step.from != *sender_info.key {
                return Err(SwapError::InvalidAccountData.into());
            }
            
            if step.to != *recipient_info.key {
                return Err(SwapError::InvalidAccountData.into());
            }
            
            // Process each NFT in this step
            for nft_mint in &step.nft_mints {
                // Get accounts for this specific NFT
                let mint_info = next_account_info(account_info_iter)?;
                let source_token_account_info = next_account_info(account_info_iter)?;
                let destination_token_account_info = next_account_info(account_info_iter)?;
                
                // Verify that the mint account matches the expected mint
                if mint_info.key != nft_mint {
                    return Err(SwapError::InvalidAccountData.into());
                }
                
                // Verify this is actually an NFT (metadata check)
                utils::verify_nft_metadata(mint_info)?;
                
                // Verify the token accounts are owned by the token program
                utils::verify_token_account_owner(source_token_account_info)?;
                
                // Verify the source token account is the expected ATA for this wallet/mint
                utils::verify_token_account_address(source_token_account_info, sender_info.key, mint_info.key)?;
                
                // For destination, we only verify if it exists
                if destination_token_account_info.data_len() > 0 {
                    utils::verify_token_account_address(destination_token_account_info, recipient_info.key, mint_info.key)?;
                }
                
                // Create the destination token account if it doesn't exist
                if destination_token_account_info.data_len() == 0 {
                    msg!("Creating token account for recipient");
                    utils::create_associated_token_account_if_needed(
                        executor_info,
                        recipient_info,
                        mint_info,
                        destination_token_account_info,
                        token_program_info,
                        associated_token_program_info,
                        system_program_info,
                        rent_info,
                    )?;
                }
                
                // Verify the token accounts are correctly associated with the sender and recipient
                let source_token_account = spl_token::state::Account::unpack(&source_token_account_info.data.borrow())?;
                
                if source_token_account.owner != *sender_info.key {
                    return Err(SwapError::InvalidAccountOwner.into());
                }
                
                if source_token_account.mint != *mint_info.key {
                    return Err(SwapError::InvalidAccountData.into());
                }
                
                // Verify the sender has the NFT (amount should be 1 for NFTs)
                if source_token_account.amount < 1 {
                    return Err(SwapError::InsufficientFunds.into());
                }
                
                // Transfer the NFT to the recipient
                msg!("Transferring NFT {} from {} to {}", mint_info.key, sender_info.key, recipient_info.key);
                utils::transfer_nft(
                    source_token_account_info,
                    destination_token_account_info,
                    sender_info,
                    token_program_info,
                )?;
            }
            
            // Mark this step as executed
            step.status = StepStatus::Executed;
        }
        
        // Update the trade loop state
        trade_loop.serialize(&mut *trade_loop_info.data.borrow_mut())?;
        
        msg!("Executed full trade loop with {} steps", trade_loop.steps.len());
        
        Ok(())
    }
    
    /// Process CancelTradeLoop instruction
    pub fn process_cancel_trade_loop(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
    ) -> ProgramResult {
        // Check if the program is paused
        check_program_not_paused(program_id, accounts)?;
        
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let canceller_info = next_account_info(account_info_iter)?;
        let trade_loop_info = next_account_info(account_info_iter)?;
        
        // Verify signers
        if !canceller_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the trade loop account is owned by this program
        utils::verify_account_owner(trade_loop_info, program_id)?;
        
        // Deserialize the trade loop data
        let trade_loop = TradeLoop::try_from_slice(&trade_loop_info.data.borrow())?;
        
        // Ensure the trade loop is initialized
        if !trade_loop.is_initialized {
            return Err(SwapError::UninitializedAccount.into());
        }
        
        // Check if the canceller is a participant
        let user_step_index = trade_loop.steps.iter().position(|step| step.from == *canceller_info.key);
        
        if user_step_index.is_none() {
            msg!("Canceller is not a participant in this trade loop");
            return Err(SwapError::InvalidAccountOwner.into());
        }
        
        // Get the user's step 
        let user_step = &trade_loop.steps[user_step_index.unwrap()];
        
        // CRITICAL: Only allow cancellation if the user's step is not yet approved
        // This prevents users from backing out after committing
        if user_step.status != StepStatus::Created {
            msg!("Cannot cancel trade after approving. Your step status: {:?}", user_step.status);
            return Err(SwapError::CancellationDenied.into());
        }
        
        // Check if any other steps are already approved
        let any_approved_steps = trade_loop.steps.iter()
            .any(|step| step.status == StepStatus::Approved);
        
        if any_approved_steps {
            msg!("Cannot cancel trade when other participants have already approved");
            return Err(SwapError::CancellationDenied.into());
        }
        
        // All checks passed - allow cancellation
        // Zero out the account data to mark it as cancelled
        trade_loop_info.data.borrow_mut().fill(0);
        
        msg!("Cancelled trade loop");
        
        Ok(())
    }
    
    /// Process UpgradeProgram instruction
    pub fn process_upgrade_program(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        new_program_version: u32,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let upgrade_authority_info = next_account_info(account_info_iter)?;
        let program_data_info = next_account_info(account_info_iter)?;
        let program_info = next_account_info(account_info_iter)?;
        let buffer_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;
        let clock_info = next_account_info(account_info_iter)?;
        let bpf_loader_upgradeable_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        
        // Verify signers
        if !upgrade_authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Get the program config
        let (config_pubkey, bump_seed) = utils::get_program_config_address(program_id);
        
        // Verify the config account is the correct PDA
        if config_info.key != &config_pubkey {
            return Err(SwapError::InvalidAccountData.into());
        }
        
        // Verify the config account is owned by this program
        utils::verify_account_owner(config_info, program_id)?;
        
        // Deserialize the config
        let config = ProgramConfig::try_from_slice(&config_info.data.borrow())?;
        
        // Ensure the config is initialized
        if !config.is_initialized {
            return Err(SwapError::UninitializedAccount.into());
        }
        
        // Verify the upgrade authority matches the expected authority
        if config.upgrade_authority != *upgrade_authority_info.key {
            // Check if there's a governance structure and it's authorizing the upgrade
            if let Some(governance) = config.governance {
                if governance != *upgrade_authority_info.key {
                    return Err(SwapError::UpgradeAuthorityMismatch.into());
                }
            } else {
                return Err(SwapError::UpgradeAuthorityMismatch.into());
            }
        }
        
        // Check that the new version is greater than the current version
        if new_program_version <= config.version {
            return Err(SwapError::InvalidProgramVersion.into());
        }
        
        // Verify the BPF Loader Upgradeable program ID
        if bpf_loader_upgradeable_info.key != &solana_program::bpf_loader_upgradeable::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Create the upgrade program instruction
        let upgrade_instruction = solana_program::bpf_loader_upgradeable::upgrade(
            program_info.key,
            buffer_info.key,
            upgrade_authority_info.key,
            rent_info.key,
        );
        
        // Execute the upgrade
        invoke(
            &upgrade_instruction,
            &[
                program_info.clone(),
                buffer_info.clone(),
                upgrade_authority_info.clone(),
                rent_info.clone(),
                clock_info.clone(),
                bpf_loader_upgradeable_info.clone(),
            ],
        )?;
        
        // Update the program version in the config
        let mut updated_config = config;
        updated_config.version = new_program_version;
        
        // Serialize and store the updated config
        updated_config.serialize(&mut *config_info.data.borrow_mut())?;
        
        msg!("Upgraded program to version {}", new_program_version);
        
        Ok(())
    }

    /// Process InitializeProgramConfig instruction
    pub fn process_initialize_program_config(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        governance: Option<Pubkey>,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        
        // Verify signers
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the system program
        if system_program_info.key != &solana_program::system_program::id() {
            return Err(SwapError::IncorrectProgramId.into());
        }
        
        // Calculate the expected PDA for the config account
        let (expected_config_key, bump_seed) = utils::get_program_config_address(program_id);
        
        // Verify that the provided config account matches the expected PDA
        if config_info.key != &expected_config_key {
            return Err(SwapError::InvalidAccountData.into());
        }
        
        // Check if the config account already exists
        if config_info.data_len() > 0 {
            return Err(SwapError::InvalidAccountData.into());
        }
        
        // Get the rent
        let rent = Rent::from_account_info(rent_info)?;
        
        // Size of the config account - base struct is about 64 bytes with option fields
        let config_size = 96;
        
        // Create the config account as a PDA
        let seeds = &[b"config".as_ref(), &[bump_seed]];
        
        // Create the account
        invoke_signed(
            &system_instruction::create_account(
                authority_info.key,
                config_info.key,
                rent.minimum_balance(config_size),
                config_size as u64,
                program_id,
            ),
            &[
                authority_info.clone(),
                config_info.clone(),
                system_program_info.clone(),
            ],
            &[seeds],
        )?;
        
        // Initialize the config data
        let config = ProgramConfig {
            is_initialized: true,
            version: PROGRAM_VERSION,
            upgrade_authority: *authority_info.key,
            governance,
            paused: false,
        };
        
        // Serialize and store the config data
        config.serialize(&mut *config_info.data.borrow_mut())?;
        
        msg!("Program config initialized with authority {}", authority_info.key);
        
        Ok(())
    }

    /// Process UpdateProgramConfig instruction
    pub fn process_update_program_config(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        new_upgrade_authority: Option<Pubkey>,
        new_governance: Option<Pubkey>,
        new_paused_state: Option<bool>,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        // Get accounts
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        
        // Verify signers
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Verify the config account is owned by this program
        utils::verify_account_owner(config_info, program_id)?;
        
        // Calculate the expected PDA for the config account
        let (expected_config_key, _) = utils::get_program_config_address(program_id);
        
        // Verify that the provided config account matches the expected PDA
        if config_info.key != &expected_config_key {
            return Err(SwapError::InvalidAccountData.into());
        }
        
        // Deserialize the config data
        let mut config = ProgramConfig::try_from_slice(&config_info.data.borrow())?;
        
        // Ensure the config is initialized
        if !config.is_initialized {
            return Err(SwapError::UninitializedAccount.into());
        }
        
        // Verify the authority is authorized to update the config
        if config.upgrade_authority != *authority_info.key {
            // Check if there's a governance structure and it's authorizing the change
            if let Some(governance) = config.governance {
                // In a real implementation, we would check if the governance account has approved this update
                // For now, we just ensure the signer is the governance account
                if governance != *authority_info.key {
                    return Err(SwapError::UpgradeAuthorityMismatch.into());
                }
            } else {
                return Err(SwapError::UpgradeAuthorityMismatch.into());
            }
        }
        
        // Update the config fields if provided
        if let Some(new_authority) = new_upgrade_authority {
            config.upgrade_authority = new_authority;
            msg!("Updated upgrade authority to {}", new_authority);
        }
        
        if let Some(new_gov) = new_governance {
            config.governance = Some(new_gov);
            msg!("Updated governance to {}", new_gov);
        }
        
        if let Some(paused) = new_paused_state {
            config.paused = paused;
            msg!("Updated paused state to {}", paused);
        }
        
        // Serialize and store the updated config data
        config.serialize(&mut *config_info.data.borrow_mut())?;
        
        msg!("Program config updated");
        
        Ok(())
    }
}

/// Process an instruction
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction: SwapInstruction,
) -> ProgramResult {
    match instruction {
        SwapInstruction::InitializeTradeLoop { trade_id, step_count, timeout_seconds } => {
            Processor::process_initialize_trade_loop(program_id, accounts, trade_id, step_count, timeout_seconds)
        }
        SwapInstruction::AddTradeStep { step_index, to, nft_mints } => {
            Processor::process_add_trade_step(program_id, accounts, step_index, to, nft_mints)
        }
        SwapInstruction::ApproveTradeStep { step_index } => {
            Processor::process_approve_trade_step(program_id, accounts, step_index)
        }
        SwapInstruction::ExecuteTradeStep { step_index } => {
            Processor::process_execute_trade_step(program_id, accounts, step_index)
        }
        SwapInstruction::ExecuteFullTradeLoop {} => {
            Processor::process_execute_full_trade_loop(program_id, accounts)
        }
        SwapInstruction::CancelTradeLoop {} => {
            Processor::process_cancel_trade_loop(program_id, accounts)
        }
        SwapInstruction::UpgradeProgram { new_program_version } => {
            Processor::process_upgrade_program(program_id, accounts, new_program_version)
        }
        SwapInstruction::InitializeProgramConfig { governance } => {
            Processor::process_initialize_program_config(program_id, accounts, governance)
        }
        SwapInstruction::UpdateProgramConfig { new_upgrade_authority, new_governance, new_paused_state } => {
            Processor::process_update_program_config(program_id, accounts, new_upgrade_authority, new_governance, new_paused_state)
        }
    }
}

/// Helper function to check if the program is paused
fn check_program_not_paused(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    // Get the program configuration PDA
    let (config_pubkey, _) = utils::get_program_config_address(program_id);
    
    // Try to find the config account
    let mut config_found = false;
    
    for account_info in accounts {
        if account_info.key == &config_pubkey {
            // Verify the account is owned by this program
            if account_info.owner != program_id {
                msg!("Config account found but has incorrect owner");
                continue;
            }
            
            // Verify the account has data
            if account_info.data_len() == 0 {
                msg!("Config account found but has no data");
                continue;
            }
            
            config_found = true;
            
            // Try to deserialize - if it fails, the config might be corrupted
            match ProgramConfig::try_from_slice(&account_info.data.borrow()) {
                Ok(config) => {
                    if config.paused {
                        msg!("Program is currently paused");
                        return Err(SwapError::InvalidInstructionData.into());
                    }
                },
                Err(err) => {
                    msg!("Error deserializing config account: {}", err);
                    return Err(SwapError::InvalidAccountData.into());
                }
            }
            
            // Found valid config, stop searching
            break;
        }
    }
    
    // If config account was not found, that's ok - it might not be initialized yet
    if !config_found {
        msg!("Config account not found, assuming program is not paused");
    }
    
    Ok(())
} 