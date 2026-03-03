package models

// Command represents a CLI tool/command definition
type Command struct {
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	Category        string         `json:"category,omitempty"`
	Platforms       []string       `json:"platforms,omitempty"`
	Shells          []string       `json:"shells,omitempty"`
	Subcommands     []Subcommand   `json:"subcommands,omitempty"`
	GlobalOptions   []Option       `json:"globalOptions,omitempty"`
	Examples        []string       `json:"examples,omitempty"`
	RelatedCommands []string       `json:"relatedCommands,omitempty"`
	ContextEngine   *ContextEngine `json:"contextEngine,omitempty"`
}

// ContextEngine provides runtime context detection for intelligent suggestions
type ContextEngine struct {
	Detectors []ContextDetector `json:"detectors"`
}

// ContextDetector defines how to gather a piece of runtime context
type ContextDetector struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Command     string `json:"command"`
	Parser      string `json:"parser"` // text, lines, json, csv, keyvalue, regex, table
	Pattern     string `json:"pattern,omitempty"`
	CacheFor    int    `json:"cacheFor,omitempty"`    // seconds to cache result, 0 = no cache
	RequiresCmd string `json:"requiresCmd,omitempty"` // check if command exists before running
}

// Subcommand represents a subcommand of a CLI tool
type Subcommand struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Args        []Arg    `json:"args,omitempty"`
	Options     []Option `json:"options,omitempty"`
	Examples    []string `json:"examples,omitempty"`
}

// Arg represents a positional argument
type Arg struct {
	Name        string `json:"name"`
	Type        string `json:"type,omitempty"`
	Required    bool   `json:"required,omitempty"`
	Description string `json:"description"`
}

// Option represents a command-line flag/option
type Option struct {
	Name        string `json:"name"`
	Short       string `json:"short,omitempty"`
	Description string `json:"description"`
	Type        string `json:"type,omitempty"`
	Default     string `json:"default,omitempty"`
}

// PaginatedResponse wraps paginated results
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PerPage    int         `json:"per_page"`
	TotalPages int         `json:"total_pages"`
}

// ErrorResponse represents an API error
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}
