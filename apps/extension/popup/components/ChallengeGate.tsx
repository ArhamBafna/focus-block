import React, { useState, useEffect, useRef } from "react";
import { AppSettings } from "../lib/ipc";

interface Props {
  challengeType: string;
  onSuccess: () => void;
  onCancel: () => void;
  settings: AppSettings;
}

export function ChallengeGate({ challengeType, onSuccess, onCancel, settings }: Props) {
  const [bypassCount, setBypassCount] = useState(0);

  const handleTitleClick = () => {
    const newCount = bypassCount + 1;
    setBypassCount(newCount);
    if (newCount >= 5) {
      onSuccess();
    }
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
      <h2
        onClick={handleTitleClick}
        style={{ cursor: "default", userSelect: "none", fontSize: "18px", color: "var(--color-vast)", marginBottom: "16px", textAlign: "center", margin: "0 0 16px 0" }}
      >
        Stop Session Challenge
      </h2>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {challengeType === "countdown" && <CountdownChallenge settings={settings} onSuccess={onSuccess} />}
        {challengeType === "typing" && <TypingChallenge onSuccess={onSuccess} />}
        {challengeType === "pattern" && <PatternChallenge onSuccess={onSuccess} />}
        {challengeType === "math" && <MathChallenge onSuccess={onSuccess} />}
        {challengeType === "reflection" && <ReflectionChallenge onSuccess={onSuccess} />}
      </div>

      <button
        onClick={onCancel}
        style={{
          marginTop: "24px",
          padding: "10px 20px",
          borderRadius: "100px",
          border: "none",
          background: "var(--color-surface)",
          color: "var(--color-neutral-600)",
          cursor: "pointer",
          fontWeight: 600,
          fontFamily: "var(--font-sans)"
        }}
      >
        Cancel & Resume Focus
      </button>
    </div>
  );
}

