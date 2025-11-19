import { ConnectButton } from "@mysten/dapp-kit";
import { useState } from "react";
import { CreateMarket } from "./CreateMarket";
import { Home } from "./Home";
import { Market } from "./Market.tsx";
import { MarketSearch } from "./MarketSearch";
import "./styles.css";

type Page = "home" | "create" | "markets" | "market";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const navigateToMarket = (id: string) => {
    setSelectedMarketId(id);
    setCurrentPage("market");
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand" onClick={() => setCurrentPage("home")}>
            <h1>Polysui</h1>
            <span className="testnet-badge">Testnet</span>
          </div>

          <div className="nav-links">
            <button
              className={`nav-link ${currentPage === "home" ? "active" : ""}`}
              onClick={() => setCurrentPage("home")}
            >
              Home
            </button>
            <button
              className={`nav-link ${currentPage === "create" ? "active" : ""}`}
              onClick={() => setCurrentPage("create")}
            >
              Create
            </button>
            <button
              className={`nav-link ${currentPage === "markets" ? "active" : ""}`}
              onClick={() => setCurrentPage("markets")}
            >
              Markets
            </button>
          </div>

          <div className="wallet-container">
            <ConnectButton />
          </div>
        </div>
      </nav>

      <main className="main-content">
        {currentPage === "home" && (
          <Home onNavigate={() => setCurrentPage("create")} />
        )}
        {currentPage === "create" && (
          <CreateMarket
            onCreated={navigateToMarket}
            onNotify={showNotification}
          />
        )}
        {currentPage === "markets" && (
          <MarketSearch onNavigate={navigateToMarket} />
        )}
        {currentPage === "market" && (
          <Market
            id={selectedMarketId}
            onBack={() => setCurrentPage("markets")}
            onNotify={showNotification}
          />
        )}
      </main>

      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;
