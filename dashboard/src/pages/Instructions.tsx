import { useEffect, useState } from "react";
import { fetchInstructions } from "../api";

function Body({ text }: Readonly<{ text: string }>) {
  return (
    <div className="instructions">
      {text.split("\n").map((line, index) => {
        if (line.startsWith("#")) {
          return <h3 key={index}>{line.replaceAll("#", "").trim()}</h3>;
        }
        if (line.trim() === "") {
          return <span key={index} className="spacer" />;
        }
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

export function Instructions() {
  const [instructions, setInstructions] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void fetchInstructions()
      .then((text) => {
        setInstructions(text);
      })
      .catch(() => {
        setFailed(true);
      });
  }, []);

  return (
    <section>
      <h1>Agent instructions</h1>
      <div className="card">
        {instructions === null ? (
          <p className="empty">
            {failed ? "The instructions are unavailable." : "Loading…"}
          </p>
        ) : (
          <Body text={instructions} />
        )}
      </div>
    </section>
  );
}