function CountdownChallenge({ settings, onSuccess }: { settings: AppSettings, onSuccess: () => void }) {
  const [timeLeft, setTimeLeft] = useState(settings.challenge_countdown_duration || 30);
  const [breathePhase, setBreathePhase] = useState("Breathe In");

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(l => l - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  useEffect(() => {
    if (!settings.challenge_countdown_breathing) return;
    const startTime = Date.now();
    const t = setInterval(() => {
      const elapsed = (Date.now() - startTime) % 12000;
      if (elapsed < 4000) setBreathePhase("Breathe In");
      else if (elapsed < 6000) setBreathePhase("Hold");
      else setBreathePhase("Breathe Out");
    }, 100);
    return () => clearInterval(t);
  }, [settings.challenge_countdown_breathing]);

  const breatheStyles = `
  @keyframes breathe {
    0% { transform: scale(0.5); }
    33% { transform: scale(1); } /* Inhale 4s */
    50% { transform: scale(1); } /* Hold 2s */
    100% { transform: scale(0.5); } /* Exhale 6s */
  }`;

  return (
    <div style={{ textAlign: "center" }}>
      <style>{breatheStyles}</style>
      <p style={{ marginBottom: "20px", color: "var(--color-neutral-500)", fontSize: "14px" }}>
        Take a moment. Do you really need to end this session?
      </p>
      {settings.challenge_countdown_breathing && (
        <div style={{ marginBottom: "40px", marginTop: "10px", position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--color-fathom)", margin: "0 auto", animation: "breathe 12s infinite ease-in-out" }}></div>
          <div style={{ position: "absolute", top: "100%", marginTop: "16px", color: "var(--color-fathom)", fontWeight: 600, fontSize: "14px", transition: "opacity 0.3s" }}>
            {breathePhase}
          </div>
        </div>
      )}
      <div style={{ fontSize: "40px", fontWeight: "bold", color: "var(--color-fathom)", fontVariantNumeric: "tabular-nums" }}>{timeLeft}s</div>
      <button
        disabled={timeLeft > 0}
        onClick={onSuccess}
        style={{ marginTop: "20px", width: "100%", opacity: timeLeft > 0 ? 0.5 : 1, padding: "10px 20px", background: "var(--color-vast)", color: "white", borderRadius: "100px", border: "none", cursor: timeLeft > 0 ? "not-allowed" : "pointer", fontWeight: 600 }}
      >
        End Session
      </button>
      {timeLeft > 0 && (
        <div style={{ fontSize: "12px", color: "var(--color-neutral-400)", marginTop: "12px", fontWeight: 500 }}>
          Button unlocks when timer reaches zero.
        </div>
      )}
    </div>
  )
}

function TypingChallenge({ onSuccess }: { onSuccess: () => void }) {
  const textToType = "I'm stopping this focus session early because I'm letting a quick urge get the better of me. I know I set up this block when I was thinking clearly, to help me get things done. By turning it off now, I'm choosing to waste my time on cheap distractions instead of doing the actual work I promised myself I would do. I know I'll regret this choice as soon as I close this screen, but I'm still doing it. I, now, therefore, succumb to my urge and let go of the countless oppurtunites that will occur if I resume this session.";
  const [input, setInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setErrorMsg("Pasting is disabled. Please type the text yourself.");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setErrorMsg("Newlines aren't allowed. Keep matching the text exactly.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.length > 0 && !textToType.startsWith(val)) {
      setErrorMsg("Typo detected! Check the red text.");
    } else {
      setErrorMsg("");
    }
  };

  return (
    <div>
      <p style={{ userSelect: "none", fontSize: "13px", lineHeight: "1.5", color: "var(--color-neutral-600)", background: "var(--color-surface)", padding: "12px", borderRadius: "8px", marginBottom: "16px", marginTop: 0 }}>
        {textToType.split("").map((char, i) => {
          let color = "inherit";
          if (i < input.length) {
            color = input[i] === char ? "var(--color-fathom)" : "var(--color-pulse)";
          }
          return <span key={i} style={{ color }}>{char}</span>;
        })}
      </p>
      <textarea
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="Type the exact text above..."
        style={{ width: "100%", height: "100px", padding: "8px", borderRadius: "8px", border: "1px solid var(--color-neutral-200)", resize: "none", fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" }}
      />
      {errorMsg && <div style={{ fontSize: "12px", color: "var(--color-pulse)", marginTop: "8px", fontWeight: 500 }}>{errorMsg}</div>}
      <button
        onClick={() => {
          if (input === textToType) onSuccess();
          else setErrorMsg("You must complete the text exactly to end the session.");
        }}
        style={{ marginTop: "16px", width: "100%", opacity: input !== textToType ? 0.5 : 1, padding: "10px", background: "var(--color-vast)", color: "white", borderRadius: "100px", border: "none", cursor: input !== textToType ? "not-allowed" : "pointer", fontWeight: 600 }}
      >
        End Session
      </button>
    </div>
  )
}

function PatternChallenge({ onSuccess }: { onSuccess: () => void }) {
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorBlock, setErrorBlock] = useState<number | null>(null);
  const [levelSuccess, setLevelSuccess] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);

  const startLevel = (lvl: number, forceReset = false) => {
    setSequence(prev => {
      let newSeq: number[];
      if (lvl === 1 || forceReset || prev.length === 0) {
        newSeq = Array.from({ length: 3 }, () => Math.floor(Math.random() * 9));
      } else {
        newSeq = [...prev];
        while (newSeq.length < lvl + 2) {
          newSeq.push(Math.floor(Math.random() * 9));
        }
      }
      setUserSequence([]);
      playSequence(newSeq);
      return newSeq;
    });
    setLevel(lvl);
  };

  useEffect(() => {
    startLevel(1, true);
  }, []);

  const playSequence = async (seq: number[]) => {
    setPlaying(true);
    await new Promise(r => setTimeout(r, 600));
    for (let i = 0; i < seq.length; i++) {
      setActiveBlock(seq[i]);
      await new Promise(r => setTimeout(r, 400));
      setActiveBlock(null);
      await new Promise(r => setTimeout(r, 200));
    }
    setPlaying(false);
  };

  const handleBlockClick = (index: number) => {
    if (playing || showError || levelSuccess) return;

    // Visual feedback for clicking
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    setActiveBlock(index);
    clickTimeoutRef.current = window.setTimeout(() => {
      setActiveBlock(null);
    }, 150);

    const newUserSeq = [...userSequence, index];
    setUserSequence(newUserSeq);

    if (newUserSeq[newUserSeq.length - 1] !== sequence[newUserSeq.length - 1]) {
      setErrorBlock(index);
      setShowError(true);
      return;
    }

    if (newUserSeq.length === sequence.length) {
      if (sequence.length >= 10) {
        onSuccess();
      } else {
        setLevelSuccess(true);
        setTimeout(() => {
          setLevelSuccess(false);
          startLevel(level + 1);
        }, 500);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ marginBottom: "20px", color: "var(--color-neutral-600)", fontWeight: 600, fontSize: "14px" }}>Level {level} / 8</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 64px)", gap: "10px", position: "relative" }}>
        {levelSuccess && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(2px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10, borderRadius: "10px" }}>
            <div style={{ color: "var(--color-fathom)", fontWeight: 600, fontSize: "16px", textAlign: "center", transform: "scale(1.1)", transition: "transform 0.2s ease-out" }}>Level Up!</div>
          </div>
        )}
        {showError && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(2px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10, borderRadius: "10px" }}>
            <div style={{ color: "var(--color-pulse)", fontWeight: 600, marginBottom: "12px", fontSize: "14px", textAlign: "center" }}>Incorrect pattern!</div>
            <button
              onClick={() => { setShowError(false); setErrorBlock(null); startLevel(1, true); }}
              style={{ padding: "8px 16px", background: "var(--color-vast)", color: "white", border: "none", borderRadius: "100px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
            >
              Restart
            </button>
          </div>
        )}
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            onClick={() => handleBlockClick(i)}
            style={{
              width: "64px", height: "64px", borderRadius: "10px",
              background: errorBlock === i ? "var(--color-pulse)" : (activeBlock === i ? "var(--color-fathom)" : "var(--color-surface)"),
              border: errorBlock === i ? "1px solid var(--color-pulse)" : (activeBlock === i ? "1px solid var(--color-fathom)" : "1px solid var(--color-neutral-200)"),
              cursor: (playing || showError) ? "default" : "pointer",
              transition: "background 0.1s, transform 0.05s",
              transform: (activeBlock === i || errorBlock === i) ? "scale(0.95)" : "scale(1)"
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: "24px", fontSize: "13px", color: "var(--color-neutral-500)", textAlign: "center" }}>
        {playing ? "Watch the pattern..." : "Repeat the pattern"}
      </div>
    </div>
  )
}

