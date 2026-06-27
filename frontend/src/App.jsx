import { useState, useEffect, useRef } from 'react'
import * as Icons from './icons.jsx'

function App() {
  const [claim, setClaim] = useState("");
  const [numRounds, setNumRounds] = useState(3);
  const [forPersona, setForPersona] = useState(50);
  const [againstPersona, setAgainstPersona] = useState(50);
  const [debateActive, setDebateActive] = useState(false);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(-1);
  const [displayedRounds, setDisplayedRounds] = useState([]);
  const [activeAgent, setActiveAgent] = useState("");
  const [logs, setLogs] = useState([]);
  const [confidence, setConfidence] = useState(50);
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState("");

  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (text, type = "system") => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { timestamp, text, type }]);
  };

  const handlePresetClick = (presetText) => {
    setClaim(presetText);
  };

  const runLiveBackend = async (selectedClaim) => {
    setLoading(true);
    setDebateActive(true);
    setDisplayedRounds([]);
    setVerdict(null);
    setConfidence(50);
    setBackendError("");

    addLog(`Sending debate request to LLM backend...`, "system");
    addLog(`Claim: "${selectedClaim}" | Rounds: ${numRounds}`, "system");

    try {
      const res = await fetch("http://localhost:8000/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: selectedClaim, num_rounds: numRounds })
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      addLog(`Backend LLM generated the debate! Loading transcripts...`, "system");

      for (let i = 0; i < data.rounds.length; i++) {
        setActiveAgent("FOR");
        setDisplayedRounds(prev => [...prev, {
          for: data.rounds[i].for,
          against: ""
        }]);
        addLog(`Round ${i+1} - Agent FOR published arguments.`, "for");
        await delay(800);

        setActiveAgent("AGAINST");
        await delay(600);
        setDisplayedRounds(prev => {
          const updated = [...prev];
          updated[i].against = data.rounds[i].against;
          return updated;
        });
        addLog(`Round ${i+1} - Agent AGAINST published rebuttal.`, "against");
        await delay(800);
      }

      setActiveAgent("JUDGE");
      addLog(`Judge is analyzing all arguments for logical fallacies...`, "judge");
      await delay(1200);

      if (data.verdict) {
        let cleanVerdict = data.verdict;
        if (typeof data.verdict === 'string') {
          try {
            cleanVerdict = JSON.parse(data.verdict);
          } catch (e) {
            cleanVerdict = {
              verdict: "Verdict Decided",
              reasoning: data.verdict,
              for_score: 5,
              against_score: 5,
              fallacies_detected: []
            };
          }
        }

        const mappedFallacies = [];
        if (cleanVerdict.fallacies_detected) {
          if (Array.isArray(cleanVerdict.fallacies_detected)) {
            cleanVerdict.fallacies_detected.forEach(f => {
              mappedFallacies.push({ agent: "DEBATER", name: f, detail: "Identified by Judge" });
            });
          } else if (typeof cleanVerdict.fallacies_detected === 'object') {
            Object.entries(cleanVerdict.fallacies_detected).forEach(([k, v]) => {
              mappedFallacies.push({ agent: k.toUpperCase(), name: v, detail: "Identified by Judge" });
            });
          }
        }

        const parsedForScore = parseInt(cleanVerdict.for_score, 10) || 0;
        const parsedAgainstScore = parseInt(cleanVerdict.against_score, 10) || 0;
        let derivedWinner = "DRAW";
        if (parsedForScore > parsedAgainstScore) {
          derivedWinner = "FOR";
        } else if (parsedAgainstScore > parsedForScore) {
          derivedWinner = "AGAINST";
        }

        setVerdict({
          for_score: parsedForScore,
          against_score: parsedAgainstScore,
          fallacies_detected: mappedFallacies,
          verdict: cleanVerdict.verdict || "Verdict Decided",
          reasoning: cleanVerdict.reasoning || "Analyzed by backend judge.",
          derivedWinner
        });

        const total = parsedForScore + parsedAgainstScore;
        setConfidence(total > 0 ? Math.round((parsedForScore / total) * 100) : 50);
        setActiveAgent("");
      }
    } catch (err) {
      addLog(`Backend communication failed: ${err.message}`, "system");
      setDebateActive(false);
      setBackendError(`Could not connect to the TruthArena backend at http://localhost:8000. Make sure the API server is running.`);
    } finally {
      setLoading(false);
    }
  };

  const startDebate = () => {
    if (!claim.trim()) return;
    runLiveBackend(claim);
  };

  const resetDebate = () => {
    setDebateActive(false);
    setDisplayedRounds([]);
    setVerdict(null);
    setConfidence(50);
    setCurrentRoundIndex(-1);
    setActiveAgent("");
    setLogs([]);
    setBackendError("");
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <div className="app-container">
      <header className="header-logo">
        <div className="logo-icon">TruthArena</div>
        <div className="logo-badge">GENAI WORKSPACE</div>
        <div style={{ marginLeft: 'auto' }} className="api-status-badge">
          <span className="status-dot status-dot-active"></span>
          <span>Live LLM Backend</span>
        </div>
      </header>

      {backendError && (
        <div className="alert-panel alert-danger">
          <Icons.AlertCircle />
          <div>
            <strong>Connection Error:</strong> {backendError}
          </div>
        </div>
      )}

      {!debateActive ? (
        <div className="dashboard-grid">

          <div className="glass-panel control-section">
            <div className="control-title">
              <Icons.Sliders />
              <span>Platform Config</span>
            </div>

            <div className="slider-group">
              <label className="slider-header">
                <span>Debate Rounds</span>
                <span>{numRounds}</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={numRounds}
                onChange={e => setNumRounds(parseInt(e.target.value))}
                className="custom-slider"
              />
            </div>

            <div className="slider-group" style={{ marginTop: '24px' }}>
              <label className="slider-header">
                <span>FOR Agent Persona</span>
                <span>{forPersona > 60 ? "Aggressive" : forPersona < 40 ? "Empathetic" : "Balanced"}</span>
              </label>
              <input
                type="range"
                min="10"
                max="90"
                value={forPersona}
                onChange={e => setForPersona(parseInt(e.target.value))}
                className="custom-slider"
              />
            </div>

            <div className="slider-group">
              <label className="slider-header">
                <span>AGAINST Agent Persona</span>
                <span>{againstPersona > 60 ? "Fact-Heavy" : againstPersona < 40 ? "Rhetorical" : "Dialectical"}</span>
              </label>
              <input
                type="range"
                min="10"
                max="90"
                value={againstPersona}
                onChange={e => setAgainstPersona(parseInt(e.target.value))}
                className="custom-slider"
              />
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div className="control-title">
                <Icons.Cpu />
                <span>Assigned Models</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-for)' }}>FOR:</span>
                  <span style={{ fontWeight: '500' }}>Gemini 2.5 Flash</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-against)' }}>AGAINST:</span>
                  <span style={{ fontWeight: '500' }}>Llama 3.3 70B</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-judge)' }}>JUDGE:</span>
                  <span style={{ fontWeight: '500' }}>DeepSeek R1</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icons.Swords />
              <span>Enter the TruthArena</span>
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
              Provide an argumentative claim. Opposing large language models will debate the topic, perform web evidence queries, and face a final structured judgment.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                Your Debate Claim
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  className="glass-input"
                  style={{ flex: 1 }}
                  placeholder="e.g. Remote work increases productivity..."
                  value={claim}
                  onChange={e => setClaim(e.target.value)}
                />
                <button
                  onClick={startDebate}
                  disabled={!claim.trim() || loading}
                  className="btn btn-primary"
                >
                  {loading ? (
                    <>
                      <Icons.RefreshCw />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Icons.Play />
                      <span>Start Debate</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                Sample Claims to Debate
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => handlePresetClick("Remote work increases productivity")} className="preset-chip">
                  <strong>Remote Work:</strong> "Remote work increases productivity"
                </button>
                <button onClick={() => handlePresetClick("AI will create more jobs than it destroys")} className="preset-chip">
                  <strong>Artificial Intelligence:</strong> "AI will create more jobs than it destroys"
                </button>
                <button onClick={() => handlePresetClick("Standardized testing should be abolished")} className="preset-chip">
                  <strong>Education:</strong> "Standardized testing should be abolished"
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div>
          <div className="glass-panel arena-header">
            <div className="claim-title-card">
              <span className="claim-quote-mark">{"\u201C"}</span>
              <span>{claim}</span>
            </div>

            <div className="meter-container">
              <div className="meter-labels">
                <span style={{ color: 'var(--color-for)' }}>FOR (Gemini)</span>
                <span style={{ color: 'var(--color-against)' }}>AGAINST (Llama)</span>
              </div>
              <div className="meter-bar-outer">
                <div className="meter-bar-for" style={{ width: `${confidence}%` }}></div>
                <div className="meter-bar-against" style={{ width: `${100 - confidence}%` }}></div>
                <div className="meter-marker"></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                <span>{confidence}% persuasion score</span>
                <span>{100 - confidence}% persuasion score</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

            <div>
              <div className="debate-columns">
                <div className={`glass-panel ${activeAgent === "FOR" ? "pulse-for" : ""}`}>
                  <div className="column-header">
                    <div className="avatar-wrapper">
                      <div className="agent-avatar avatar-for">G</div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>FOR Agent</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gemini 2.5 Flash</div>
                      </div>
                    </div>
                    <span className="badge badge-for">Proponent</span>
                  </div>

                  <div className="speech-bubble-list">
                    {displayedRounds.map((r, idx) => (
                      <div key={idx} className="speech-bubble for-type">
                        <div className="bubble-meta">
                          <span>Round {idx + 1}</span>
                          <span>Argued</span>
                        </div>
                        <p dangerouslySetInnerHTML={{ __html: r.for }}></p>
                      </div>
                    ))}

                    {activeAgent === "FOR" && (
                      <div className="thinking-placeholder">
                        <Icons.Search />
                        <span>Gemini is researching and drafting rebuttal</span>
                        <div className="dot-typing"><span></span><span></span><span></span></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`glass-panel ${activeAgent === "AGAINST" ? "pulse-against" : ""}`}>
                  <div className="column-header">
                    <div className="avatar-wrapper">
                      <div className="agent-avatar avatar-against">L</div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>AGAINST Agent</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Llama 3.3 70B</div>
                      </div>
                    </div>
                    <span className="badge badge-against">Opponent</span>
                  </div>

                  <div className="speech-bubble-list">
                    {displayedRounds.map((r, idx) => r.against && (
                      <div key={idx} className="speech-bubble against-type">
                        <div className="bubble-meta">
                          <span>Round {idx + 1}</span>
                          <span>Argued</span>
                        </div>
                        <p dangerouslySetInnerHTML={{ __html: r.against }}></p>
                      </div>
                    ))}

                    {activeAgent === "AGAINST" && (
                      <div className="thinking-placeholder">
                        <Icons.Search />
                        <span>Llama is searching files and formulating response</span>
                        <div className="dot-typing"><span></span><span></span><span></span></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {verdict && (
                <div className="glass-panel verdict-backdrop">
                  <div className="verdict-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icons.Gavel style={{ color: 'var(--color-judge)' }} />
                      <span style={{ fontSize: '1.2rem', fontWeight: '700', fontFamily: 'var(--font-title)' }}>Court Adjudication Verdict</span>
                    </div>
                    <span className="badge badge-judge">DEEPSEEK R1 JUDGE</span>
                  </div>

                  <div className="verdict-score-ring-row">
                    <div className="score-circle-container">
                      <div className="score-gauge-big" style={{ borderColor: 'var(--color-for)' }}>
                        <span className="score-value-big" style={{ color: 'var(--color-for)' }}>{verdict.for_score}</span>
                      </div>
                      <span className="gauge-label">FOR Score</span>
                    </div>

                    <div style={{ borderLeft: '1px solid var(--border-color)', height: '80px', margin: 'auto 0' }}></div>

                    <div className="score-circle-container">
                      <div className="score-gauge-big" style={{ borderColor: verdict.derivedWinner === "FOR" ? 'var(--color-for)' : verdict.derivedWinner === "AGAINST" ? 'var(--color-against)' : 'var(--color-judge)' }}>
                        <span className="score-value-big" style={{ color: verdict.derivedWinner === "FOR" ? 'var(--color-for)' : verdict.derivedWinner === "AGAINST" ? 'var(--color-against)' : 'var(--color-judge)' }}>{verdict.derivedWinner}</span>
                      </div>
                      <span className="gauge-label">Winner</span>
                    </div>

                    <div style={{ borderLeft: '1px solid var(--border-color)', height: '80px', margin: 'auto 0' }}></div>

                    <div className="score-circle-container">
                      <div className="score-gauge-big" style={{ borderColor: 'var(--color-against)' }}>
                        <span className="score-value-big" style={{ color: 'var(--color-against)' }}>{verdict.against_score}</span>
                      </div>
                      <span className="gauge-label">AGAINST Score</span>
                    </div>
                  </div>

                  <div style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Verdict Decision
                      </strong>
                      <p style={{ fontSize: '1.15rem', fontWeight: '600', color: '#fff' }}>{verdict.verdict}</p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Reasoning Assessment
                      </strong>
                      <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: '1.6' }}>{verdict.reasoning}</p>
                    </div>

                    {verdict.fallacies_detected.length > 0 && (
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Fallacies Flagged By Judge
                        </strong>
                        <div className="fallacy-tag-row">
                          {verdict.fallacies_detected.map((f, idx) => (
                            <div key={idx} className="fallacy-badge-tag">
                              <span>{f.agent}: <strong>{f.name}</strong></span>
                              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({f.detail})</span>
                            </div>
                          ))}
                        </div>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                          * Hover over the underlined text in the transcript columns above to see fallacy descriptions.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeAgent === "JUDGE" && !verdict && (
                <div className="glass-panel pulse-judge" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                  <Icons.Scale style={{ color: 'var(--color-judge)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <h4 style={{ color: '#fff' }}>Judge Agent is Adjudicating</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      DeepSeek R1 is parsing all arguments for logical fallacies and evaluating fact points...
                    </p>
                  </div>
                  <div className="dot-typing"><span></span><span></span><span></span></div>
                </div>
              )}

              <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={resetDebate} disabled={activeAgent !== "" && !verdict}>
                  <Icons.RefreshCw />
                  <span>Start New Debate</span>
                </button>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px', position: 'sticky', top: '24px' }}>
              <div className="control-title">
                <Icons.Cpu />
                <span>Real-Time Logs</span>
              </div>

              <div className="log-panel">
                {logs.map((log, idx) => (
                  <div key={idx} className="log-entry">
                    <span className="log-timestamp">[{log.timestamp}]</span>
                    <span className={`log-text-${log.type}`}>{log.text}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '0.8rem' }}>
                <strong style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>
                  DEBATER STATS
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gemini (FOR):</span>
                    <span style={{ color: 'var(--color-for)' }}>{displayedRounds.length} rounds active</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Llama (AGAINST):</span>
                    <span style={{ color: 'var(--color-against)' }}>{displayedRounds.filter(r => r.against).length} rounds active</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Round Limit:</span>
                    <span>{numRounds} rounds max</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App
