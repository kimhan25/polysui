import { useSuiClient } from "@mysten/dapp-kit";
import { isValidSuiObjectId } from "@mysten/sui/utils";
import { useState, useEffect } from "react";
import { TESTNET_POLYSUI_PACKAGE_ID } from "./constants";
import "./styles.css";

interface MarketSummary {
  id: string;
  question: string;
  deadline: number;
  creator: string;
}

type Tab = "search" | "browse";

export function MarketSearch({
  onNavigate,
}: {
  onNavigate: (id: string) => void;
}) {
  const client = useSuiClient();
  const [tab, setTab] = useState<Tab>("browse");

  // Search tab state
  const [marketId, setMarketId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  // Browse tab state
  const [recentMarkets, setRecentMarkets] = useState<MarketSummary[]>([]);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState("");

  const fetchRecentMarkets = async () => {
    setIsBrowseLoading(true);
    setBrowseError("");
    try {
      const events = await client.queryEvents({
        query: {
          MoveEventType: `${TESTNET_POLYSUI_PACKAGE_ID}::market::MarketCreated`,
        },
        limit: 20,
        order: "descending",
      });

      const summaries: MarketSummary[] = events.data.map((e: any) => {
        const fields = e.parsedJson as any;
        return {
          id: fields.id,
          question: fields.question,
          deadline: Number(fields.deadline),
          creator: fields.creator,
        };
      });

      setRecentMarkets(summaries);
    } catch (err) {
      console.error(err);
      setBrowseError("Failed to load recent markets.");
    } finally {
      setIsBrowseLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "browse") {
      fetchRecentMarkets();
    }
  }, [tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");

    const trimmedId = marketId.trim();

    if (!trimmedId) {
      setSearchError("Please enter a Market ID");
      return;
    }

    if (!isValidSuiObjectId(trimmedId)) {
      setSearchError(
        "Invalid Market ID format. Please enter a valid Sui Object ID starting with 0x"
      );
      return;
    }

    setIsChecking(true);

    try {
      const obj = await client.getObject({
        id: trimmedId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!obj.data) {
        setSearchError(
          "Market not found. Please check the Market ID and try again."
        );
        setIsChecking(false);
        return;
      }

      if (obj.data.content?.dataType !== "moveObject") {
        setSearchError(
          "This object is not a valid market. Please enter a correct Market ID."
        );
        setIsChecking(false);
        return;
      }

      const objectType = obj.data.type;
      const expectedType = `${TESTNET_POLYSUI_PACKAGE_ID}::market::VotingMarket`;

      if (!objectType || !objectType.startsWith(expectedType)) {
        setSearchError(
          "This object exists but is not a Polysui market. Please enter a valid Market ID."
        );
        setIsChecking(false);
        return;
      }

      onNavigate(trimmedId);
    } catch (error: any) {
      console.error("Error checking market:", error);
      setSearchError(
        "Market not found. Please check the Market ID and try again."
      );
      setIsChecking(false);
    }
  };

  const formatDeadline = (deadline: number): string => {
    const now = Date.now();
    if (deadline <= now) return "Ended";
    const remaining = deadline - now;
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  return (
    <div className="market-search-page">
      <div className="page-header-clean">
        <h1>Markets</h1>
        <p>Browse recent markets or search by ID</p>
      </div>

      {/* Tab switcher */}
      <div className="tab-switcher">
        <button
          className={`tab-btn ${tab === "browse" ? "active" : ""}`}
          onClick={() => setTab("browse")}
        >
          📊 Browse Recent
        </button>
        <button
          className={`tab-btn ${tab === "search" ? "active" : ""}`}
          onClick={() => setTab("search")}
        >
          🔍 Search by ID
        </button>
      </div>

      {/* Browse tab */}
      {tab === "browse" && (
        <div className="search-section-large">
          {isBrowseLoading && (
            <div className="loading">Loading recent markets...</div>
          )}
          {browseError && (
            <div className="error-message">{browseError}</div>
          )}
          {!isBrowseLoading && !browseError && recentMarkets.length === 0 && (
            <p className="help-text">No markets found yet. Be the first to create one!</p>
          )}
          {!isBrowseLoading && recentMarkets.length > 0 && (
            <div className="markets-list">
              {recentMarkets.map((market) => {
                const isEnded = Date.now() > market.deadline;
                return (
                  <div
                    key={market.id}
                    className="market-list-item"
                    onClick={() => onNavigate(market.id)}
                  >
                    <div className="market-list-content">
                      <div className="market-list-question">
                        {market.question}
                      </div>
                      <div className="market-list-meta">
                        <span
                          className={`stat-value-new ${
                            isEnded ? "ended" : "active"
                          }`}
                        >
                          {isEnded ? "Ended" : "Active"}
                        </span>
                        <span className="market-list-deadline">
                          {formatDeadline(market.deadline)}
                        </span>
                        <span className="market-list-id">
                          {market.id.slice(0, 10)}...
                        </span>
                      </div>
                    </div>
                    <button className="btn-secondary-new">View →</button>
                  </div>
                );
              })}
            </div>
          )}
          <button
            className="btn-secondary-new"
            onClick={fetchRecentMarkets}
            disabled={isBrowseLoading}
            style={{ marginTop: "1rem" }}
          >
            {isBrowseLoading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      )}

      {/* Search by ID tab */}
      {tab === "search" && (
        <div className="search-section-large">
          <form onSubmit={handleSubmit} className="search-card-large">
            <input
              type="text"
              placeholder="0x..."
              value={marketId}
              onChange={(e) => {
                setMarketId(e.target.value);
                if (searchError) setSearchError("");
              }}
              className={searchError ? "input-error" : ""}
              disabled={isChecking}
              autoFocus
            />

            {searchError && (
              <div className="error-message">{searchError}</div>
            )}

            <button type="submit" disabled={!marketId.trim() || isChecking}>
              {isChecking ? "Checking..." : "View Market"}
            </button>
          </form>

          <p className="help-text">
            Market IDs are shared by creators after creating a market. Paste
            the full ID starting with 0x to view the market.
          </p>
        </div>
      )}
    </div>
  );
}
