module polysui::market {

    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use std::string::String;

    // ==================== Error Codes ====================
    const EMarketEnded: u64 = 0;
    const ENotWhitelisted: u64 = 1;
    const ENotCreator: u64 = 2;
    const EInvalidOption: u64 = 3;
    const EAlreadyVoted: u64 = 4;
    const EMarketCancelled: u64 = 5;
    const EInvalidDuration: u64 = 6;
    const EInvalidOptionsCount: u64 = 7;
    const ENoVotesCast: u64 = 8;
    const EExceedsMaxDeadline: u64 = 9;

    // Max total duration = 7 days in minutes
    const MAX_DURATION_MINUTES: u64 = 10080;

    // ==================== Structs ====================

    /// Main voting market object.
    /// `voters` is now a Table<address, u64> mapping voter -> option_index.
    /// This gives O(1) has_voted checks regardless of voter count.
    public struct VotingMarket has key, store {
        id: UID,
        creator: address,
        question: String,
        options: vector<String>,
        votes: vector<u64>,
        /// Maps voter address -> option_index they voted for
        voters: Table<address, u64>,
        deadline: u64,
        whitelist_enabled: bool,
        /// Allowed addresses (only checked when whitelist_enabled = true)
        initial_voters: vector<address>,
        created_at: u64,
        is_active: bool,
    }

    /// Emitted when a market is created
    public struct MarketCreated has copy, drop {
        id: ID,
        creator: address,
        question: String,
        deadline: u64,
    }

    /// Emitted when a vote is cast
    public struct VoteCast has copy, drop {
        market_id: ID,
        voter: address,
        option_index: u64,
        timestamp: u64,
    }

    /// Emitted when market is cancelled
    public struct MarketCancelled has copy, drop {
        market_id: ID,
        creator: address,
        timestamp: u64,
    }

    /// Emitted when deadline is extended
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
        let options_count = vector::length(&options);
        assert!(options_count >= 2 && options_count <= 10, EInvalidOptionsCount);
        assert!(duration_minutes > 0 && duration_minutes <= MAX_DURATION_MINUTES, EInvalidDuration);

        let creator = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        let deadline = current_time + (duration_minutes * 60 * 1000);

        let mut votes = vector::empty<u64>();
        let mut i = 0;
        while (i < options_count) {
            vector::push_back(&mut votes, 0);
            i = i + 1;
        };

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
            voters: table::new(ctx),
            deadline,
            whitelist_enabled,
            initial_voters: voters_list,
            created_at: current_time,
            is_active: true,
        };

        let market_id = object::id(&market);

        sui::event::emit(MarketCreated {
            id: market_id,
            creator,
            question: market.question,
            deadline,
        });

        transfer::share_object(market);
    }

    /// Cast a vote in a market
    public fun vote(
        market: &mut VotingMarket,
        option_index: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(market.is_active, EMarketCancelled);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < market.deadline, EMarketEnded);
        assert!(option_index < vector::length(&market.options), EInvalidOption);

        let voter = tx_context::sender(ctx);
        // O(1) duplicate check via Table lookup
        assert!(!table::contains(&market.voters, voter), EAlreadyVoted);

        if (market.whitelist_enabled) {
            assert!(
                vector::contains(&market.initial_voters, &voter),
                ENotWhitelisted
            );
        };

        let vote_count = vector::borrow_mut(&mut market.votes, option_index);
        *vote_count = *vote_count + 1;
        // Store voter -> option_index mapping
        table::add(&mut market.voters, voter, option_index);

        sui::event::emit(VoteCast {
            market_id: object::id(market),
            voter,
            option_index,
            timestamp: current_time,
        });
    }

    /// Cancel market (only creator, only if active and before deadline)
    public fun cancel_market(
        market: &mut VotingMarket,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == market.creator, ENotCreator);
        assert!(market.is_active, EMarketCancelled);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < market.deadline, EMarketEnded);

        market.is_active = false;

        sui::event::emit(MarketCancelled {
            market_id: object::id(market),
            creator: sender,
            timestamp: current_time,
        });
    }

    /// Extend deadline (only creator, capped at 7 days from created_at)
    public fun extend_deadline(
        market: &mut VotingMarket,
        additional_minutes: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == market.creator, ENotCreator);
        assert!(market.is_active, EMarketCancelled);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < market.deadline, EMarketEnded);

        let max_deadline = market.created_at + (MAX_DURATION_MINUTES * 60 * 1000);
        let new_deadline = market.deadline + (additional_minutes * 60 * 1000);
        assert!(new_deadline <= max_deadline, EExceedsMaxDeadline);

        let old_deadline = market.deadline;
        market.deadline = new_deadline;

        sui::event::emit(DeadlineExtended {
            market_id: object::id(market),
            old_deadline,
            new_deadline: market.deadline,
        });
    }

    /// Add addresses to whitelist (only creator, only if active and before deadline)
    public fun add_to_whitelist(
        market: &mut VotingMarket,
        addresses: vector<address>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == market.creator, ENotCreator);
        assert!(market.is_active, EMarketCancelled);

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

    /// Get market details. Returns voter_count as last field.
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
            table::length(&market.voters)
        )
    }

    /// O(1) check if address has voted (Table lookup)
    public fun has_voted(market: &VotingMarket, addr: address): bool {
        table::contains(&market.voters, addr)
    }

    /// Get the option index a voter chose. Aborts if addr has not voted.
    public fun get_vote(market: &VotingMarket, addr: address): u64 {
        *table::borrow(&market.voters, addr)
    }

    /// Get total voter count
    public fun total_votes(market: &VotingMarket): u64 {
        table::length(&market.voters)
    }

    /// Get winning option index after market ends.
    /// Aborts with EMarketEnded if market is still active/before deadline.
    /// Aborts with ENoVotesCast if no votes were cast.
    /// In case of a tie, returns the first option with highest votes.
    public fun get_winner(market: &VotingMarket, clock: &Clock): u64 {
        let current_time = clock::timestamp_ms(clock);
        assert!(
            current_time >= market.deadline || !market.is_active,
            EMarketEnded
        );
        assert!(table::length(&market.voters) > 0, ENoVotesCast);

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

    /// Check if the result is a tie (two or more options share max votes)
    public fun is_tie(market: &VotingMarket, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        assert!(
            current_time >= market.deadline || !market.is_active,
            EMarketEnded
        );

        if (table::length(&market.voters) == 0) return false;

        let mut max_votes = 0u64;
        let mut max_count = 0u64;
        let mut i = 0;
        let len = vector::length(&market.votes);

        while (i < len) {
            let votes = *vector::borrow(&market.votes, i);
            if (votes > max_votes) {
                max_votes = votes;
                max_count = 1;
            } else if (votes == max_votes && votes > 0) {
                max_count = max_count + 1;
            };
            i = i + 1;
        };

        max_count > 1
    }
}