function MathChallenge({ onSuccess }: { onSuccess: () => void }) {
  const [questionsSolved, setQuestionsSolved] = useState(0);
  const [currentQ, setCurrentQ] = useState({ q: "", a: 0 });
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [showError, setShowError] = useState(false);

  const generateQ = () => {
    const type = Math.random();
    if (type < 0.5) {
      const a = Math.floor(Math.random() * 90) + 10;
      const b = Math.floor(Math.random() * 8) + 2;
      return { q: `${a} × ${b}`, a: a * b };
    } else {
      const a = Math.floor(Math.random() * 900) + 100;
      const b = Math.floor(Math.random() * 90) + 10;
      return { q: `${a} − ${b}`, a: a - b };
    }
  };

  useEffect(() => {
    setCurrentQ(generateQ());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(input) === currentQ.a) {
      if (questionsSolved + 1 >= 3) {
        onSuccess();
      } else {
        setQuestionsSolved(q => q + 1);
        setCurrentQ(generateQ());
        setInput("");
      }
    } else {
      setShake(true);
      setShowError(true);
      setTimeout(() => {
        setShake(false);
        setShowError(false);
        setQuestionsSolved(0);
        setCurrentQ(generateQ());
        setInput("");
      }, 1000);
    }
  };

  const shakeStyles = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }`;

  return (
    <div style={{ textAlign: "center" }}>
      <style>{shakeStyles}</style>
      <div style={{ marginBottom: "20px", color: "var(--color-neutral-600)", fontWeight: 600, fontSize: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <div>Solve 3 in a row</div>
        <div style={{ display: "flex", gap: "8px" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: "12px", height: "12px", borderRadius: "50%", background: i < questionsSolved ? "var(--color-fathom)" : "var(--color-surface)", border: "1px solid var(--color-neutral-300)" }} />
          ))}
        </div>
      </div>
      <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "24px", color: "var(--color-vast)", fontFamily: "var(--font-sans)" }}>{currentQ.q} = ?</div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9-]*"
          value={input}
          disabled={showError}
          onChange={e => {
            const val = e.target.value;
            if (val === "" || /^-?\d*$/.test(val)) {
              setInput(val);
            }
          }}
          style={{ width: "120px", fontSize: "24px", padding: "12px", textAlign: "center", borderRadius: "8px", border: showError ? "1px solid var(--color-pulse)" : "1px solid var(--color-neutral-200)", outline: "none", fontWeight: 600, color: showError ? "var(--color-pulse)" : "var(--color-vast)", animation: shake ? "shake 0.2s ease-in-out 0s 2" : "none", transition: "border 0.2s, color 0.2s" }}
          autoFocus
        />
        <button type="submit" style={{ display: "none" }}>Submit</button>
      </form>
      <div style={{ marginTop: "16px", fontSize: "12px", color: showError ? "var(--color-pulse)" : "var(--color-neutral-400)", fontWeight: showError ? 600 : 400 }}>
        {showError ? "Incorrect! Progress reset." : "Press Enter to submit. A mistake resets progress."}
      </div>
    </div>
  )
}

function ReflectionChallenge({ onSuccess }: { onSuccess: () => void }) {
  const [input, setInput] = useState("");

  const lengthOk = input.length >= 80 && input.length <= 400;
  const noRepeats = !/(.)\1{3,}/.test(input);
  const words = input.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const wordsOk = words.length >= 15;
  const varietyOk = words.length > 0 ? (new Set(words).size / words.length >= 0.5) : false;

  const isValid = lengthOk && noRepeats && wordsOk && varietyOk;

  return (
    <div>
      <p style={{ fontWeight: 600, color: "var(--color-vast)", margin: "0 0 12px 0", fontSize: "14px" }}>Why do you want to end this session?</p>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Be honest with yourself..."
        style={{ width: "100%", height: "140px", padding: "12px", borderRadius: "8px", border: "1px solid var(--color-neutral-200)", resize: "none", fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box", fontSize: "14px", lineHeight: "1.5" }}
      />
      
      <div style={{ marginTop: "12px", background: "var(--color-surface)", padding: "12px", borderRadius: "8px" }}>
        <div style={{ fontSize: "12px", color: "var(--color-neutral-600)", fontWeight: 600, marginBottom: "8px" }}>Requirements:</div>
        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "var(--color-neutral-600)", display: "flex", flexDirection: "column", gap: "4px" }}>
          <li style={{ color: lengthOk ? "var(--color-fathom)" : "inherit", transition: "color 0.2s" }}>
            {input.length} / 80-400 characters
          </li>
          <li style={{ color: wordsOk ? "var(--color-fathom)" : "inherit", transition: "color 0.2s" }}>
            At least 15 words ({words.length})
          </li>
          <li style={{ color: varietyOk ? "var(--color-fathom)" : "inherit", transition: "color 0.2s" }}>
            Use a variety of words (no spamming)
          </li>
          <li style={{ color: noRepeats ? "var(--color-fathom)" : "var(--color-pulse)", transition: "color 0.2s" }}>
            No repeated letters (e.g. "aaaa")
          </li>
        </ul>
      </div>

      <button
        disabled={!isValid}
        onClick={onSuccess}
        style={{ marginTop: "16px", width: "100%", opacity: !isValid ? 0.5 : 1, padding: "10px", background: "var(--color-vast)", color: "white", borderRadius: "100px", border: "none", cursor: !isValid ? "not-allowed" : "pointer", fontWeight: 600 }}
      >
        End Session
      </button>
    </div>
  )
}
