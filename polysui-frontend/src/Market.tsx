import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useCurrentAccount,
} from "@mysten/dapp-kit";

import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiObjectId, isValidSuiAddress } from "@mysten/sui/utils";
import { useState, useEffect, useRef } from "react";
import { TESTNET_POLYSUI_PACKAGE_ID } from "./constants";
import "./styles.css";

function parseMoveError(error: any): string {
  try {
    const errorString =
      typeof error === "string"
        ? error
        : error?.message || JSON.stringify(error);
    if (
      errorString.includes("User rejected") ||
      errorString.includes("rejected the request")
    ) {
      return "Transaction cancelled by user";
    }
    if (
      errorString.includes("EAlreadyVoted") ||
      errorString.includes("code: 4") ||
      errorString.includes("abort code: 4")
    ) {
      return "You have already voted in this market";
    }
    if (
      errorString.includes("EMarketEnded") ||
      errorString.includes("code: 0") ||
      errorString.includes("abort code: 0")
    ) {
      return "This market has ended";
    }
    if (
      errorString.includes("EMarketCancelled") ||
      errorString.includes("code: 5") ||
      errorString.includes("abort code: 5")
    ) {
      return "This market has been cancelled";
    }
    if (
      errorString.includes("ENotWhitelisted") ||
      errorString.includes("code: 1") ||
      errorString.includes("abort code: 1")
    ) {
      return "Your wallet is not whitelisted for this market";
    }
    if (
      errorString.includes("EInvalidOption") ||
      errorString.includes("code: 3") ||
      errorString.includes("abort code: 3")
    ) {
      return "Invalid option selected";
    }
    if (
      errorString.includes("EExceedsMaxDeadline") ||
      errorString.includes("code: 9") ||
      errorString.includes("abort code: 9")
    ) {
      return "Extension would exceed maximum allowed duration (7 days)";
    }
    if (errorString.includes("Insufficient")) {
      return "Insufficient SUI balance";
    }
    return "Transaction failed";
  } catch (e) {
    return "Transaction failed";
  }
}

