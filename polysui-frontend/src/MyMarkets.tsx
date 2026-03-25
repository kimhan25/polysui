import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { useState, useEffect } from "react";
import { TESTNET_POLYSUI_PACKAGE_ID } from "./constants";
import "./styles.css";

interface MarketSummary {
  id: string;
  question: string;
  deadline: number;
  creator: string;
}

export function MyMarkets({
  onNavigate,
}: {
  onNavigate: (id: string) => void;
}) {
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchMyMarkets = async () => {
    if (!currentAccount?.address) {
      setMarkets([]);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const events = await client.queryEvents({
        query: {
          MoveEventType: `${TESTNET_POLYSUI_PACKAGE_ID}::market::MarketCreated`,
        },
        limit: 50,
        order: "descending",
      });

      const myEvents = events.data.filter((e: any) => {
        const fields = e.parsedJson as any;
        return fields?.creator === currentAccount.address;
      });

      const summaries: MarketSummary[] = myEvents.map((e: any) => {
        const fields = e.parsedJson as any;
        return {
          id: fields.id,
          question: fields.question,
          deadline: Number(fields.deadline),
          creator: fields.creator,
        };
      });

      setMarkets(summaries);
    } catch (err) {
      console.error(err);
      setError("Failed to load your markets. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyMarkets();
  }, [currentAccount?.address]);

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

  if (!currentAccount) {
    return (
      <div className="market-search-page">
        <div className="page-header-clean">
          <h1>My Markets</h1>
          <p>Connect your wallet to see markets you created</p>
        </div>
        <div className="search-section-large">
          <p className="help-text">
            Please connect your Sui wallet to view your created markets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="market-search-page">
      <div className="page-header-clean">
        <h1>My Markets</h1>
        <p>Voting markets you have created</p>
      </div>

      <div className="search-section-large">
        {isLoading && (
          <div className="loading">Loading your markets...</div>
        )}

        {error && <div className="error-message">{error}</div>}

        {!isLoading && !error && markets.length === 0 && (
          <div className="search-card-large">
            <p className="help-text">
              You haven’t created any markets yet.{" "}
              <span
                style={{ color: "var(--primary, #7c3aed)", cursor: "pointer" }}
              >
                Create one now!
              </span>
            </p>
          </div>
        )}

        {!isLoading && markets.length > 0 && (
          <div className="markets-list">
            {markets.map((market) => {
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
          onClick={fetchMyMarkets}
          disabled={isLoading}
          style={{ marginTop: "1rem" }}
        >
          {isLoading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>
    </div>
  );
}
