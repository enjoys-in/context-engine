import * as cp from "node:child_process";

// ── Language server binary configuration ────────────────────────────
// Maps language IDs to the command + args needed to spawn their LSP server.
// Only languages with a real server binary installed will be proxied;
// all others fall back to the static context-engine data.

export interface LanguageServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

const SERVERS: Record<string, LanguageServerConfig> = {
    go: { command: "gopls", args: ["serve"] },
    // Extend as needed:
    // typescript:  { command: "typescript-language-server", args: ["--stdio"] },
    // python:      { command: "pylsp", args: [] },
    // rust:        { command: "rust-analyzer", args: [] },
    // c:           { command: "clangd", args: ["--log=error"] },
    // cpp:         { command: "clangd", args: ["--log=error"] },
};

/** Returns the config if the language has a real LSP server defined. */
export function getServerConfig(languageId: string): LanguageServerConfig | undefined {
    return SERVERS[languageId];
}

/** Returns true if the binary is actually reachable on $PATH. */
export function isServerAvailable(config: LanguageServerConfig): boolean {
    try {
        const result = cp.spawnSync(
            process.platform === "win32" ? "where" : "which",
            [config.command],
            { timeout: 3000, stdio: "ignore" }
        );
        return result.status === 0;
    } catch {
        return false;
    }
}
