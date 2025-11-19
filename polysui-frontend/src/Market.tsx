import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useCurrentAccount,
} from "@mysten/dapp-kit";

import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiObjectId } from "@mysten/sui/utils";
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
      return "EAlreadyVoted";
    }
    if (
      errorString.includes("EMarketEnded") ||
      errorString.includes("code: 0") ||
      errorString.includes("abort code: 0")
    ) {
      return "This market has ended";
    }
    if (
      errorString.includes("ENotWhitelisted") ||
      errorString.includes("code: 1") ||
      errorString.includes("abort code: 1")
    ) {
      return "ENotWhitelisted";
    }
    if (
      errorString.includes("EInvalidOption") ||
      errorString.includes("code: 3") ||
      errorString.includes("abort code: 3")
    ) {
      return "Invalid option selected";
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

  const previousAccountRef = useRef<string | undefined>();

  const checkIfUserVoted = (data: any, userAddress: string): boolean => {
    if (!data || !data.voters || !userAddress) return false;
    const votersList = Array.isArray(data.voters) ? data.voters : [];
    return votersList.includes(userAddress);
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
          const voted = checkIfUserVoted(data, currentAccount.address);
          setHasUserVoted(voted);
          if (data.whitelist_enabled) {
            const votersList = Array.isArray(data.voters) ? data.voters : [];
            const initialVotersList = Array.isArray(data.initial_voters)
              ? data.initial_voters
              : [];
            const whitelisted =
              votersList.includes(currentAccount.address) ||
              initialVotersList.includes(currentAccount.address);
            setIsWhitelisted(whitelisted);
          } else {
            setIsWhitelisted(true);
          }
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

    // Simplified: Skip manual clock object fetching; pass clock object id directly
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
          const errorCode = parseMoveError(e);
          onNotify(errorCode, "error");
          setVotingFor(null);
        },
      },
    );
  };

  const handleAddToWhitelist = () => {
    if (!newAddress.trim() || !isValidSuiObjectId(newAddress.trim())) {
      onNotify("Please enter a valid Sui address", "error");
      return;
    }
    setIsAddingAddress(true);
    const tx = new Transaction();
    tx.moveCall({
      target: `${TESTNET_POLYSUI_PACKAGE_ID}::market::add_to_whitelist`,
      arguments: [
        tx.object(id),
        tx.pure.vector("address", [newAddress.trim()]),
        tx.object("0x6"),
      ],
    });
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

  const canVote = currentAccount && !isEnded && !hasUserVoted && isWhitelisted;

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
                className={`stat-value-new ${isEnded ? "ended" : "active"}`}
              >
                {isEnded ? "Ended" : "Active"}
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
              <span className="stat-value-new">{totalVotes}</span>
            </div>
          </div>
        </div>

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

        <div className="options-grid-new">
          {marketData.options.map((opt: string, idx: number) => {
            const voteCount = Number(marketData.votes[idx] || 0);
            const percentage =
              totalVotes > 0
                ? ((voteCount / totalVotes) * 100).toFixed(1)
                : "0";
            const isLeading =
              voteCount ===
                Math.max(...marketData.votes.map((v: string) => Number(v))) &&
              voteCount > 0;

            return (
              <div key={idx} className="option-box-new">
                <div className="option-header-new">
                  <h3>{opt}</h3>
                  {isLeading && (
                    <span className="badge-leading-new">Leading</span>
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
