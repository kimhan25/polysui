import { useSuiClient } from "@mysten/dapp-kit";
import { isValidSuiObjectId } from "@mysten/sui/utils";
import { useState } from "react";
import { TESTNET_POLYSUI_PACKAGE_ID } from "./constants";
import "./styles.css";

export function MarketSearch({
  onNavigate,
}: {
  onNavigate: (id: string) => void;
}) {
  const client = useSuiClient();
  const [marketId, setMarketId] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedId = marketId.trim();

    if (!trimmedId) {
      setError("Please enter a Market ID");
      return;
    }

    if (!isValidSuiObjectId(trimmedId)) {
      setError(
        "Invalid Market ID format. Please enter a valid Sui Object ID starting with 0x",
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
        setError("Market not found. Please check the Market ID and try again.");
        setIsChecking(false);
        return;
      }

      if (obj.data.content?.dataType !== "moveObject") {
        setError(
          "This object is not a valid market. Please enter a correct Market ID.",
        );
        setIsChecking(false);
        return;
      }

      const objectType = obj.data.type;
      const expectedType = `${TESTNET_POLYSUI_PACKAGE_ID}::market::VotingMarket`;

      if (!objectType || !objectType.startsWith(expectedType)) {
        setError(
          "This object exists but is not a Polysui market. Please enter a valid Market ID.",
        );
        setIsChecking(false);
        return;
      }

      onNavigate(trimmedId);
    } catch (error: any) {
      console.error("Error checking market:", error);
      setError("Market not found. Please check the Market ID and try again.");
      setIsChecking(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMarketId(e.target.value);
    if (error) {
      setError("");
    }
  };

  return (
    <div className="market-search-page">
      <div className="page-header-clean">
        <h1>Find a Market</h1>
        <p>Enter a Market ID to view and participate</p>
      </div>

      <div className="search-section-large">
        <form onSubmit={handleSubmit} className="search-card-large">
          <input
            type="text"
            placeholder="0x..."
            value={marketId}
            onChange={handleInputChange}
            className={error ? "input-error" : ""}
            disabled={isChecking}
            autoFocus
          />

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={!marketId.trim() || isChecking}>
            {isChecking ? "Checking..." : "View Market"}
          </button>
        </form>

        <p className="help-text">
          Market IDs are shared by creators after creating a market. Paste the
          full ID starting with 0x to view the market.
        </p>
      </div>
    </div>
  );
}
