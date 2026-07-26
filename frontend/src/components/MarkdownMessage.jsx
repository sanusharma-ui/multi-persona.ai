import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import { CopyToClipboard } from "react-copy-to-clipboard";

export default function MarkdownMessage({ message }) {
  const [copied, setCopied] = useState(false);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, className, children }) {
          const match = /language-(\w+)/.exec(className || "");

          if (!inline && match) {
            const code = String(children).replace(/\n$/, "");

            return (
              <div className="code-block">
                <div className="code-header">
                  <span>{match[1].toUpperCase()}</span>

                  <CopyToClipboard
                    text={code}
                    onCopy={() => {
                      setCopied(true);

                      setTimeout(() => {
                        setCopied(false);
                      }, 1500);
                    }}
                  >
                    <button className="copy-btn">
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </CopyToClipboard>
                </div>

                <SyntaxHighlighter
                  language={match[1]}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    borderRadius: "0 0 10px 10px",
                    fontSize: "15px",
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code className="inline-code">
              {children}
            </code>
          );
        },
      }}
    >
      {message}
    </ReactMarkdown>
  );
}