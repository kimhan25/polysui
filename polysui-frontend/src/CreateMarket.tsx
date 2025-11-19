import { Transaction } from "@mysten/sui/transactions";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useState } from "react";
import { TESTNET_POLYSUI_PACKAGE_ID, TESTNET_CLOCK_ID } from "./constants";
import "./styles.css";

interface CreateMarketProps {
  onCreated: (id: string) => void;
  onNotify: (msg: string, type: "success" | "error") => void;
}

export function CreateMarket({ onCreated, onNotify }: CreateMarketProps) {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("60");
  const [accessType, setAccessType] = useState<"public" | "whitelist">(
    "public",
  );
  const [whitelist, setWhitelist] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showMarketId, setShowMarketId] = useState(false);
  const [createdMarketId, setCreatedMarketId] = useState("");

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentAccount) {
      onNotify("Please connect your wallet first", "error");
      return;
    }

    const filledOptions = options.filter((opt) => opt.trim() !== "");
    if (filledOptions.length < 2) {
      onNotify("Please provide at least 2 options", "error");
      return;
    }

    if (!question.trim()) {
      onNotify("Please enter a question", "error");
      return;
    }

    const durationNum = parseInt(duration);
    if (durationNum < 1) {
      onNotify("Duration must be at least 1 minute", "error");
      return;
    }

    let whitelistAddresses: string[] = [];
    if (accessType === "whitelist") {
      whitelistAddresses = whitelist
        .split("\n")
        .map((addr) => addr.trim())
        .filter((addr) => addr.length > 0);

      if (whitelistAddresses.length === 0) {
        onNotify("Please add at least one address to the whitelist", "error");
        return;
      }
    }

    setIsCreating(true);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${TESTNET_POLYSUI_PACKAGE_ID}::market::create_market`,
        arguments: [
          tx.pure.string(question),
          tx.pure.vector("string", filledOptions),
          tx.pure.vector("address", whitelistAddresses),
          tx.pure.u64(durationNum),
          tx.pure.bool(accessType === "whitelist"),
          tx.object(TESTNET_CLOCK_ID),
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            console.log("Transaction successful:", result);

            try {
              // Wait a bit for the transaction to be processed
              await new Promise((resolve) => setTimeout(resolve, 2000));

              // Fetch transaction details to get the created objects
              const txResponse = await suiClient.getTransactionBlock({
                digest: result.digest,
                options: {
                  showObjectChanges: true,
                  showEffects: true,
                },
              });

              console.log("Transaction details:", txResponse);

              // Find the created market object
              let marketId = "";
              if (txResponse.objectChanges) {
                for (const change of txResponse.objectChanges) {
                  if (
                    change.type === "created" &&
                    change.objectType.includes("::market::VotingMarket")
                  ) {
                    marketId = change.objectId;
                    break;
                  }
                }
              }

              if (marketId) {
                setCreatedMarketId(marketId);
                setShowMarketId(true);
                onNotify("Market created successfully!", "success");

                // Reset form
                setQuestion("");
                setOptions(["", ""]);
                setDuration("60");
                setAccessType("public");
                setWhitelist("");
              } else {
                onNotify(
                  "Market created but couldn't get ID. Check Sui Explorer with your wallet address.",
                  "success",
                );
              }
            } catch (error) {
              console.error("Error fetching transaction details:", error);
              onNotify(
                "Market created! Check Sui Explorer with your wallet address for the Market ID.",
                "success",
              );
            }

            setIsCreating(false);
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            onNotify("Failed to create market. Please try again.", "error");
            setIsCreating(false);
          },
        },
      );
    } catch (error) {
      console.error("Error creating market:", error);
      onNotify("Failed to create market. Please try again.", "error");
      setIsCreating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(createdMarketId);
    onNotify("Market ID copied to clipboard!", "success");
  };

  return (
    <div className="create-market-clean">
      <div className="page-header-clean">
        <h1>Create Voting Market</h1>
        <p>Set up your voting market with custom options and settings</p>
      </div>

      {/* Market ID Modal */}
      {showMarketId && (
        <div className="modal-overlay" onClick={() => setShowMarketId(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Market Created Successfully!</h2>
            <p>Your Market ID:</p>
            <div className="market-id-box">
              <code>{createdMarketId}</code>
            </div>
            <div className="modal-actions">
              <button className="btn-copy" onClick={copyToClipboard}>
                Copy Market ID
              </button>
              <button
                className="btn-primary-modal"
                onClick={() => {
                  setShowMarketId(false);
                  onCreated(createdMarketId);
                }}
              >
                View Market
              </button>
            </div>
            <button
              className="btn-close-modal"
              onClick={() => setShowMarketId(false)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card-clean">
        <div className="form-group-clean">
          <label htmlFor="question">Question</label>
          <textarea
            id="question"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What would you like to vote on?"
            required
          />
        </div>

        <div className="form-group-clean">
          <label>Voting Options (2-10)</label>
          <div className="options-list-clean">
            {options.map((option, index) => (
              <div key={index} className="option-input-clean">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  required
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="btn-delete-clean"
                    onClick={() => removeOption(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button type="button" className="btn-add-clean" onClick={addOption}>
              + Add Option
            </button>
          )}
        </div>

        <div className="form-row-clean">
          <div className="form-group-clean">
            <label htmlFor="duration">Duration (minutes)</label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              required
            />
            <small>Minimum: 1 minute</small>
          </div>

          <div className="form-group-clean">
            <label>Who Can Vote?</label>
            <div className="access-buttons-clean">
              <button
                type="button"
                className={`access-btn-clean ${
                  accessType === "public" ? "active" : ""
                }`}
                onClick={() => setAccessType("public")}
              >
                <div>
                  <strong>Public</strong>
                  <small>Anyone can vote</small>
                </div>
              </button>
              <button
                type="button"
                className={`access-btn-clean ${
                  accessType === "whitelist" ? "active" : ""
                }`}
                onClick={() => setAccessType("whitelist")}
              >
                <div>
                  <strong>Whitelist</strong>
                  <small>Selected addresses only</small>
                </div>
              </button>
            </div>
          </div>
        </div>

        {accessType === "whitelist" && (
          <div className="form-group-clean">
            <label htmlFor="whitelist">Whitelist Addresses</label>
            <textarea
              id="whitelist"
              rows={5}
              value={whitelist}
              onChange={(e) => setWhitelist(e.target.value)}
              placeholder="0x123...&#10;0x456...&#10;0x789..."
              className="monospace"
            />
            <small>Enter one address per line</small>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary-full"
          disabled={isCreating || !currentAccount}
        >
          {isCreating
            ? "Creating..."
            : !currentAccount
              ? "Connect Wallet First"
              : "Create Market"}
        </button>
      </form>
    </div>
  );
}
