use solana_program::{program_error::ProgramError, decode_error::DecodeError};
use thiserror::Error;

/// Errors that may be returned by the NFT Swap Program
#[derive(Debug, Error, Copy, Clone, PartialEq)]
pub enum SwapError {
    /// Invalid instruction data passed
    #[error("Invalid instruction data")]
    InvalidInstructionData,
    
    /// Not rent exempt
    #[error("Account not rent exempt")]
    NotRentExempt,
    
    /// Expected account is not owned by this program
    #[error("Account not owned by program")]
    InvalidAccountOwner,
    
    /// Account is not initialized
    #[error("Account not initialized")]
    UninitializedAccount,
    
    /// Account does not have correct program owner
    #[error("Account does not have correct program owner")]
    IncorrectProgramId,
    
    /// Invalid account data
    #[error("Invalid account data")]
    InvalidAccountData,
    
    /// Trade loop verification failed
    #[error("Trade loop verification failed")]
    TradeLoopVerificationFailed,
    
    /// Not all participants have approved the trade
    #[error("Not all participants have approved the trade")]
    MissingApprovals,
    
    /// Trade step already executed
    #[error("Trade step already executed")]
    StepAlreadyExecuted,
    
    /// Upgrade authority mismatch
    #[error("Upgrade authority does not match expected authority")]
    UpgradeAuthorityMismatch,
    
    /// Invalid program version for upgrade
    #[error("Invalid program version for upgrade")]
    InvalidProgramVersion,
    
    /// Insufficient funds for transaction
    #[error("Insufficient funds for transaction")]
    InsufficientFunds,
    
    /// Invalid metadata account
    #[error("Invalid metadata account")]
    InvalidMetadataAccount,
    
    /// Trade timeout exceeded
    #[error("Trade timeout exceeded")]
    TradeTimeoutExceeded,
    
    /// Too many participants for a single transaction
    #[error("Too many participants for a single transaction")]
    TooManyParticipants,
    
    /// Cancellation denied - trade already in progress
    #[error("Cancellation denied - trade already in progress")]
    CancellationDenied,
}

impl From<SwapError> for ProgramError {
    fn from(e: SwapError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for SwapError {
    fn type_of() -> &'static str {
        "Swap Error"
    }
} 