// src/Home.tsx
import "./styles.css";

interface HomeProps {
  onNavigate: () => void;
}

export function Home({ onNavigate }: HomeProps) {
  return (
    <div className="home-final">
      <section className="hero-final">
        <div className="container">
          <div className="hero-content-center">
            <div className="hero-badge-final">Powered by Sui Blockchain</div>

            <h1 className="hero-title-final">Decentralized Voting Platform</h1>

            <p className="hero-subtitle-final">
              Create transparent, immutable voting markets on the blockchain.
              One vote per user, fully on-chain.
            </p>

            <button className="btn-primary-final" onClick={onNavigate}>
              Get Started →
            </button>
          </div>
        </div>
      </section>

      <section className="features-final">
        <div className="container">
          <div className="section-intro-final">
            <span className="section-tag-final">Platform</span>
            <h2>Why Choose Polysui</h2>
            <p>Built for transparency, security, and ease of use</p>
          </div>

          <div className="features-grid-final">
            <div className="feature-box-final">
              <h3>Secure & Verified</h3>
              <p>
                Built on Sui blockchain with audited smart contracts ensuring
                complete security
              </p>
            </div>

            <div className="feature-box-final">
              <h3>Fast & Efficient</h3>
              <p>
                Instant vote recording with minimal transaction fees on Sui
                network
              </p>
            </div>

            <div className="feature-box-final">
              <h3>Fair & Transparent</h3>
              <p>
                One vote per wallet address with publicly verifiable results
              </p>
            </div>

            <div className="feature-box-final">
              <h3>Fully Decentralized</h3>
              <p>
                No central authority required, completely on-chain governance
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="use-cases-final">
        <div className="container">
          <div className="section-intro-final">
            <span className="section-tag-final">Use Cases</span>
            <h2>Perfect For Every Scenario</h2>
            <p>From DAOs to teams, events to product decisions</p>
          </div>

          <div className="use-cases-grid-final">
            <div className="use-case-box-final">
              <h3>Community Governance</h3>
              <p>
                Let your community vote on proposals, feature requests, and
                project direction
              </p>
            </div>

            <div className="use-case-box-final">
              <h3>Team Decisions</h3>
              <p>
                Make quick team decisions on meeting times, project priorities,
                or budget allocation
              </p>
            </div>

            <div className="use-case-box-final">
              <h3>Event Planning</h3>
              <p>
                Organize events democratically by voting on venues, dates,
                themes, and activities
              </p>
            </div>

            <div className="use-case-box-final">
              <h3>Product Feedback</h3>
              <p>
                Collect user preferences and feedback on features, designs, and
                product roadmap
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="steps-final">
        <div className="container">
          <div className="section-intro-final">
            <span className="section-tag-final">Process</span>
            <h2>How It Works</h2>
            <p>Simple, transparent, and secure in just four steps</p>
          </div>

          <div className="steps-grid-final">
            <div className="step-box-final">
              <div className="step-num-final">01</div>
              <h3>Connect Your Wallet</h3>
              <p>
                Link your Sui wallet to start creating or participating in
                voting markets
              </p>
            </div>

            <div className="step-box-final">
              <div className="step-num-final">02</div>
              <h3>Create Your Market</h3>
              <p>
                Set up your question with custom voting options and duration
              </p>
            </div>

            <div className="step-box-final">
              <div className="step-num-final">03</div>
              <h3>Share Market ID</h3>
              <p>
                Share the unique Market ID with your community or team members
              </p>
            </div>

            <div className="step-box-final">
              <div className="step-num-final">04</div>
              <h3>Track Results Live</h3>
              <p>
                Monitor votes in real-time with transparent, immutable counting
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-final">
        <div className="container">
          <div className="cta-content-final">
            <h2>Ready to Get Started?</h2>
            <p>Create your first voting market in under a minute</p>
            <button className="btn-cta-final" onClick={onNavigate}>
              Create Voting Market →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
