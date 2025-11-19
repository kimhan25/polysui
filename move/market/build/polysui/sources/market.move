module polysui::market {

    use sui::clock::{Self, Clock};
    use std::string::String;

    // ==================== Error Codes ====================
    const EMarketEnded: u64 = 0;
    const ENotWhitelisted: u64 = 1;
    const ENotCreator: u64 = 2;
    const EInvalidOption: u64 = 3;
    const EAlreadyVoted: u64 = 4;
    const EInvalidDuration: u64 = 6;
    const EInvalidOptionsCount: u64 = 7;

    // ==================== Structs ====================
    
    /// Main voting market object
    public struct VotingMarket has key, store {
        id: UID,
        creator: address,
        question: String,
        options: vector<String>,
        votes: vector<u64>,
        voters: vector<address>,
        deadline: u64,
        whitelist_enabled: bool,
        initial_voters: vector<address>,
        created_at: u64,
        is_active: bool,
    }

    /// Event emitted when market is created
    public struct MarketCreated has copy, drop {
        id: ID,
        creator: address,
        question: String,
        deadline: u64,
    }

    /// Event emitted when vote is cast
    public struct VoteCast has copy, drop {
        market_id: ID,
        voter: address,
        option_index: u64,
        timestamp: u64,
    }

    /// Event emitted when market is cancelled
    public struct MarketCancelled has copy, drop {
        market_id: ID,
        creator: address,
        timestamp: u64,
    }

    /// Event emitted when deadline is extended
    public struct DeadlineExtended has copy, drop {
        market_id: ID,
        old_deadline: u64,
        new_deadline: u64,
    }

    // ==================== Core Functions ====================

    /// Create a new voting market
    public fun create_market(
        question: String,
        options: vector<String>,
        initial_voters: vector<address>,
        duration_minutes: u64,
        whitelist_enabled: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        let options_count = vector::length(&options);
        assert!(options_count >= 2 && options_count <= 10, EInvalidOptionsCount);
        assert!(duration_minutes > 0, EInvalidDuration);

        let creator = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        let deadline = current_time + (duration_minutes * 60 * 1000);

        // Initialize votes vector with zeros
        let mut votes = vector::empty<u64>();
        let mut i = 0;
        while (i < options_count) {
            vector::push_back(&mut votes, 0);
            i = i + 1;
        };

        // Add creator to whitelist if whitelist is enabled
        let mut voters_list = initial_voters;
        if (whitelist_enabled && !vector::contains(&voters_list, &creator)) {
            vector::push_back(&mut voters_list, creator);
        };

        let market = VotingMarket {
            id: object::new(ctx),
            creator,
            question,
            options,
            votes,
            voters: vector::empty<address>(),
            deadline,
            whitelist_enabled,
            initial_voters: voters_list,
            created_at: current_time,
            is_active: true,
        };

        let market_id = object::id(&market);

        // Emit event
        sui::event::emit(MarketCreated {
            id: market_id,
            creator,
            question: market.question,
            deadline,
        });

        // Share the market object
        transfer::share_object(market);
    }

    /// Cast a vote in a market
    public fun vote(
        market: &mut VotingMarket,
        option_index: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check if market is active
        assert!(market.is_active, EMarketEnded);

        // Check if deadline has passed
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < market.deadline, EMarketEnded);

        // Validate option index
        assert!(option_index < vector::length(&market.options), EInvalidOption);

        let voter = tx_context::sender(ctx);

        // Check if already voted
        assert!(!vector::contains(&market.voters, &voter), EAlreadyVoted);

        // Check whitelist if enabled
        if (market.whitelist_enabled) {
            assert!(
                vector::contains(&market.initial_voters, &voter),
                ENotWhitelisted
            );
        };

        // Record vote
        let vote_count = vector::borrow_mut(&mut market.votes, option_index);
        *vote_count = *vote_count + 1;
        vector::push_back(&mut market.voters, voter);

        // Emit event
        sui::event::emit(VoteCast {
            market_id: object::id(market),
            voter,
            option_index,
            timestamp: current_time,
        });
    }

    /// Cancel market (only creator, only before deadline)
    public fun cancel_market(
        market: &mut VotingMarket,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == market.creator, ENotCreator);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < market.deadline, EMarketEnded);

        market.is_active = false;

        sui::event::emit(MarketCancelled {
            market_id: object::id(market),
            creator: sender,
            timestamp: current_time,
        });
    }

    /// Extend deadline (only creator, only before current deadline)
    public fun extend_deadline(
        market: &mut VotingMarket,
        additional_minutes: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == market.creator, ENotCreator);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < market.deadline, EMarketEnded);
        assert!(market.is_active, EMarketEnded);

        let old_deadline = market.deadline;
        market.deadline = market.deadline + (additional_minutes * 60 * 1000);

        sui::event::emit(DeadlineExtended {
            market_id: object::id(market),
            old_deadline,
            new_deadline: market.deadline,
        });
    }

    /// Add addresses to whitelist (only creator, only before deadline)
    public fun add_to_whitelist(
        market: &mut VotingMarket,
        addresses: vector<address>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == market.creator, ENotCreator);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < market.deadline, EMarketEnded);
        assert!(market.whitelist_enabled, ENotWhitelisted);

        let mut i = 0;
        let len = vector::length(&addresses);
        while (i < len) {
            let addr = *vector::borrow(&addresses, i);
            if (!vector::contains(&market.initial_voters, &addr)) {
                vector::push_back(&mut market.initial_voters, addr);
            };
            i = i + 1;
        };
    }

    // ==================== View Functions ====================

    /// Get market details
    public fun get_market_info(market: &VotingMarket): (
        address,
        String,
        vector<String>,
        vector<u64>,
        u64,
        bool,
        bool,
        u64,
        u64
    ) {
        (
            market.creator,
            market.question,
            market.options,
            market.votes,
            market.deadline,
            market.whitelist_enabled,
            market.is_active,
            market.created_at,
            vector::length(&market.voters)
        )
    }

    /// Check if address has voted
    public fun has_voted(market: &VotingMarket, addr: address): bool {
        vector::contains(&market.voters, &addr)
    }

    /// Get winning option index (after deadline)
    public fun get_winner(market: &VotingMarket): u64 {
        let mut max_votes = 0u64;
        let mut winner_index = 0u64;
        let mut i = 0;
        let len = vector::length(&market.votes);

        while (i < len) {
            let votes = *vector::borrow(&market.votes, i);
            if (votes > max_votes) {
                max_votes = votes;
                winner_index = i;
            };
            i = i + 1;
        };

        winner_index
    }
}