export function Market({
  id,
  onBack,
  onNotify,
}: {
  id: string;
  onBack: () => void;
  onNotify: (msg: string, type: "success" | "error") => void;
}) {
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [marketData, setMarketData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [votingFor, setVotingFor] = useState<number | null>(null);
  const [hasUserVoted, setHasUserVoted] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(true);
  const [showWhitelistManager, setShowWhitelistManager] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState("60");
  const [isExtending, setIsExtending] = useState(false);
  const [showExtendForm, setShowExtendForm] = useState(false);

  const previousAccountRef = useRef<string | undefined>();

  // After Table refactor: voters is a Table<address,u64> on-chain.
  // The RPC returns it as a dynamic field object, so we can't do
  // voters.includes() anymore. Instead we call has_voted via devInspect,
  // or we rely on the VoteCast event. Simplest: check via getObject fields
  // which for Table returns { id, size } — so we query has_voted via devInspect.
  const checkIfUserVoted = async (
    marketId: string,
    userAddress: string
  ): Promise<boolean> => {
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${TESTNET_POLYSUI_PACKAGE_ID}::market::has_voted`,
        arguments: [tx.object(marketId), tx.pure.address(userAddress)],
      });
      const result = await client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: userAddress,
      });
      if (
        result.results &&
        result.results[0]?.returnValues &&
        result.results[0].returnValues[0]
      ) {
        const [valueBytes] = result.results[0].returnValues[0];
        return valueBytes[0] === 1;
      }
      return false;
    } catch {
      return false;
    }
  };

  const checkIfWhitelisted = (data: any, userAddress: string): boolean => {
    if (!data.whitelist_enabled) return true;
    const initialVotersList = Array.isArray(data.initial_voters)
      ? data.initial_voters
      : [];
    return initialVotersList.includes(userAddress);
  };

  const isCreator = currentAccount?.address === marketData?.creator;

  const fetchMarket = async () => {
    if (!isValidSuiObjectId(id)) {
      setIsLoading(false);
      return;
    }
    try {
      const obj = await client.getObject({
        id,
        options: { showContent: true },
      });
      if (obj.data?.content?.dataType === "moveObject") {
        const data = obj.data.content.fields as any;
        setMarketData(data);
        if (currentAccount?.address) {
          // Use devInspect for O(1) has_voted check (Table-based)
          const voted = await checkIfUserVoted(id, currentAccount.address);
          setHasUserVoted(voted);
          setIsWhitelisted(checkIfWhitelisted(data, currentAccount.address));
        } else {
          setHasUserVoted(false);
          setIsWhitelisted(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const currentAddr = currentAccount?.address;
    const previousAddr = previousAccountRef.current;
    if (previousAddr !== undefined && previousAddr !== currentAddr) {
      setIsLoading(true);
      setHasUserVoted(false);
      setIsWhitelisted(true);
      fetchMarket();
    }
    previousAccountRef.current = currentAddr;
  }, [currentAccount?.address]);

  useEffect(() => {
    fetchMarket();
    const interval = setInterval(fetchMarket, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const handleVote = async (index: number) => {
    if (hasUserVoted) {
      onNotify("You have already voted in this market", "error");
      return;
    }
    setVotingFor(index);

    const tx = new Transaction();
    tx.moveCall({
      target: `${TESTNET_POLYSUI_PACKAGE_ID}::market::vote`,
      arguments: [tx.object(id), tx.pure.u64(BigInt(index)), tx.object("0x6")],
    });
    tx.setGasBudget(100_000_000);

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (res) => {
          try {
            await client.waitForTransaction({ digest: res.digest });
            onNotify("Vote recorded successfully", "success");
            setHasUserVoted(true);
            await fetchMarket();
          } catch {
            onNotify("Vote confirmed", "success");
            setHasUserVoted(true);
          } finally {
            setVotingFor(null);
          }
        },
        onError: (e: any) => {
          console.error("Voting tx failure:", e);
          const errorMsg = parseMoveError(e);
          onNotify(errorMsg, "error");
          setVotingFor(null);
        },
      },
    );
  };

  const handleAddToWhitelist = () => {
    const trimmed = newAddress.trim();
    if (!trimmed || !isValidSuiAddress(trimmed)) {
      onNotify("Please enter a valid Sui wallet address", "error");
      return;
    }
    setIsAddingAddress(true);
    const tx = new Transaction();
    tx.moveCall({
      target: `${TESTNET_POLYSUI_PACKAGE_ID}::market::add_to_whitelist`,
      arguments: [
        tx.object(id),
        tx.pure.vector("address", [trimmed]),
        tx.object("0x6"),
      ],
    });
    tx.setGasBudget(100_000_000);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async () => {
          onNotify("Address added to whitelist", "success");
          setNewAddress("");
          await fetchMarket();
          setIsAddingAddress(false);
        },
        onError: (e: any) => {
          const error = parseMoveError(e);
          onNotify(
            error === "Transaction cancelled by user"
              ? error
              : "Failed to add address",
            "error",
          );
          setIsAddingAddress(false);
        },
      },
    );
  };

  const handleExtendDeadline = () => {
    const mins = parseInt(extendMinutes);
    if (!mins || mins < 1) {
      onNotify("Please enter a valid number of minutes (min 1)", "error");
      return;
    }
    setIsExtending(true);
    const tx = new Transaction();
    tx.moveCall({
      target: `${TESTNET_POLYSUI_PACKAGE_ID}::market::extend_deadline`,
      arguments: [
        tx.object(id),
        tx.pure.u64(BigInt(mins)),
        tx.object("0x6"),
      ],
    });
    tx.setGasBudget(100_000_000);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async () => {
          onNotify(`Deadline extended by ${mins} minute(s)`, "success");
          setExtendMinutes("60");
          setShowExtendForm(false);
          await fetchMarket();
          setIsExtending(false);
        },
        onError: (e: any) => {
          const error = parseMoveError(e);
          onNotify(error, "error");
          setIsExtending(false);
        },
      },
    );
  };

  const handleShare = () => {
    navigator.clipboard.writeText(id);
    onNotify("Market ID copied to clipboard", "success");
  };

  const formatTime = (deadline: number): string => {
    const remaining = Number(deadline) - Date.now();
    if (remaining <= 0) return "Ended";
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="market-container">
        <div className="loading">Loading market...</div>
      </div>
    );
  }

  if (!marketData) {
    return (
      <div className="market-container">
        <div className="error-state">
          <p>Market not found</p>
          <button className="btn-secondary-new" onClick={onBack}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isEnded = Date.now() > Number(marketData.deadline);
  const totalVotes = marketData.votes
    ? marketData.votes.reduce((sum: number, v: string) => sum + Number(v), 0)
    : 0;

  // Tie/winner detection (frontend, uses votes vector which is unchanged)
  const voteCounts = marketData.votes
    ? marketData.votes.map((v: string) => Number(v))
    : [];
  const maxVotes = voteCounts.length > 0 ? Math.max(...voteCounts) : 0;
  const winnerIndices = voteCounts
    .map((v: number, i: number) => (v === maxVotes && maxVotes > 0 ? i : -1))
    .filter((i: number) => i !== -1);
  const isTie = winnerIndices.length > 1;
  const winnerIndex = winnerIndices.length === 1 ? winnerIndices[0] : -1;

  // voters field from RPC is now { id: string, size: string } (Table object)
  // Use the sum of votes vector for total count instead
  const voterCount = totalVotes;

  const canVote =
    currentAccount &&
    !isEnded &&
    !hasUserVoted &&
    isWhitelisted &&
    marketData.is_active;

  return (
    <div className="market-container">
      <div className="container">
        <div className="market-header-new">
          <button className="btn-back-new" onClick={onBack}>
            ← Back to Markets
          </button>
          <button className="btn-secondary-new" onClick={handleShare}>
            Copy Market ID
          </button>
        </div>

        <div className="market-info-new">
          <div className="market-title-row-new">
            <h1>{marketData.question}</h1>
            {marketData.whitelist_enabled && (
              <span className="badge-new">Whitelist Only</span>
            )}
          </div>

          <div className="market-stats-new">
            <div className="stat-item-new">
              <span className="stat-label-new">Status</span>
              <span
                className={`stat-value-new ${
                  !marketData.is_active
                    ? "ended"
                    : isEnded
                    ? "ended"
                    : "active"
                }`}
              >
                {!marketData.is_active
                  ? "Cancelled"
                  : isEnded
                  ? "Ended"
                  : "Active"}
              </span>
            </div>
            <div className="stat-item-new">
              <span className="stat-label-new">Time Remaining</span>
              <span className="stat-value-new">
                {formatTime(marketData.deadline)}
              </span>
            </div>
            <div className="stat-item-new">
              <span className="stat-label-new">Total Votes</span>
              <span className="stat-value-new">{voterCount}</span>
            </div>
          </div>
        </div>

        {/* Winner / Tie banner */}
        {(isEnded || !marketData.is_active) && totalVotes > 0 && (
          <div className={`alert-new ${isTie ? "" : "success"}`}>
            {isTie
              ? `🤝 It’s a tie between: ${winnerIndices
                  .map((i: number) => marketData.options[i])
                  .join(" & ")}`
              : `🏆 Winner: ${marketData.options[winnerIndex]} (${maxVotes} vote${
                  maxVotes !== 1 ? "s" : ""
                })`}
          </div>
        )}

        {/* Creator: extend deadline */}
        {isCreator && marketData.is_active && !isEnded && (
          <div className="whitelist-manager">
            <div className="whitelist-header">
              <h3>Creator Controls</h3>
              <button
                className="btn-toggle-whitelist"
                onClick={() => setShowExtendForm(!showExtendForm)}
              >
                {showExtendForm ? "Hide" : "Extend Deadline"}
              </button>
            </div>
            {showExtendForm && (
              <div className="whitelist-content">
                <p className="whitelist-description">
                  Extend the market deadline (max 7 days total from creation)
                </p>
                <div className="whitelist-input-row">
                  <input
                    type="number"
                    min="1"
                    placeholder="Minutes to add"
                    value={extendMinutes}
                    onChange={(e) => setExtendMinutes(e.target.value)}
                    className="whitelist-input"
                  />
                  <button
                    className="btn-add-whitelist"
                    onClick={handleExtendDeadline}
                    disabled={isExtending || !extendMinutes}
                  >
                    {isExtending ? "Extending..." : "Extend"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isCreator && marketData.whitelist_enabled && (
          <div className="whitelist-manager">
            <div className="whitelist-header">
              <h3>
                Manage Whitelist
                <span className="whitelist-count">
                  {marketData.initial_voters?.length || 0}
                </span>
              </h3>
              <button
                className="btn-toggle-whitelist"
                onClick={() => setShowWhitelistManager(!showWhitelistManager)}
              >
                {showWhitelistManager ? "Hide" : "Show"}
              </button>
            </div>

            {showWhitelistManager && (
              <div className="whitelist-content">
                <p className="whitelist-description">
                  Add wallet addresses that are allowed to vote in this market
                </p>
                <div className="whitelist-input-row">
                  <input
                    type="text"
                    placeholder="0x123abc..."
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="whitelist-input"
                  />
                  <button
                    className="btn-add-whitelist"
                    onClick={handleAddToWhitelist}
                    disabled={isAddingAddress || !newAddress.trim()}
                  >
                    {isAddingAddress ? "Adding..." : "Add Address"}
                  </button>
                </div>
                <div className="whitelist-list">
                  <strong>Whitelisted Addresses:</strong>
                  {marketData.initial_voters &&
                  marketData.initial_voters.length > 0 ? (
                    <ul>
                      {marketData.initial_voters.map(
                        (addr: string, idx: number) => (
                          <li key={idx}>
                            <code>{addr}</code>
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="no-addresses">No addresses whitelisted yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {hasUserVoted && (
          <div className="alert-new success">
            ✓ You have already voted in this market
          </div>
        )}

        {!isWhitelisted && currentAccount && marketData.whitelist_enabled && (
          <div className="alert-new error">
            ✗ Your wallet is not whitelisted for this market
          </div>
        )}

        {!marketData.is_active && (
          <div className="alert-new error">
            ✗ This market has been cancelled by the creator
          </div>
        )}

        <div className="options-grid-new">
          {marketData.options.map((opt: string, idx: number) => {
            const voteCount = Number(marketData.votes[idx] || 0);
            const percentage =
              totalVotes > 0
                ? ((voteCount / totalVotes) * 100).toFixed(1)
                : "0";
            const isLeadingOption = winnerIndices.includes(idx) && maxVotes > 0;

            return (
              <div key={idx} className="option-box-new">
                <div className="option-header-new">
                  <h3>{opt}</h3>
                  {isLeadingOption && (
                    <span className="badge-leading-new">
                      {isTie
                        ? "Tied"
                        : isEnded || !marketData.is_active
                        ? "🏆 Winner"
                        : "Leading"}
                    </span>
                  )}
                </div>

                <div className="option-stats-new">
                  <span>{voteCount} votes</span>
                  <span className="percentage-new">{percentage}%</span>
                </div>

                <div className="progress-new">
                  <div
                    className="progress-bar-new"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <button
                  className={`btn-vote-new ${votingFor === idx ? "voting" : ""}`}
                  onClick={() => handleVote(idx)}
                  disabled={!canVote || votingFor !== null}
                >
                  {votingFor === idx
                    ? "Voting..."
                    : !marketData.is_active
                    ? "Cancelled"
                    : hasUserVoted
                    ? "Already Voted"
                    : !isWhitelisted && marketData.whitelist_enabled
                    ? "Not Whitelisted"
                    : isEnded
                    ? "Ended"
                    : "Vote"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
